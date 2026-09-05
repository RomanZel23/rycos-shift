import type { DailyReport, ReportType } from "@/types";
import { getPolishCurrentDate } from "./date-utils";

/**
 * Etap 4 — wykrywanie brakujących raportów.
 *
 * Powód: 2026-09-03 raport zakończenia prac nie powstał. Nie było wiersza
 * w bazie, pliku w buckecie ani wpisu w Resend, a zauważyliśmy to dopiero po
 * kilku dniach, kiedy nie dało się już nic odtworzyć — urządzenie zdążyło
 * nadpisać dane następnym dniem. Dzień pracy ma dwa dokumenty: odprawę BHP
 * rano i fotorelację po zmianie. Jeśli w archiwum jest tylko jeden z nich,
 * drugi albo nie powstał, albo utknął na urządzeniu — i o tym trzeba
 * powiedzieć od razu, a nie po tygodniu.
 *
 * Parowanie idzie po dacie ORAZ placu budowy. Ta sama data na dwóch budowach
 * to dwa niezależne dni pracy; parowanie po samej dacie ukrywałoby brak na
 * jednej budowie, gdy druga ma komplet.
 */

export interface ReportGap {
  /** YYYY-MM-DD */
  date: string;
  siteId: string;
  siteName: string;
  /** Którego dokumentu brakuje. */
  missing: ReportType;
  /** Raport, który dla tego dnia i placu jednak powstał — punkt zaczepienia. */
  presentReportId: string;
}

interface Options {
  /**
   * Dzisiejsza data (YYYY-MM-DD). Dzień bieżący jest pomijany, bo zmiana może
   * jeszcze trwać — fotorelacja powstaje dopiero po jej zakończeniu.
   */
  today?: string;
  /**
   * Ile dni wstecz sprawdzać. Bez ograniczenia ostrzeżenie o brakach z odległej
   * przeszłości wisiałoby w archiwum bez końca, a nic już z nim nie zrobimy.
   */
  lookbackDays?: number;
}

const DEFAULT_LOOKBACK_DAYS = 45;

/** Różnica w pełnych dniach między dwiema datami YYYY-MM-DD. */
function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.NaN;
  return Math.round((b - a) / 86_400_000);
}

export function findReportGaps(reports: DailyReport[], options: Options = {}): ReportGap[] {
  const today = options.today || getPolishCurrentDate();
  const lookback = options.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;

  interface Bucket {
    date: string;
    siteId: string;
    siteName: string;
    start?: DailyReport;
    end?: DailyReport;
  }

  const buckets = new Map<string, Bucket>();

  for (const report of reports || []) {
    if (!report) continue;
    const date = (report.date || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    // Dzień bieżący i wszystko po nim pomijamy — zmiana może jeszcze trwać.
    const age = daysBetween(date, today);
    if (!Number.isFinite(age) || age <= 0 || age > lookback) continue;

    const siteId = report.siteId || "";
    const key = `${date}|${siteId}`;
    const bucket = buckets.get(key) || {
      date,
      siteId,
      siteName: report.siteName || "Nieznany plac budowy",
      };
    // Nazwa placu bywa pusta w starszych rekordach — bierzemy pierwszą sensowną.
    if (!bucket.siteName && report.siteName) bucket.siteName = report.siteName;

    // Raport ze statusem FAILED też się liczy: dokument powstał, tylko nie
    // poszedł mailem. To inny problem niż brak dokumentu.
    if (report.reportType === "START_SHIFT") {
      if (!bucket.start) bucket.start = report;
    } else if (report.reportType === "END_SHIFT") {
      if (!bucket.end) bucket.end = report;
    }

    buckets.set(key, bucket);
  }

  const gaps: ReportGap[] = [];

  for (const bucket of buckets.values()) {
    // Komplet albo pusto — nie ma o czym mówić.
    if (bucket.start && bucket.end) continue;

    if (bucket.start && !bucket.end) {
      gaps.push({
        date: bucket.date,
        siteId: bucket.siteId,
        siteName: bucket.siteName,
        missing: "END_SHIFT",
        presentReportId: bucket.start.id,
      });
    } else if (bucket.end && !bucket.start) {
      gaps.push({
        date: bucket.date,
        siteId: bucket.siteId,
        siteName: bucket.siteName,
        missing: "START_SHIFT",
        presentReportId: bucket.end.id,
      });
    }
  }

  // Najświeższe braki na górze — te jeszcze da się uzupełnić z pamięci.
  return gaps.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return a.siteName.localeCompare(b.siteName, "pl");
  });
}

/** "2026-09-03" -> "03.09.2026" */
export function formatGapDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function missingLabel(missing: ReportType): string {
  return missing === "START_SHIFT" ? "raportu rozpoczęcia prac" : "fotorelacji końcowej";
}
