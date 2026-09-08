import { NextRequest, NextResponse } from "next/server";
import { requireUser, withRefreshedSession } from "@/lib/auth";
import { ensureReportPdf } from "@/lib/report-pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pobranie dokumentu raportu z archiwum.
 *
 * Istnieje dla raportów dosłanych z kolejki offline, które nigdy nie dostały
 * PDF-a: /api/files potrafi oddać wyłącznie plik, który już leży w buckecie.
 * Tutaj dokument w razie potrzeby powstaje z danych raportu i zostaje
 * zarchiwizowany, więc kolejne pobranie idzie już zwykłą drogą.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;

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

  const res = new NextResponse(new Uint8Array(pdf.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.buffer.length),
      // Nazwa w dwóch postaciach: ASCII dla starszych klientów i UTF-8 dla reszty.
      "Content-Disposition": `attachment; filename="${pdf.fileName}"; filename*=UTF-8''${encodeURIComponent(pdf.fileName)}`,
      "Cache-Control": "no-store",
    },
  });
  return withRefreshedSession(res, auth.context);
}
