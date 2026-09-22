import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { forbidden, requireUser, withRefreshedSession } from "@/lib/auth";
import type { ChangePhoto, ProjectChange } from "@/types";
import {
  CHANGE_DESCRIPTION_MAX,
  canInitiateChanges,
  changePhotoPrefix,
  formatChangeNumber,
  validateChangeContent,
} from "@/lib/project-change";
import {
  CHANGES_TABLE,
  CHANGE_DECISIONS_TABLE,
  CHANGE_VERSIONS_TABLE,
  listChangesForUser,
  loadAcceptors,
  loadChange,
  reloadChangeApp,
} from "@/lib/project-change-server";
import { issueInvitation, renderChangePdf } from "@/lib/project-change-mail";
import { isAllowedStoragePath } from "@/lib/storage-paths";
import { newPrefixedId } from "@/lib/ids";
import { getPolishCurrentDate } from "@/lib/date-utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PHOTOS_PER_SECTION = 200;

/** Lista kart widocznych dla zalogowanego (patrz listChangesForUser). */
export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Brak bazy." }, { status: 503 });
  }

  try {
    const changes = await listChangesForUser(supabase, auth.context.user);
    return withRefreshedSession(NextResponse.json({ success: true, changes }), auth.context);
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        message: `Nie udało się pobrać kart zmian: ${err instanceof Error ? err.message : "błąd"}`,
      },
      { status: 500 }
    );
  }
}

interface IncomingSection {
  description?: unknown;
  photos?: unknown;
}

/** Zdjęcia z żądania — tylko ścieżki tej karty; base64 nie ma prawa tu dotrzeć. */
function cleanPhotos(changeId: string, value: unknown): ChangePhoto[] | string {
  if (!Array.isArray(value)) return [];
  if (value.length > MAX_PHOTOS_PER_SECTION) return "Za dużo zdjęć w jednej sekcji.";
  const prefix = changePhotoPrefix(changeId);
  const out: ChangePhoto[] = [];
  for (const raw of value as Array<Record<string, unknown>>) {
    const path = typeof raw?.path === "string" ? raw.path : "";
    if (!path) return "Nie wszystkie zdjęcia zostały wgrane. Spróbuj wysłać ponownie, gdy wróci zasięg.";
    if (!path.startsWith(prefix) || !isAllowedStoragePath(path)) return "Nieprawidłowe zdjęcie.";
    out.push({
      id: typeof raw.id === "string" ? raw.id : path,
      path,
      takenAt: typeof raw.takenAt === "string" ? raw.takenAt : "",
      ...(raw.source === "aparat" || raw.source === "galeria" ? { source: raw.source } : {}),
      ...(typeof raw.capturedAt === "string" && raw.capturedAt ? { capturedAt: raw.capturedAt } : {}),
    });
  }
  return out;
}

function cleanSection(changeId: string, value: unknown) {
  const s = (value || {}) as IncomingSection;
  const photos = cleanPhotos(changeId, s.photos);
  if (typeof photos === "string") return photos;
  const description =
    typeof s.description === "string" ? s.description.slice(0, CHANGE_DESCRIPTION_MAX + 1) : "";
  return { description, photos };
}

/**
 * „Wyślij" — nowa karta albo nowa wersja istniejącej.
 *
 * body: { change: {...}, acceptorIds: string[], sendKey: string }
 *
 * sendKey to klucz jednej próby wysyłki (formularz trzyma go do sukcesu).
 * Powtórzenie tego samego żądania po zerwanym połączeniu nie tworzy nowej
 * wersji i nie wysyła maili drugi raz.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;
  const user = auth.context.user;
  if (!canInitiateChanges(user)) return forbidden();

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Brak bazy." }, { status: 503 });
  }

  let body: { change?: Record<string, unknown>; acceptorIds?: unknown; sendKey?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "Nieprawidłowe żądanie." }, { status: 400 });
  }

  const input = body.change || {};
  const id = typeof input.id === "string" ? input.id.trim() : "";
  const sendKey = typeof body.sendKey === "string" ? body.sendKey.slice(0, 100) : "";
  if (!id || !/^[A-Za-z0-9_-]{4,80}$/.test(id) || !sendKey) {
    return NextResponse.json({ success: false, message: "Brak identyfikatora karty." }, { status: 400 });
  }

  const current = cleanSection(id, input.current);
  const target = cleanSection(id, input.target);
  if (typeof current === "string" || typeof target === "string") {
    return NextResponse.json(
      { success: false, message: typeof current === "string" ? current : target },
      { status: 400 }
    );
  }

  const name = typeof input.name === "string" ? input.name.trim() : "";
  const siteId = typeof input.siteId === "string" ? input.siteId : "";
  const problem = validateChangeContent({ name, siteId, current, target });
  if (problem) return NextResponse.json({ success: false, message: problem }, { status: 400 });

  // Plac i akceptujący — z bazy, nie z żądania.
  const { data: site } = await supabase
    .from("construction_sites")
    .select("id, name")
    .eq("id", siteId)
    .maybeSingle();
  if (!site) {
    return NextResponse.json({ success: false, message: "Nie ma takiego placu budowy." }, { status: 400 });
  }

  const requested = new Set(
    Array.isArray(body.acceptorIds) ? (body.acceptorIds as unknown[]).filter((x) => typeof x === "string") : []
  );
  const acceptors = (await loadAcceptors(supabase)).filter((a) => requested.has(a.id));
  if (acceptors.length === 0) {
    return NextResponse.json(
      { success: false, message: "Zaznacz co najmniej jednego akceptującego." },
      { status: 400 }
    );
  }

  const loc = (input.location || {}) as Record<string, unknown>;
  const location = {
    latitude: typeof loc.latitude === "number" ? loc.latitude : null,
    longitude: typeof loc.longitude === "number" ? loc.longitude : null,
    ...(typeof loc.accuracy === "number" ? { accuracy: loc.accuracy } : {}),
  };
  const knaRequired = Boolean(input.knaRequired);
  const now = new Date().toISOString();
  const authorName = `${user.firstName} ${user.lastName}`.trim();

  const content = {
    site_id: site.id,
    site_name: site.name,
    location,
    name,
    current_description: current.description,
    current_photos: current.photos,
    target_description: target.description,
    target_photos: target.photos,
    kna_required: knaRequired,
  };

  const existing = await loadChange(supabase, id);
  let version = 1;

  if (existing) {
    const row = existing.row;
    if (row.author_id !== user.id) {
      return NextResponse.json(
        { success: false, message: "Kartę może zmieniać wyłącznie jej autor." },
        { status: 403 }
      );
    }

    // Idempotencja: ta sama próba wysyłki już się udała.
    const { data: last } = await supabase
      .from(CHANGE_VERSIONS_TABLE)
      .select("snapshot")
      .eq("change_id", id)
      .eq("version", row.version)
      .maybeSingle();
    if ((last?.snapshot as { sendKey?: string } | undefined)?.sendKey === sendKey) {
      const change = await reloadChangeApp(supabase, id);
      return withRefreshedSession(
        NextResponse.json({ success: true, alreadySent: true, change, mail: [] }),
        auth.context
      );
    }

    if (row.locked_at) {
      return NextResponse.json(
        {
          success: false,
          message: "Karta ma już akceptację — jej treści nie można zmieniać.",
        },
        { status: 409 }
      );
    }

    version = row.version + 1;

    // Warunek na wersję i brak blokady — akceptacja oddana w tej samej chwili
    // wygrywa, a edycja dostaje 409 zamiast nadpisać zaakceptowaną treść.
    const { data: updated, error } = await supabase
      .from(CHANGES_TABLE)
      .update({
        ...content,
        version,
        status: "PENDING",
        version_sent_at: now,
        completed_at: null,
        final_email_sent_at: null,
        pdf_path: null,
        updated_at: now,
      })
      .eq("id", id)
      .eq("version", row.version)
      .is("locked_at", null)
      .select("id");
    if (error) {
      return NextResponse.json({ success: false, message: error.message }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Karta została w międzyczasie zaakceptowana albo zmieniona. Odśwież listę.",
        },
        { status: 409 }
      );
    }

    // Oczekujące decyzje starej wersji wygasają razem z linkami. Oddane zostają jako historia.
    await supabase
      .from(CHANGE_DECISIONS_TABLE)
      .update({ decision: "SUPERSEDED", token_hash: null, token_expires_at: now })
      .eq("change_id", id)
      .eq("decision", "PENDING");
  } else {
    const year = Number(getPolishCurrentDate().slice(0, 4));
    const { data: seq, error: seqError } = await supabase.rpc("next_project_change_seq", {
      p_year: year,
    });
    if (seqError || typeof seq !== "number") {
      return NextResponse.json(
        { success: false, message: `Nie udało się nadać numeru: ${seqError?.message || "brak"}` },
        { status: 500 }
      );
    }

    const { error } = await supabase.from(CHANGES_TABLE).insert({
      id,
      tenant_id: "tenant-sb-tech-poznan",
      number_year: year,
      number_seq: seq,
      number: formatChangeNumber(year, seq),
      ...content,
      status: "PENDING",
      version: 1,
      author_id: user.id,
      author_name: authorName,
      created_at: now,
      submitted_at: now,
      version_sent_at: now,
      updated_at: now,
    });
    if (error) {
      // Wyścig dwóch identycznych wysyłek — druga zobaczy kartę przy ponowieniu.
      return NextResponse.json(
        { success: false, message: `Nie udało się zapisać karty: ${error.message}` },
        { status: error.code === "23505" ? 409 : 500 }
      );
    }
  }

  await supabase.from(CHANGE_VERSIONS_TABLE).insert({
    change_id: id,
    version,
    snapshot: { ...content, acceptorIds: acceptors.map((a) => a.id), sendKey },
    sent_at: now,
    sent_by: user.id,
  });

  const decisionRows = acceptors.map((a) => ({
    id: newPrefixedId("dec"),
    change_id: id,
    version,
    acceptor_id: a.id,
    acceptor_name: a.name,
    acceptor_email: a.email,
    decision: "PENDING",
    created_at: now,
  }));
  const { error: decError } = await supabase.from(CHANGE_DECISIONS_TABLE).insert(decisionRows);
  if (decError) {
    return NextResponse.json(
      { success: false, message: `Nie udało się zapisać listy akceptujących: ${decError.message}` },
      { status: 500 }
    );
  }

  const change = (await reloadChangeApp(supabase, id)) as ProjectChange;

  // PDF karty jako załącznik zaproszenia. Awaria Chromium nie może blokować
  // obiegu — mail pójdzie wtedy bez załącznika, z linkiem do karty.
  let pdf: { fileName: string; buffer: Buffer } | null = null;
  try {
    pdf = await renderChangePdf(supabase, change);
  } catch (err) {
    console.error(`Karta ${id}: nie udało się złożyć PDF do zaproszeń:`, err);
  }

  const mail = [];
  for (const row of decisionRows) {
    const outcome = await issueInvitation(supabase, change, row, pdf);
    mail.push({ acceptorName: row.acceptor_name, ok: outcome.ok, message: outcome.message });
  }

  const fresh = await reloadChangeApp(supabase, id);
  return withRefreshedSession(
    NextResponse.json({ success: true, change: fresh, mail }),
    auth.context
  );
}
