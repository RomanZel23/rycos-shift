import {
  AttendanceRecord,
  DailyReport,
  PhotoDocumentationItem,
  ReportType,
} from "@/types";
import { storagePathFromRef, toAppFileUrl } from "./storage-paths";

/**
 * Etap 2b — jedyne miejsce, w którym tłumaczymy między tabelą public.reports
 * a kształtem DailyReport używanym przez aplikację.
 *
 * Zasada, której pilnuje też CHECK w bazie: w bazie leżą WYŁĄCZNIE ścieżki
 * w buckecie (`pdf/…`, `photos/…`, `signatures/…`). Adresy `/api/files?path=…`
 * powstają dopiero tutaj, przy odczycie. Dzięki temu nie da się powtórzyć
 * sytuacji, w której jedna kolumna trzyma trzy różne formaty.
 */

export const REPORTS_TABLE = "reports";

export const REPORT_COLUMNS =
  "id, tenant_id, report_type, report_date, report_time, site_id, site_name, " +
  "foreman_id, foreman_name, location, discussed_topics, attendance, photos, " +
  "pdf_file_name, pdf_path, legacy_pdf_base64, sent_to_emails, sent_at, status, " +
  "error_message, created_by, created_by_name, created_at";

interface AttendanceRow {
  id?: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  isForeman?: boolean;
  signaturePath?: string;
  signatureInline?: string;
  signedAt?: string;
}

interface PhotoRow {
  id?: string;
  path?: string;
  inline?: string;
  description?: string;
  takenAt?: string;
}

export interface ReportRow {
  id: string;
  tenant_id: string;
  report_type: string;
  report_date: string;
  report_time: string;
  site_id: string | null;
  site_name: string;
  foreman_id: string | null;
  foreman_name: string;
  location: DailyReport["location"] | null;
  discussed_topics: string[] | null;
  attendance: AttendanceRow[] | null;
  photos: PhotoRow[] | null;
  pdf_file_name: string;
  pdf_path: string | null;
  legacy_pdf_base64?: string | null;
  sent_to_emails: string[] | null;
  sent_at: string | null;
  status: string;
  error_message: string | null;
  created_by: string | null;
  created_by_name: string | null;
  created_at?: string | null;
}

/** Postgres oddaje time jako HH:MM:SS, aplikacja operuje na HH:MM. */
function trimTime(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 5);
}

/** Ścieżka w buckecie -> adres serwowany przez aplikację. */
function refFromStorage(path?: string | null, inline?: string | null): string {
  if (path) return toAppFileUrl(path);
  if (inline) return inline;
  return "";
}

export function rowToDailyReport(row: ReportRow): DailyReport {
  const attendanceList: AttendanceRecord[] = (row.attendance || []).map((a, idx) => ({
    id: a.id || `att-${idx}`,
    userId: a.userId || "",
    userName: a.userName || "",
    userRole: a.userRole || "",
    isForeman: Boolean(a.isForeman),
    signatureDataUrl: refFromStorage(a.signaturePath, a.signatureInline),
    signedAt: a.signedAt || "",
  }));

  const photoDocumentation: PhotoDocumentationItem[] = (row.photos || []).map((p, idx) => ({
    id: p.id || `photo-${idx}`,
    photoDataUrl: refFromStorage(p.path, p.inline),
    description: p.description || "",
    takenAt: p.takenAt || "",
  }));

  return {
    id: row.id,
    tenantId: row.tenant_id,
    reportType: row.report_type as ReportType,
    date: row.report_date,
    time: trimTime(row.report_time),
    siteId: row.site_id || "",
    siteName: row.site_name,
    foremanId: row.foreman_id || "",
    foremanName: row.foreman_name,
    location: row.location || { latitude: null, longitude: null },
    discussedTopics: row.discussed_topics || [],
    attendanceList,
    photoDocumentation,
    pdfFileName: row.pdf_file_name,
    // Najstarsze raporty mogą jeszcze mieć PDF w kolumnie — do czasu backfillu.
    pdfDataUrl: row.pdf_path
      ? toAppFileUrl(row.pdf_path)
      : row.legacy_pdf_base64 || undefined,
    sentToEmails: row.sent_to_emails || [],
    sentAt: row.sent_at || "",
    status: (row.status as DailyReport["status"]) || "SENT",
    errorMessage: row.error_message || undefined,
    createdBy: row.created_by || undefined,
    createdByName: row.created_by_name || undefined,
  };
}

export interface RowBuildExtras {
  /** Ścieżka w buckecie albo null — pusty string złamałby CHECK w bazie. */
  pdfPath: string | null;
  status: DailyReport["status"];
  sentToEmails: string[];
  errorMessage?: string | null;
  createdBy?: string;
  createdByName?: string;
}

/**
 * DailyReport (po wgraniu mediów do bucketu) -> wiersz tabeli reports.
 *
 * Wszystko, co nie da się sprowadzić do ścieżki w buckecie, ląduje w polu
 * `inline`. Dla nowych raportów nie powinno się to zdarzać — upload idzie
 * przed zapisem — ale wolimy zapisać raport z base64 niż stracić podpis.
 */
export function dailyReportToRow(report: DailyReport, extras: RowBuildExtras) {
  const attendance: AttendanceRow[] = (report.attendanceList || []).map((a) => {
    const path = storagePathFromRef(a.signatureDataUrl);
    return {
      id: a.id,
      userId: a.userId,
      userName: a.userName,
      userRole: a.userRole,
      isForeman: Boolean(a.isForeman),
      ...(path
        ? { signaturePath: path }
        : a.signatureDataUrl
        ? { signatureInline: a.signatureDataUrl }
        : {}),
      signedAt: a.signedAt,
    };
  });

  const photos: PhotoRow[] = (report.photoDocumentation || []).map((p) => {
    const path = storagePathFromRef(p.photoDataUrl);
    return {
      id: p.id,
      ...(path ? { path } : p.photoDataUrl ? { inline: p.photoDataUrl } : {}),
      description: p.description,
      takenAt: p.takenAt,
    };
  });

  return {
    id: report.id,
    tenant_id: report.tenantId || "tenant-sb-tech-poznan",
    report_type: report.reportType,
    report_date: report.date,
    report_time: report.time,
    site_id: report.siteId || null,
    site_name: report.siteName,
    foreman_id: report.foremanId || null,
    foreman_name: report.foremanName,
    location: report.location || {},
    discussed_topics: report.discussedTopics || [],
    attendance,
    photos,
    pdf_file_name: report.pdfFileName,
    pdf_path: extras.pdfPath || null,
    sent_to_emails: extras.sentToEmails,
    sent_at: new Date().toISOString(),
    status: extras.status,
    error_message: extras.errorMessage ?? null,
    created_by: extras.createdBy ?? null,
    created_by_name: extras.createdByName ?? null,
    updated_at: new Date().toISOString(),
  };
}
