import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { forbidden, requireUser, withRefreshedSession } from "@/lib/auth";
import {
  CHANGE_COMMENT_MAX,
  CHANGE_SIGNATURE_MAX_BYTES,
  aggregateChangeStatus,
  changePdfPath,
  changeSignaturePath,
} from "@/lib/project-change";
import {
  CHANGES_TABLE,
  CHANGE_DECISIONS_TABLE,
  decodeImageDataUrl,
  loadChange,
  loadUserEmail,
  reloadChangeApp,
  uploadToBucket,
} from "@/lib/project-change-server";
import { renderChangePdf, sendChangeFinal, sendDecisionNotice } from "@/lib/project-change-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Decyzja akceptującego: Akceptuję / Odrzucam + podpis (+ komentarz).
 *
 * - Decyzja jest ostateczna: zapis idzie warunkiem decision = 'PENDING',
 *   więc drugiej decyzji dla tej samej wersji nie da się oddać.
 * - Znacznik czasu nadaje serwer.
 * - Pierwsza akceptacja blokuje treść karty (locked_at).
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;
  const user = auth.context.user;
  if (!user.canAcceptChanges) return forbidden("Nie masz kompetencji akceptacji zmian.");

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Brak bazy." }, { status: 503 });
  }

  let body: { changeId?: unknown; decision?: unknown; comment?: unknown; signatureDataUrl?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "Nieprawidłowe żądanie." }, { status: 400 });
  }

  const changeId = typeof body.changeId === "string" ? body.changeId : "";
  const decision =
    body.decision === "ACCEPTED" || body.decision === "REJECTED" ? body.decision : null;
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";
  if (!changeId || !decision) {
    return NextResponse.json({ success: false, message: "Brak decyzji." }, { status: 400 });
  }
  if (decision === "REJECTED" && !comment) {
    return NextResponse.json(
      { success: false, message: "Przy odrzuceniu komentarz jest obowiązkowy." },
      { status: 400 }
    );
  }
  if (comment.length > CHANGE_COMMENT_MAX) {
    return NextResponse.json({ success: false, message: "Komentarz jest za długi." }, { status: 400 });
  }

  const loaded = await loadChange(supabase, changeId);
  if (!loaded) {
    return NextResponse.json({ success: false, message: "Nie ma takiej karty." }, { status: 404 });
  }
  const { row } = loaded;
  const mine = loaded.decisions.find(
    (d) => d.version === row.version && d.acceptor_id === user.id
  );
  if (!mine) {
    return NextResponse.json(
      { success: false, message: "Nie jesteś akceptującym bieżącej wersji tej karty." },
      { status: 403 }
    );
  }
  if (mine.decision !== "PENDING") {
    return NextResponse.json(
      { success: false, message: "Decyzja została już oddana — jest ostateczna." },
      { status: 409 }
    );
  }

  const signature = decodeImageDataUrl(body.signatureDataUrl, ["image/png"], CHANGE_SIGNATURE_MAX_BYTES);
  if ("error" in signature) {
    return NextResponse.json(
      { success: false, message: `Podpis: ${signature.error}` },
      { status: 400 }
    );
  }
  const signaturePath = changeSignaturePath(changeId, row.version, user.id);
  const uploadError = await uploadToBucket(supabase, signaturePath, signature.bytes, "image/png");
  if (uploadError) {
    return NextResponse.json(
      { success: false, message: `Nie udało się zapisać podpisu: ${uploadError}` },
      { status: 500 }
    );
  }

  const decidedAt = new Date().toISOString();
  const { data: saved, error: saveError } = await supabase
    .from(CHANGE_DECISIONS_TABLE)
    .update({
      decision,
      comment: comment || null,
      signature_path: signaturePath,
      decided_at: decidedAt,
    })
    .eq("id", mine.id)
    .eq("decision", "PENDING")
    .select("id");
  if (saveError) {
    return NextResponse.json({ success: false, message: saveError.message }, { status: 500 });
  }
  if (!saved || saved.length === 0) {
    // Autor zmienił kartę w tej samej chwili (decyzja dostała SUPERSEDED)
    // albo decyzję oddano równolegle z innego urządzenia.
    return NextResponse.json(
      {
        success: false,
        message: "Nie zapisano decyzji — karta została zmieniona albo decyzja już jest oddana. Odśwież kartę.",
      },
      { status: 409 }
    );
  }

  if (decision === "ACCEPTED") {
    await supabase
      .from(CHANGES_TABLE)
      .update({ locked_at: decidedAt })
      .eq("id", changeId)
      .is("locked_at", null);
  }

  // Status zbiorczy z decyzji bieżącej wersji — liczony od nowa z bazy.
  const after = await loadChange(supabase, changeId);
  const currentDecisions = (after?.decisions || []).filter((d) => d.version === row.version);
  const { status, complete } = aggregateChangeStatus(currentDecisions);
  await supabase
    .from(CHANGES_TABLE)
    .update({
      status,
      ...(complete ? { completed_at: new Date().toISOString() } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", changeId)
    .eq("version", row.version);

  const change = await reloadChangeApp(supabase, changeId);
  const notices: string[] = [];

  if (change) {
    // Powiadomienie: autor + pozostali akceptujący bieżącej wersji.
    const authorEmail = await loadUserEmail(supabase, change.authorId);
    const others = currentDecisions
      .filter((d) => d.acceptor_id !== user.id)
      .map((d) => d.acceptor_email);
    const decided = change.decisions.find((d) => d.acceptorId === user.id);
    if (decided) {
      const notice = await sendDecisionNotice(
        supabase,
        change,
        decided,
        [authorEmail || "", ...others].filter((e) => e && e !== user.email)
      );
      if (!notice.ok) notices.push(`Powiadomienie o decyzji: ${notice.message}`);
    }

    // Komplet decyzji: PDF z podpisami do archiwum i do odbiorców z Ustawień.
    // Znacznik final_email_sent_at stawiamy warunkowo PRZED wysyłką, żeby dwie
    // równoczesne ostatnie decyzje nie wysłały dwóch maili.
    if (complete) {
      const { data: claimed } = await supabase
        .from(CHANGES_TABLE)
        .update({ final_email_sent_at: new Date().toISOString() })
        .eq("id", changeId)
        .eq("version", row.version)
        .is("final_email_sent_at", null)
        .select("id");

      if (claimed && claimed.length > 0) {
        try {
          const pdf = await renderChangePdf(supabase, change);
          const pdfPath = changePdfPath(changeId, row.version);
          const pdfUpload = await uploadToBucket(supabase, pdfPath, new Uint8Array(pdf.buffer), "application/pdf");
          if (!pdfUpload) {
            await supabase.from(CHANGES_TABLE).update({ pdf_path: pdfPath }).eq("id", changeId);
          }

          const { data: settings } = await supabase
            .from("tenant_settings")
            .select("*")
            .limit(1)
            .maybeSingle();
          const recipients: string[] = Array.isArray(settings?.change_email_recipients)
            ? (settings.change_email_recipients as unknown[]).filter(
                (x): x is string => typeof x === "string" && x.includes("@")
              )
            : [];

          if (recipients.length > 0) {
            const final = await sendChangeFinal(supabase, change, recipients, pdf);
            if (!final.ok) {
              notices.push(`Wysyłka karty z kompletem decyzji: ${final.message}`);
              await supabase
                .from(CHANGES_TABLE)
                .update({ final_email_sent_at: null })
                .eq("id", changeId);
            }
          } else {
            notices.push(
              "Komplet decyzji — brak listy odbiorców kart zmian w Ustawieniach, PDF zapisano tylko w archiwum."
            );
          }
        } catch (err) {
          console.error(`Karta ${changeId}: finalizacja nie powiodła się:`, err);
          notices.push("Nie udało się złożyć końcowego PDF — można go pobrać z archiwum później.");
          await supabase.from(CHANGES_TABLE).update({ final_email_sent_at: null }).eq("id", changeId);
        }
      }
    }
  }

  return withRefreshedSession(
    NextResponse.json({ success: true, change, notices }),
    auth.context
  );
}
