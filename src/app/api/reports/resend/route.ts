import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { requireUser, withRefreshedSession } from "@/lib/auth";
import { REPORTS_TABLE } from "@/lib/report-mapper";
import { resolveEmailConfig, sendReportEmail } from "@/lib/email";
import { ensureReportPdf } from "@/lib/report-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ponowna wysyłka raportu z archiwum.
 *
 * Przyjmuje wyłącznie identyfikator. Wszystko inne — plik PDF, odbiorcy,
 * nadawca, klucz API — pochodzi z serwera.
 *
 * Wysyłany jest zarchiwizowany egzemplarz dokumentu, a nie nowy. Wyjątkiem są
 * raporty dosłane z kolejki offline, które nigdy PDF-a nie dostały: dla nich
 * dokument powstaje przy pierwszej wysyłce i od razu ląduje w archiwum.
 * Szczegóły w src/lib/report-pdf.ts.
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

  const pdf = await ensureReportPdf(reportId);
  if (!pdf.ok) {
    return NextResponse.json({ success: false, message: pdf.message }, { status: pdf.status });
  }

  const row = pdf.row;
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
      fileName: pdf.fileName,
    },
    pdf.buffer
  );

  // sent_at zostaje nietknięte — to moment złożenia raportu w terenie i ponowna
  // wysyłka go nie zmienia. Wcześniej było tu nadpisywane, przez co raport po
  // dosłaniu wyglądał, jakby powstał w chwili kliknięcia „Wyślij ponownie".
  // Datę samej wysyłki trzyma email_sent_at.
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
    })
    .eq("id", reportId);

  return withRefreshedSession(
    NextResponse.json({
      success: outcome.ok,
      code: outcome.code,
      message: outcome.message,
      recipients: outcome.recipients,
      pdfWygenerowany: pdf.wygenerowanyTeraz,
    }),
    auth.context
  );
}
