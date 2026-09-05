import { test } from "node:test";
import assert from "node:assert/strict";
import { rowToDailyReport, dailyReportToRow } from "@/lib/report-mapper";
import type { ReportRow } from "@/lib/report-mapper";
import { formatPolishDateTimeShort } from "@/lib/date-utils";
import type { DailyReport } from "@/types";

function row(extra: Partial<ReportRow> = {}): ReportRow {
  return {
    id: "rep-end-1",
    tenant_id: "tenant-sb-tech-poznan",
    report_type: "END_SHIFT",
    report_date: "2026-09-05",
    report_time: "16:12:00",
    site_id: "site-a",
    site_name: "Poznań - Piątkowo",
    foreman_id: "f1",
    foreman_name: "Jan Kowalski",
    location: { latitude: 52.4, longitude: 16.9 },
    discussed_topics: null,
    attendance: null,
    photos: [{ id: "p1", path: "photos/p1.jpg", description: "wykop", takenAt: "" }],
    pdf_file_name: "raport.pdf",
    pdf_path: "pdf/raport.pdf",
    sent_to_emails: ["a@b.pl"],
    sent_at: "2026-09-05T14:12:00.000Z",
    email_sent_at: "2026-09-05T14:12:04.000Z",
    status: "SENT",
    error_message: null,
    created_by: "u1",
    created_by_name: "Jan Kowalski",
    ...extra,
  };
}

test("data wysyłki maila wychodzi z wiersza do raportu", () => {
  const report = rowToDailyReport(row());
  assert.equal(report.emailSentAt, "2026-09-05T14:12:04.000Z");
  // sent_at to moment złożenia raportu — to dwie różne rzeczy.
  assert.equal(report.sentAt, "2026-09-05T14:12:00.000Z");
});

test("brak daty wysyłki daje undefined, nie pusty napis", () => {
  const report = rowToDailyReport(row({ email_sent_at: null, status: "EMAIL_FAILED" }));
  assert.equal(report.emailSentAt, undefined);
  assert.equal(report.status, "EMAIL_FAILED");
});

test("zapis stawia kolumnę tylko wtedy, gdy podano datę", () => {
  const report = rowToDailyReport(row());

  const zData = dailyReportToRow(report, {
    pdfPath: "pdf/raport.pdf",
    status: "SENT",
    sentToEmails: ["a@b.pl"],
    emailSentAt: "2026-09-05T14:12:04.000Z",
  });
  assert.equal(zData.email_sent_at, "2026-09-05T14:12:04.000Z");

  // Pominięcie pola NIE może dopisać kolumny do zapytania — inaczej ponowny
  // upsert raportu z kolejki offline wyzerowałby prawdziwą datę wysyłki.
  const bezPola = dailyReportToRow(report, {
    pdfPath: "pdf/raport.pdf",
    status: "FAILED",
    sentToEmails: [],
  });
  assert.ok(!("email_sent_at" in bezPola));

  // Jawny null kasuje datę świadomie.
  const zNullem = dailyReportToRow(report, {
    pdfPath: "pdf/raport.pdf",
    status: "EMAIL_FAILED",
    sentToEmails: [],
    emailSentAt: null,
  });
  assert.equal(zNullem.email_sent_at, null);
});

test("ścieżki w buckecie nie zamieniają się w URL-e przy zapisie", () => {
  const report = rowToDailyReport(row());
  assert.equal(report.photoDocumentation?.[0].photoDataUrl, "/api/files?path=photos%2Fp1.jpg");
  const back = dailyReportToRow(report, {
    pdfPath: "pdf/raport.pdf",
    status: "SENT",
    sentToEmails: [],
  });
  assert.deepEqual(back.photos[0], {
    id: "p1",
    path: "photos/p1.jpg",
    description: "wykop",
    takenAt: "",
  });
});

test("godzina wysyłki pokazuje się w polskiej strefie, bez sekund", () => {
  // 14:12 UTC w sierpniu/wrześniu to 16:12 w Warszawie (CEST).
  assert.equal(formatPolishDateTimeShort("2026-09-05T14:12:04.000Z"), "05.09.2026, 16:12");
  // Zima: UTC+1.
  assert.equal(formatPolishDateTimeShort("2026-01-05T14:12:04.000Z"), "05.01.2026, 15:12");
});

test("brak lub śmieć zamiast daty nie wywala widoku", () => {
  for (const value of ["", null, undefined, "nie-data"]) {
    assert.equal(formatPolishDateTimeShort(value as string | null), "");
  }
});

test("raport bez daty wysyłki nadal jest poprawnym DailyReport", () => {
  const report: DailyReport = rowToDailyReport(row({ email_sent_at: null }));
  assert.equal(report.id, "rep-end-1");
  assert.equal(formatPolishDateTimeShort(report.emailSentAt), "");
});
