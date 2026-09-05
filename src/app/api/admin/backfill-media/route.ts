import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { requireAdmin, withRefreshedSession } from "@/lib/auth";
import { BUCKET_NAME } from "@/lib/storage-paths";
import { REPORTS_TABLE } from "@/lib/report-mapper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Etap 2b — jednorazowe przeniesienie mediów z base64 do bucketu.
 *
 * Migracja 0004 przeniosła strukturę, ale z SQL-a nie da się wgrać pliku do
 * Storage. Ten endpoint domyka robotę: znajduje raporty, które nadal trzymają
 * PDF, podpisy albo zdjęcia jako base64 w kolumnie, wgrywa je do bucketu
 * i podmienia na ścieżki.
 *
 * Bezpieczeństwo danych: base64 jest kasowane z wiersza dopiero po wgraniu
 * pliku ORAZ odczytaniu go z powrotem i porównaniu długości. Jeśli cokolwiek
 * się nie zgadza, wiersz zostaje nietknięty i raport dalej działa na base64.
 *
 * GET  — raport co jest do zrobienia, bez żadnych zmian.
 * POST — wykonuje przeniesienie.
 */

interface Att {
  id?: string;
  userId?: string;
  signaturePath?: string;
  signatureInline?: string;
  [k: string]: unknown;
}
interface Photo {
  id?: string;
  path?: string;
  inline?: string;
  [k: string]: unknown;
}

function base64Payload(dataUrl: string): { bytes: Buffer; ext: string } {
  const commaIdx = dataUrl.indexOf("base64,");
  const raw = commaIdx >= 0 ? dataUrl.slice(commaIdx + 7) : "";
  const mime = /^data:([^;]+)/.exec(dataUrl)?.[1] || "";
  const ext = mime.includes("png")
    ? "png"
    : mime.includes("jpeg") || mime.includes("jpg")
    ? "jpg"
    : mime.includes("pdf")
    ? "pdf"
    : "bin";
  return { bytes: Buffer.from(raw, "base64"), ext };
}

function slug(value: string): string {
  return (value || "x").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("response" in auth) return auth.response;

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Brak bazy." }, { status: 503 });
  }

  const { data } = await supabase
    .from(REPORTS_TABLE)
    .select("id, report_date, legacy_pdf_base64, attendance, photos");

  let pdfs = 0;
  let signatures = 0;
  let photos = 0;
  for (const row of data || []) {
    if (row.legacy_pdf_base64) pdfs += 1;
    signatures += ((row.attendance || []) as Att[]).filter((a) => a.signatureInline).length;
    photos += ((row.photos || []) as Photo[]).filter((p) => p.inline).length;
  }

  return withRefreshedSession(
    NextResponse.json({
      success: true,
      pending: { pdfs, signatures, photos },
      message:
        pdfs + signatures + photos === 0
          ? "Nie ma nic do przeniesienia — wszystkie media są już w buckecie."
          : `Do przeniesienia: ${pdfs} plików PDF, ${signatures} podpisów, ${photos} zdjęć.`,
    }),
    auth.context
  );
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("response" in auth) return auth.response;

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Brak bazy." }, { status: 503 });
  }

  const { data: rows, error } = await supabase
    .from(REPORTS_TABLE)
    .select("id, report_type, report_date, site_name, legacy_pdf_base64, attendance, photos");

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  /** Wgrywa i weryfikuje odczytem. Zwraca ścieżkę albo null. */
  const put = async (dataUrl: string, path: string, contentType: string) => {
    const { bytes } = base64Payload(dataUrl);
    if (bytes.length === 0) return null;

    const { error: upErr } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, new Uint8Array(bytes), { contentType, upsert: true });
    if (upErr) return null;

    const { data: check } = await supabase.storage.from(BUCKET_NAME).download(path);
    if (!check) return null;
    if ((await check.arrayBuffer()).byteLength !== bytes.length) return null;

    return path;
  };

  const done = { pdfs: 0, signatures: 0, photos: 0 };
  const skipped: string[] = [];

  for (const row of rows || []) {
    const update: Record<string, unknown> = {};
    const dateStr = String(row.report_date || "").replace(/[^0-9-]/g, "");

    // 1. PDF
    if (typeof row.legacy_pdf_base64 === "string" && row.legacy_pdf_base64.startsWith("data:")) {
      const path = await put(
        row.legacy_pdf_base64,
        `pdf/${dateStr}_${row.report_type}_${slug(row.site_name)}_${row.id}.pdf`,
        "application/pdf"
      );
      if (path) {
        update.pdf_path = path;
        update.legacy_pdf_base64 = null;
        done.pdfs += 1;
      } else {
        skipped.push(`${row.id}: PDF`);
      }
    }

    // 2. Podpisy
    const attendance = (row.attendance || []) as Att[];
    if (attendance.some((a) => a.signatureInline)) {
      const next: Att[] = [];
      for (let i = 0; i < attendance.length; i++) {
        const a = attendance[i];
        if (typeof a.signatureInline === "string" && a.signatureInline.startsWith("data:")) {
          const path = await put(
            a.signatureInline,
            `signatures/${dateStr}_${slug(String(a.userId || i))}_${i}.png`,
            "image/png"
          );
          if (path) {
            const { signatureInline: _drop, ...rest } = a;
            next.push({ ...rest, signaturePath: path });
            done.signatures += 1;
            continue;
          }
          skipped.push(`${row.id}: podpis ${i}`);
        }
        next.push(a);
      }
      update.attendance = next;
    }

    // 3. Zdjęcia
    const photos = (row.photos || []) as Photo[];
    if (photos.some((p) => p.inline)) {
      const next: Photo[] = [];
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        if (typeof p.inline === "string" && p.inline.startsWith("data:")) {
          const { ext } = base64Payload(p.inline);
          const path = await put(
            p.inline,
            `photos/${dateStr}_${row.id}_photo_${i + 1}.${ext === "png" ? "png" : "jpg"}`,
            ext === "png" ? "image/png" : "image/jpeg"
          );
          if (path) {
            const { inline: _drop, ...rest } = p;
            next.push({ ...rest, path });
            done.photos += 1;
            continue;
          }
          skipped.push(`${row.id}: zdjęcie ${i + 1}`);
        }
        next.push(p);
      }
      update.photos = next;
    }

    if (Object.keys(update).length > 0) {
      update.updated_at = new Date().toISOString();
      const { error: updErr } = await supabase
        .from(REPORTS_TABLE)
        .update(update)
        .eq("id", row.id);
      if (updErr) skipped.push(`${row.id}: zapis wiersza — ${updErr.message}`);
    }
  }

  return withRefreshedSession(
    NextResponse.json({
      success: skipped.length === 0,
      moved: done,
      skipped,
      message:
        skipped.length === 0
          ? `Przeniesiono: ${done.pdfs} PDF, ${done.signatures} podpisów, ${done.photos} zdjęć. Nic nie zostało w base64.`
          : `Przeniesiono częściowo. Pominięte (dane zostały nietknięte): ${skipped.join("; ")}`,
    }),
    auth.context
  );
}
