import { test } from "node:test";
import assert from "node:assert/strict";
import { findReportGaps, formatGapDate } from "@/lib/report-gaps";
import type { DailyReport, ReportType } from "@/types";

/**
 * Regresja na stratę z 2026-09-03: fotorelacja końcowa nie powstała, a archiwum
 * milczało, bo pokazywało wyłącznie to, co w nim jest.
 */

const TODAY = "2026-09-10";

function report(
  date: string,
  reportType: ReportType,
  siteId = "site-a",
  extra: Partial<DailyReport> = {}
): DailyReport {
  return {
    id: `${reportType}-${date}-${siteId}`,
    tenantId: "t",
    reportType,
    date,
    time: reportType === "START_SHIFT" ? "07:00" : "16:00",
    siteId,
    siteName: siteId === "site-a" ? "Poznań - Piątkowo" : "Poznań - Franowo",
    foremanId: "f1",
    foremanName: "Jan Kowalski",
    location: { latitude: null, longitude: null },
    pdfFileName: "raport.pdf",
    sentToEmails: [],
    sentAt: `${date}T07:00:00.000Z`,
    status: "SENT",
    ...extra,
  } as DailyReport;
}

test("dzień z odprawą i bez fotorelacji jest zgłoszony", () => {
  const gaps = findReportGaps([report("2026-09-03", "START_SHIFT")], { today: TODAY });
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].date, "2026-09-03");
  assert.equal(gaps[0].missing, "END_SHIFT");
  assert.equal(gaps[0].siteName, "Poznań - Piątkowo");
});

test("dzień z kompletem dokumentów milczy", () => {
  const gaps = findReportGaps(
    [report("2026-09-02", "START_SHIFT"), report("2026-09-02", "END_SHIFT")],
    { today: TODAY }
  );
  assert.deepEqual(gaps, []);
});

test("dwie fotorelacje tego samego dnia to nadal komplet", () => {
  const gaps = findReportGaps(
    [
      report("2026-09-02", "START_SHIFT"),
      report("2026-09-02", "END_SHIFT", "site-a", { id: "end-1", time: "15:52" }),
      report("2026-09-02", "END_SHIFT", "site-a", { id: "end-2", time: "16:00" }),
    ],
    { today: TODAY }
  );
  assert.deepEqual(gaps, []);
});

test("brak odprawy przy istniejącej fotorelacji też jest zgłoszony", () => {
  const gaps = findReportGaps([report("2026-09-04", "END_SHIFT")], { today: TODAY });
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].missing, "START_SHIFT");
});

test("place budowy są rozliczane osobno", () => {
  const gaps = findReportGaps(
    [
      report("2026-09-05", "START_SHIFT", "site-a"),
      report("2026-09-05", "END_SHIFT", "site-a"),
      report("2026-09-05", "START_SHIFT", "site-b"),
    ],
    { today: TODAY }
  );
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].siteId, "site-b");
  assert.equal(gaps[0].missing, "END_SHIFT");
});

test("dzień bieżący jest pomijany, bo zmiana może trwać", () => {
  const gaps = findReportGaps([report(TODAY, "START_SHIFT")], { today: TODAY });
  assert.deepEqual(gaps, []);
});

test("data z przyszłości nie jest zgłaszana", () => {
  const gaps = findReportGaps([report("2026-09-30", "START_SHIFT")], { today: TODAY });
  assert.deepEqual(gaps, []);
});

test("braki starsze niż okno obserwacji wypadają z listy", () => {
  const stary = [report("2026-01-05", "START_SHIFT")];
  assert.deepEqual(findReportGaps(stary, { today: TODAY }), []);
  assert.equal(findReportGaps(stary, { today: TODAY, lookbackDays: 3650 }).length, 1);
});

test("raport ze statusem FAILED liczy się jako istniejący dokument", () => {
  const gaps = findReportGaps(
    [
      report("2026-09-06", "START_SHIFT"),
      report("2026-09-06", "END_SHIFT", "site-a", { status: "FAILED" }),
    ],
    { today: TODAY }
  );
  assert.deepEqual(gaps, []);
});

test("najświeższe braki są na górze", () => {
  const gaps = findReportGaps(
    [
      report("2026-09-01", "START_SHIFT"),
      report("2026-09-07", "START_SHIFT"),
      report("2026-09-04", "START_SHIFT"),
    ],
    { today: TODAY }
  );
  assert.deepEqual(
    gaps.map((g) => g.date),
    ["2026-09-07", "2026-09-04", "2026-09-01"]
  );
});

test("puste i uszkodzone dane nie wywracają wykrywania", () => {
  const brudne = [
    report("2026-09-03", "START_SHIFT"),
    { ...report("", "START_SHIFT"), date: "" },
    { ...report("nie-data", "END_SHIFT"), date: "nie-data" },
    null,
  ] as DailyReport[];
  const gaps = findReportGaps(brudne, { today: TODAY });
  assert.equal(gaps.length, 1);
  assert.equal(gaps[0].date, "2026-09-03");
  assert.deepEqual(findReportGaps([], { today: TODAY }), []);
});

test("formatGapDate pokazuje datę po polsku", () => {
  assert.equal(formatGapDate("2026-09-03"), "03.09.2026");
  assert.equal(formatGapDate("bzdura"), "bzdura");
});
