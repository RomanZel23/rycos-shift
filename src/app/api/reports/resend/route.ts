import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { requireUser, withRefreshedSession } from "@/lib/auth";
import { BUCKET_NAME } from "@/lib/storage-paths";
import { REPORTS_TABLE } from "@/lib/report-mapper";
import { resolveEmailConfig, sendReportEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ponowna wysyłka zarchiwizowanego raportu.
 *
 * Przyjmuje wyłącznie identyfikator. Wszystko inne — plik PDF, odbiorcy,
 * nadawca, klucz API — pochodzi z serwera. Wysyłany jest dokładnie ten sam
 * plik, który poszedł za pierwszym razem, a nie wygenerowany na nowo.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, message: "Baza danych nie jest skonfigurowana." },
      { status: 503 }
    );
  }

  let reportId = "";
  try {
    const body = await req.json();
    reportId = typeof body?.reportId === "string" ? body.reportId.trim() : "";
  } catch {
    reportId = "";
  }
  if (!reportId) {
    return NextResponse.json(
      { success: false, message: "Brak identyfikatora raportu." },
      { status: 400 }
    );
  }

  const { data: row } = await supabase
    .from(REPORTS_TABLE)
    .select(
      "id, report_type, report_date, report_time, site_name, foreman_name, pdf_file_name, pdf_path, legacy_pdf_base64"
    )
    .eq("id", reportId)
    .maybeSingle();

  if (!row) {
    return NextResponse.json(
      { success: false, message: "Nie znaleziono raportu w archiwum." },
      { status: 404 }
    );
  }

  // PDF może być zapisany na trzy sposoby, zależnie od wieku raportu:
  // publiczny URL CDN, /api/files?path=… albo base64 wprost w kolumnie.
  const path = row.pdf_path;
  let pdfBuffer: Buffer | null = null;
  let migratedPath: string | null = null;

  if (path) {
    const { data: file, error: downloadError } = await supabase.storage
      .from(BUCKET_NAME)
      .download(path);
    if (downloadError || !file) {
      return NextResponse.json(
        { success: false, message: `Nie udało się pobrać pliku PDF: ${downloadError?.message}` },
        { status: 500 }
      );
    }
    pdfBuffer = Buffer.from(await file.arrayBuffer());
  } else if (
    typeof row.legacy_pdf_base64 === "string" &&
    row.legacy_pdf_base64.startsWith("data:")
  ) {
    // Najstarsze raporty trzymają cały plik w kolumnie. Wysyłamy go, a przy okazji
    // przenosimy do bucketu, żeby wiersz przestał ważyć kilka megabajtów.
    const base64 = row.legacy_pdf_base64.split("base64,")[1] || "";
    pdfBuffer = Buffer.from(base64, "base64");

    const dateStr = String(row.report_date || "").replace(/[^0-9-]/g, "");
    const siteSlug = (row.site_name || "plac").replace(/[^a-zA-Z0-9_-]/g, "_");
    const legacyPath = `pdf/${dateStr}_${row.report_type}_${siteSlug}_${row.id}.pdf`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(legacyPath, new Uint8Array(pdfBuffer), {
        contentType: "application/pdf",
        upsert: true,
      });

    // Podmiana kolumny kasuje jedyny egzemplarz base64, więc robimy ją dopiero
    // po odczytaniu wgranego pliku z powrotem i porównaniu długości. Gdyby
    // cokolwiek poszło nie tak, wiersz zostaje nietknięty i raport dalej działa.
    if (!upErr) {
      const { data: verify } = await supabase.storage.from(BUCKET_NAME).download(legacyPath);
      if (verify) {
        const verifyBytes = (await verify.arrayBuffer()).byteLength;
        if (verifyBytes === pdfBuffer.length) {
          migratedPath = legacyPath;
        } else {
          console.warn(
            `Pomijam migrację ${row.id}: w buckecie ${verifyBytes} B, w kolumnie ${pdfBuffer.length} B.`
          );
        }
      }
    }
  }

  if (!pdfBuffer || pdfBuffer.length === 0) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Ten raport nie ma zapisanego pliku PDF. Wygeneruj go ponownie z formularza.",
      },
      { status: 409 }
    );
  }

  const reportType = row.report_type === "END_SHIFT" ? "END_SHIFT" : "START_SHIFT";
  const config = await resolveEmailConfig(supabase, reportType);
  const outcome = await sendReportEmail(
    config,
    {
      reportType,
      siteName: row.site_name || "",
      foremanName: row.foreman_name || "",
      date: String(row.report_date || ""),
      time: String(row.report_time || "").slice(0, 5),
      fileName: row.pdf_file_name || "",
    },
    pdfBuffer
  );

  // sent_at zostaje nietknięte — to moment złożenia raportu w terenie i ponowna
  // wysyłka go nie zmienia. Wcześniej było tu nadpisywane, przez co raport po
  // dosłaniu wyglądał, jakby powstał w chwili kliknięcia „Wyślij ponownie".
  // Datę samej wysyłki trzyma teraz email_sent_at.
  const resentAt = outcome.ok ? new Date().toISOString() : null;

  await supabase
    .from(REPORTS_TABLE)
    .update({
      status: outcome.ok ? "SENT" : "EMAIL_FAILED",
      sent_to_emails: outcome.ok ? outcome.recipients : [],
      // Przy nieudanej próbie nie ruszamy kolumny: jeśli mail poszedł kiedyś
      // wcześniej, ta data nadal jest prawdziwa.
      ...(resentAt ? { email_sent_at: resentAt } : {}),
      error_message: outcome.ok ? null : outcome.message,
      ...(migratedPath ? { pdf_path: migratedPath, legacy_pdf_base64: null } : {}),
    })
    .eq("id", reportId);

  return withRefreshedSession(
    NextResponse.json({
      success: outcome.ok,
      code: outcome.code,
      message: outcome.message,
      recipients: outcome.recipients,
    }),
    auth.context
  );
}
