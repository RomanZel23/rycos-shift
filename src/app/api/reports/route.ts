import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { requireUser, withRefreshedSession } from "@/lib/auth";
import { optimizeReportForStorage } from "@/lib/supabase-storage";
import { toAppFileUrl } from "@/lib/storage-paths";
import { resolveEmailConfig, sendReportEmail } from "@/lib/email";
import { sanitizePdfFileName } from "@/lib/pdf-generator";
import { DailyReport } from "@/types";
import { REPORTS_TABLE, dailyReportToRow } from "@/lib/report-mapper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PDF_BYTES = 25 * 1024 * 1024;

/**
 * Etap 2 — jedyna droga zapisu raportu.
 *
 * Zmiany względem starego przepływu (/api/send-report + /api/db/sync):
 *   - PDF przychodzi jako binarny part multipart, a nie base64 data URL.
 *     Poprzednio ten sam plik jechał trzy razy: mailem, do localStorage i do
 *     bazy, rozbijając limit ciała żądania i limit localStorage.
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

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { success: false, message: "Nieprawidłowe żądanie (oczekiwano multipart/form-data)." },
      { status: 400 }
    );
  }

  const rawPayload = form.get("payload");
  const pdfPart = form.get("pdf");

  if (typeof rawPayload !== "string") {
    return NextResponse.json(
      { success: false, message: "Brak danych raportu." },
      { status: 400 }
    );
  }

  let report: DailyReport;
  try {
    report = JSON.parse(rawPayload);
  } catch {
    return NextResponse.json(
      { success: false, message: "Nieprawidłowy format danych raportu." },
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

  if (!(pdfPart instanceof Blob)) {
    return NextResponse.json(
      { success: false, message: "Brak pliku PDF raportu." },
      { status: 400 }
    );
  }
  if (pdfPart.size > MAX_PDF_BYTES) {
    return NextResponse.json(
      {
        success: false,
        message: `Plik PDF jest za duży (${Math.round(pdfPart.size / 1024 / 1024)} MB, limit ${
          MAX_PDF_BYTES / 1024 / 1024
        } MB).`,
      },
      { status: 413 }
    );
  }

  const pdfBuffer = Buffer.from(await pdfPart.arrayBuffer());

  // Autor raportu bierze się z sesji, nie z żądania.
  const authorId = auth.context.user.id;
  const authorName = `${auth.context.user.firstName} ${auth.context.user.lastName}`.trim();

  // 1. PDF do prywatnego bucketu
  const dateStr = (report.date || "").replace(/[^0-9-]/g, "");
  const siteSlug = (report.siteName || "plac").replace(/[^a-zA-Z0-9_-]/g, "_");
  const pdfPath = `pdf/${dateStr}_${report.reportType}_${siteSlug}_${report.id}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from("rycos-reports")
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

  // 2. Podpisy i zdjęcia (nadal base64 w payloadzie) też lądują w buckecie
  const optimized = await optimizeReportForStorage({
    ...report,
    pdfDataUrl: undefined,
  });
  optimized.pdfDataUrl = toAppFileUrl(pdfPath);
  optimized.pdfFileName =
    report.pdfFileName || sanitizePdfFileName(`${report.date}_${report.reportType}_${siteSlug}`);

  // 3. Wysyłka — konfiguracja wyłącznie z serwera
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

  // 4. Zapis wiersza. Kształt buduje mapper — w bazie lądują wyłącznie
  // ścieżki w buckecie, czego pilnuje też CHECK na kolumnie pdf_path.
  const { error: dbError } = await supabase.from(REPORTS_TABLE).upsert(
    dailyReportToRow(optimized, {
      pdfPath,
      status,
      sentToEmails: outcome.ok ? outcome.recipients : [],
      errorMessage: outcome.ok ? null : outcome.message,
      createdBy: authorId,
      createdByName: authorName,
    }),
    { onConflict: "id" }
  );

  if (dbError) {
    return NextResponse.json(
      { success: false, message: `Nie udało się zapisać raportu: ${dbError.message}` },
      { status: 500 }
    );
  }

  const saved: DailyReport = {
    ...optimized,
    status,
    sentToEmails: outcome.ok ? outcome.recipients : [],
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
