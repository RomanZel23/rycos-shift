import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { requireUser, withRefreshedSession } from "@/lib/auth";
import { optimizeReportForStorage } from "@/lib/supabase-storage";
import { BUCKET_NAME, storagePathFromRef, toAppFileUrl } from "@/lib/storage-paths";
import { generateEndShiftHtml, generateStartShiftHtml } from "@/lib/pdf-html-templates";
import { renderHtmlToPdf, BrowserLaunchError } from "@/lib/pdf-renderer";
import { loadExoFontFaceCss, loadLogoDataUrl, mediaAsDataUrls } from "@/lib/pdf-assets";
import { resolveEmailConfig, sendReportEmail } from "@/lib/email";
import { sanitizePdfFileName, slugifyForFileName } from "@/lib/pdf-generator";
import { DailyReport } from "@/types";
import {
  REPORTS_TABLE,
  REPORT_COLUMNS,
  dailyReportToRow,
  rowToDailyReport,
} from "@/lib/report-mapper";
import type { ReportRow } from "@/lib/report-mapper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Etap 2 — jedyna droga zapisu raportu.
 *
 * Zmiany względem starego przepływu (/api/send-report + /api/db/sync):
 *   - PDF nie przychodzi w ogóle — generuje go Chromium na serwerze (Etap 3).
 *     Wcześniej ten sam plik jechał trzy razy: mailem, do localStorage i do
 *     bazy, rozbijając limit ciała żądania i limit localStorage. Telefon
 *     w terenie przestaje renderować dokument.
 *   - Odbiorcy, nadawca i klucz Resend pochodzą wyłącznie z serwera.
 *   - Status jest prawdziwy: nieudana wysyłka daje EMAIL_FAILED, a nie „SENT".
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, message: "Baza danych nie jest skonfigurowana." },
      { status: 503 }
    );
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, message: "Baza danych nie jest skonfigurowana." },
      { status: 503 }
    );
  }

  let report: DailyReport;
  try {
    const body = await req.json();
    report = body?.report;
  } catch {
    return NextResponse.json(
      { success: false, message: "Nieprawidłowy format żądania." },
      { status: 400 }
    );
  }

  if (!report?.id || !report?.reportType || !report?.date) {
    return NextResponse.json(
      { success: false, message: "Niekompletne dane raportu." },
      { status: 400 }
    );
  }
  if (report.reportType !== "START_SHIFT" && report.reportType !== "END_SHIFT") {
    return NextResponse.json(
      { success: false, message: "Nieznany typ raportu." },
      { status: 400 }
    );
  }

  // Autor raportu bierze się z sesji, nie z żądania.
  const authorId = auth.context.user.id;
  const authorName = `${auth.context.user.firstName} ${auth.context.user.lastName}`.trim();

  // Idempotencja. Telefon przy słabym zasięgu potrafi nie doczekać odpowiedzi,
  // choć serwer raport zapisał i wysłał. Ponowne złożenie tego samego raportu
  // (formularz trzyma ten sam identyfikator między próbami) nie może wysłać
  // drugiego maila ani nadpisać wiersza — oddajemy to, co już jest w bazie.
  // Raport zapisany wcześniej bez wysyłki (FAILED / EMAIL_FAILED) przechodzi
  // dalej i zostaje uzupełniony o PDF i mail.
  const { data: existing } = await supabase
    .from(REPORTS_TABLE)
    .select(REPORT_COLUMNS)
    .eq("id", report.id)
    .maybeSingle();

  if (existing && (existing as unknown as ReportRow).status === "SENT") {
    const already = rowToDailyReport(existing as unknown as ReportRow);
    return withRefreshedSession(
      NextResponse.json({
        success: true,
        emailSent: true,
        emailCode: "SENT",
        alreadySaved: true,
        message: "Ten raport był już zapisany i wysłany — nie wysyłam go drugi raz.",
        report: already,
      }),
      auth.context
    );
  }

  const dateStr = (report.date || "").replace(/[^0-9-]/g, "");
  const siteSlug = slugifyForFileName(report.siteName, "plac");

  // 1. Podpisy i zdjęcia do prywatnego bucketu (przychodzą jako base64)
  const optimized = await optimizeReportForStorage({ ...report, pdfDataUrl: undefined });
  // Nazwa z urządzenia też przechodzi przez sanityzator — trafia do nagłówka
  // Content-Disposition i do nazwy załącznika.
  optimized.pdfFileName = report.pdfFileName
    ? sanitizePdfFileName(report.pdfFileName)
    : sanitizePdfFileName(
      `${report.date}_${
        report.reportType === "START_SHIFT"
          ? "Rozpoczecie_prac_zespolu"
          : "Zakonczenie_prac_zespolu"
      }_${siteSlug}`
    );

  // 2. Render dokumentu przez Chromium.
  // Obrazy muszą być wstawione jako data URL — renderer nie ma dostępu do sieci.
  let pdfBuffer: Buffer;
  try {
    const [forRender, logoDataUrl, fontCss] = await Promise.all([
      mediaAsDataUrls(optimized),
      loadLogoDataUrl(),
      loadExoFontFaceCss(),
    ]);
    const html =
      report.reportType === "START_SHIFT"
        ? generateStartShiftHtml(forRender, fontCss)
        : generateEndShiftHtml(forRender, fontCss);

    pdfBuffer = await renderHtmlToPdf(html, {
      documentName: `${
        report.reportType === "START_SHIFT" ? "Rozpoczęcie prac" : "Zakończenie prac"
      } — ${report.siteName} — ${report.date}`,
      logoDataUrl,
    });
  } catch (err) {
    console.error("PDF render error:", err);

    // Awaria samej przeglądarki ma własny, krótki komunikat. Wcześniej na
    // telefon brygadzisty trafiał surowy stderr Chromium razem ze ścieżkami
    // wewnętrznymi i linkiem do dokumentacji puppeteera — nieczytelne dla
    // niego i niepotrzebnie odsłaniające budowę serwera.
    if (err instanceof BrowserLaunchError) {
      return NextResponse.json({ success: false, message: err.message }, { status: 503 });
    }

    const message = err instanceof Error ? err.message : "nieznany błąd";
    return NextResponse.json(
      { success: false, message: `Nie udało się wygenerować dokumentu PDF: ${message}` },
      { status: 500 }
    );
  }

  const pdfPath = `pdf/${dateStr}_${report.reportType}_${siteSlug}_${report.id}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(pdfPath, new Uint8Array(pdfBuffer), {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json(
      { success: false, message: `Nie udało się zapisać PDF: ${uploadError.message}` },
      { status: 500 }
    );
  }

  optimized.pdfDataUrl = toAppFileUrl(pdfPath);

  const rowExtras = {
    pdfPath,
    createdBy: authorId,
    createdByName: authorName,
  };

  // 3. Zapis wiersza PRZED wysyłką maila. Wcześniej kolejność była odwrotna:
  // gdy mail poszedł, a zapis w bazie padł, telefon dostawał błąd, trzymał
  // raport jako niedosłany, a potem ktoś wysyłał go drugi raz z Archiwum.
  // Status do czasu potwierdzenia z Resend to EMAIL_FAILED — jeśli proces
  // padnie w trakcie, archiwum pokaże prawdę: mail niepotwierdzony.
  const { error: dbError } = await supabase.from(REPORTS_TABLE).upsert(
    dailyReportToRow(optimized, {
      ...rowExtras,
      status: "EMAIL_FAILED",
      sentToEmails: [],
      emailSentAt: null,
      errorMessage: "Wysyłka e-mail w toku albo niepotwierdzona.",
    }),
    { onConflict: "id" }
  );

  if (dbError) {
    return NextResponse.json(
      { success: false, message: `Nie udało się zapisać raportu: ${dbError.message}` },
      { status: 500 }
    );
  }

  // 4. Wysyłka — konfiguracja wyłącznie z serwera
  const config = await resolveEmailConfig(supabase, report.reportType);
  const outcome = await sendReportEmail(
    config,
    {
      reportType: report.reportType,
      siteName: report.siteName || "",
      foremanName: report.foremanName || "",
      date: report.date,
      time: report.time || "",
      fileName: optimized.pdfFileName,
    },
    pdfBuffer
  );

  const status: DailyReport["status"] = outcome.ok ? "SENT" : "EMAIL_FAILED";
  // Znacznik stawiamy TYLKO przy udanej wysyłce. Dla nieudanej zostaje null,
  // żeby „brak daty" jednoznacznie znaczyło „mail nie poszedł".
  const emailSentAt = outcome.ok ? new Date().toISOString() : null;

  // 5. Aktualizacja statusu po odpowiedzi Resend. Mail już poszedł (albo nie),
  // więc nieudana aktualizacja nie może zamienić sukcesu w błąd — wiersz
  // zostaje wtedy z EMAIL_FAILED i da się go sprawdzić w logach.
  const { error: statusError } = await supabase
    .from(REPORTS_TABLE)
    .update({
      status,
      sent_to_emails: outcome.ok ? outcome.recipients : [],
      email_sent_at: emailSentAt,
      error_message: outcome.ok ? null : outcome.message,
      updated_at: new Date().toISOString(),
    })
    .eq("id", report.id);

  if (statusError) {
    console.error(
      `Raport ${report.id}: nie udało się zapisać statusu wysyłki (${status}):`,
      statusError.message
    );
  }

  const saved: DailyReport = {
    ...optimized,
    status,
    sentToEmails: outcome.ok ? outcome.recipients : [],
    emailSentAt: emailSentAt || undefined,
    errorMessage: outcome.ok ? undefined : outcome.message,
  };

  return withRefreshedSession(
    NextResponse.json({
      success: true,
      emailSent: outcome.ok,
      emailCode: outcome.code,
      message: outcome.message,
      report: saved,
    }),
    auth.context
  );
}
