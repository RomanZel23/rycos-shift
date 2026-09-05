"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Download,
  Eye,
  Search,
  Filter,
  CheckCircle2,
  X,
  Send,
  Camera,
  ZoomIn,
  ExternalLink,
  Maximize2,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import { DailyReport, TenantSettings } from "@/types";
import { sanitizePdfFileName } from "@/lib/pdf-generator";
import { formatPolishTime } from "@/lib/date-utils";
import { findReportGaps, formatGapDate, missingLabel } from "@/lib/report-gaps";

/** Dłuższa lista braków zamieniłaby ostrzeżenie w ścianę tekstu. */
const MAX_VISIBLE_GAPS = 6;

interface ReportArchiveProps {
  reports: DailyReport[];
  settings?: TenantSettings;
  onNewStartReport: () => void;
  onNewEndReport: () => void;
  onRefresh?: () => Promise<void>;
  isSyncing?: boolean;
  isSupabaseConnected?: boolean;
}

interface ZoomPhotoData {
  url: string;
  description: string;
  takenAt?: string;
  index: number;
  total: number;
}

export function ReportArchive({
  reports,
  settings,
  onNewStartReport,
  onNewEndReport,
  onRefresh,
  isSyncing = false,
  isSupabaseConnected = true,
}: ReportArchiveProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [previewReport, setPreviewReport] = useState<DailyReport | null>(null);
  const [zoomPhoto, setZoomPhoto] = useState<ZoomPhotoData | null>(null);

  // Stan ponownej wysyłki raportu mailem
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<{
    id: string;
    success: boolean;
    message: string;
  } | null>(null);

  // Zamykanie modali klawiszem Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (zoomPhoto) setZoomPhoto(null);
        else if (previewReport) setPreviewReport(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [zoomPhoto, previewReport]);

  const openPreviewReport = (report: DailyReport) => {
    setPreviewReport(report);
  };

  const closePreviewReport = () => {
    setPreviewReport(null);
  };

  const openZoomPhoto = (data: ZoomPhotoData) => {
    setZoomPhoto(data);
  };

  const closeZoomPhoto = () => {
    setZoomPhoto(null);
  };

  /**
   * Klucz sortowania: "RRRR-MM-DDTHH:mm". Oba pola są zerowane do stałej
   * szerokości, więc porównanie tekstowe daje poprawny porządek chronologiczny
   * bez parsowania dat.
   *
   * Sortujemy tutaj, a nie tylko w zapytaniu do bazy, bo lista w archiwum jest
   * sklejana z trzech źródeł: raportów właśnie dosłanych, wciąż czekających
   * lokalnie i tych z chmury. Kolejność z bazy dotyczy wyłącznie tej trzeciej
   * grupy.
   */
  const sortKey = (r: DailyReport): string => {
    const date = (r.date || "").slice(0, 10);
    const time = (r.time || "").slice(0, 5).padStart(5, "0");
    if (date) return `${date}T${time}`;
    return (r.sentAt || "").slice(0, 16);
  };

  const filteredReports = reports.filter((r) => {
    const matchesType =
      filterType === "ALL" || r.reportType === filterType;
    const matchesSearch =
      r.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.foremanName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.date.includes(searchTerm) ||
      (r.pdfFileName && r.pdfFileName.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesType && matchesSearch;
  }).sort((a, b) => sortKey(b).localeCompare(sortKey(a)));

  // Braki liczymy z pełnej listy, nie z przefiltrowanej — inaczej włączenie
  // filtra „Rozpoczęcie prac" zgłosiłoby brak fotorelacji w każdym dniu.
  const gaps = useMemo(() => findReportGaps(reports), [reports]);

  /**
   * Etap 3: pobieramy ZARCHIWIZOWANY plik, a nie generujemy nowego.
   *
   * Wcześniej każde kliknięcie „Pobierz" tworzyło dokument od nowa z danych
   * raportu. Dla protokołu z podpisami to problem dowodowy — pobrany PDF mógł
   * różnić się od tego, który poszedł mailem i został podpisany w terenie.
   */
  const handleDownload = async (report: DailyReport) => {
    if (!report.pdfDataUrl) {
      setResendStatus({
        id: report.id,
        success: false,
        message: "Ten raport nie ma zarchiwizowanego pliku PDF.",
      });
      return;
    }
    try {
      const res = await fetch(report.pdfDataUrl);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = sanitizePdfFileName(report.pdfFileName || `raport_${report.date}`);
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      setResendStatus({
        id: report.id,
        success: false,
        message: "Nie udało się pobrać dokumentu z archiwum.",
      });
    }
  };

  const handleResendEmail = async (report: DailyReport) => {
    try {
      setResendingId(report.id);
      setResendStatus(null);

      // Etap 2: wysyłamy wyłącznie identyfikator. Serwer bierze zarchiwizowany
      // plik PDF z bucketu i aktualną listę odbiorców z bazy — klient nie ma
      // już wpływu ani na treść załącznika, ani na to, kto go dostanie.
      const response = await fetch("/api/reports/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: report.id }),
      });
      const data = await response.json().catch(() => null);

      setResendStatus({
        id: report.id,
        success: Boolean(data?.success),
        message: data?.message || "Nie udało się ponowić wysyłki.",
      });

      if (data?.success && onRefresh) {
        onRefresh();
      }
    } catch {
      setResendStatus({
        id: report.id,
        success: false,
        message: "Brak połączenia z serwerem.",
      });
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-32 md:pb-20">
      {/* NAGŁÓWEK ARCHIWUM */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-5 border border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2.5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/25 text-sky-300 text-xs sm:text-sm font-black uppercase tracking-wider border border-sky-500/40">
              <FileText className="w-4 h-4" />
              <span>Repozytorium Raportów</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-bold">
              <span
                className={`w-2 h-2 rounded-full ${
                  isSupabaseConnected ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                }`}
              />
              <span className={isSupabaseConnected ? "text-emerald-300" : "text-amber-300"}>
                {isSupabaseConnected ? "Baza Supabase (Live)" : "Lokalna kopia"}
              </span>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Archiwum Raportów
          </h1>
          <p className="text-sm text-slate-300 font-semibold mt-1">
            Historia odpraw i fotorelacji z budów • Pliki PDF w Supabase Storage
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isSyncing}
              title="Pobierz najświeższe dane z bazy danych w chmurze"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-2xl border border-slate-700 shadow-md transition-all cursor-pointer active:scale-95 disabled:opacity-60"
            >
              <RefreshCw
                className={`w-4 h-4 ${
                  isSyncing ? "animate-spin text-sky-400" : "text-slate-300"
                }`}
              />
              <span className="hidden sm:inline">
                {isSyncing ? "Pobieranie..." : "Odśwież bazę"}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={onNewStartReport}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm rounded-2xl shadow-md shadow-sky-600/30 transition-all cursor-pointer active:scale-95"
          >
            <FileText className="w-4 h-4" />
            <span>Nowa Odprawa</span>
          </button>
          <button
            type="button"
            onClick={onNewEndReport}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-2xl shadow-md shadow-indigo-600/30 transition-all cursor-pointer active:scale-95"
          >
            <Camera className="w-4 h-4" />
            <span>Fotorelacja</span>
          </button>
        </div>
      </div>

      {/* BANER STATUSU PONOWNEJ WYSYŁKI MAILA */}
      {resendStatus && (
        <div
          className={`p-4 rounded-2xl border-2 flex items-center justify-between gap-3 animate-fade-in ${
            resendStatus.success
              ? "bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/60 dark:border-emerald-700 dark:text-emerald-200"
              : "bg-rose-50 border-rose-300 text-rose-900 dark:bg-rose-950/60 dark:border-rose-700 dark:text-rose-200"
          }`}
        >
          <div className="flex items-center gap-2.5 text-sm font-bold">
            {resendStatus.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
            )}
            <span>{resendStatus.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setResendStatus(null)}
            className="p-1 hover:bg-black/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* FILTROWANIE I WYSZUKIWANIE */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-3xl border-2 border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Szukaj po budowie, brygadziście, dacie..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setFilterType("ALL")}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex-shrink-0 ${
              filterType === "ALL"
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200"
            }`}
          >
            Wszystkie ({reports.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("START_SHIFT")}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex-shrink-0 ${
              filterType === "START_SHIFT"
                ? "bg-sky-600 text-white shadow-sm"
                : "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400 hover:bg-sky-100"
            }`}
          >
            Rozpoczęcie prac
          </button>
          <button
            type="button"
            onClick={() => setFilterType("END_SHIFT")}
            className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer flex-shrink-0 ${
              filterType === "END_SHIFT"
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-400 hover:bg-indigo-100"
            }`}
          >
            Fotorelacja końcowa
          </button>
        </div>
      </div>

      {/* BRAKUJĄCE RAPORTY — patrz src/lib/report-gaps.ts */}
      {gaps.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800 rounded-3xl p-5 sm:p-6 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-sm sm:text-base text-amber-900 dark:text-amber-100">
                {gaps.length === 1
                  ? "Jeden dzień ma niekompletną dokumentację"
                  : `${gaps.length} dni ma niekompletną dokumentację`}
              </h3>
              <p className="text-[11px] sm:text-xs text-amber-900/80 dark:text-amber-200/80 mt-0.5 leading-relaxed">
                Każdy dzień pracy powinien mieć odprawę BHP i fotorelację końcową. Poniżej dni,
                w których jest tylko jeden z tych dokumentów.
              </p>
            </div>
          </div>

          <ul className="space-y-1.5">
            {gaps.slice(0, MAX_VISIBLE_GAPS).map((gap) => (
              <li
                key={`${gap.date}|${gap.siteId}|${gap.missing}`}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs sm:text-sm bg-white/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-2xl px-3.5 py-2.5"
              >
                <span className="font-black text-amber-900 dark:text-amber-100 tabular-nums">
                  {formatGapDate(gap.date)}
                </span>
                <span className="font-bold text-amber-800/90 dark:text-amber-200/90">
                  {gap.siteName}
                </span>
                <span className="text-amber-900/70 dark:text-amber-200/70">
                  — brakuje {missingLabel(gap.missing)}
                </span>
              </li>
            ))}
          </ul>

          {gaps.length > MAX_VISIBLE_GAPS && (
            <p className="text-[11px] font-bold text-amber-900/70 dark:text-amber-200/70">
              …oraz {gaps.length - MAX_VISIBLE_GAPS} wcześniejszych.
            </p>
          )}
        </div>
      )}

      {/* LISTA RAPORTÓW */}
      {filteredReports.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-12 text-center space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center">
            <Filter className="w-8 h-8" />
          </div>
          <h3 className="font-black text-lg text-slate-800 dark:text-white">
            Brak raportów spełniających kryteria
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Nie znaleziono raportów w archiwum dla podanej frazy lub wybranego filtra.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => {
            const isStart = report.reportType === "START_SHIFT";
            return (
              <div
                key={report.id}
                className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-sm hover:shadow-md transition-all space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white shadow-md flex-shrink-0 ${
                        isStart ? "bg-sky-600" : "bg-indigo-600"
                      }`}
                    >
                      {isStart ? (
                        <FileText className="w-6 h-6" />
                      ) : (
                        <Camera className="w-6 h-6" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider ${
                            isStart
                              ? "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                              : "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                          }`}
                        >
                          {isStart ? "Rozpoczęcie prac" : "Zakończenie prac"}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          {report.date} | {report.time}
                        </span>
                      </div>
                      <h3 className="font-black text-lg text-slate-900 dark:text-white mt-1">
                        {report.siteName}
                      </h3>
                    </div>
                  </div>

                  {/* PRZYCISKI AKCJI DLA RAPORTU */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleResendEmail(report)}
                      disabled={resendingId === report.id}
                      title="Wyślij ten raport e-mailem ponownie"
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/70 dark:hover:bg-emerald-900/80 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs sm:text-sm font-bold border border-emerald-300 dark:border-emerald-800 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Send className={`w-3.5 h-3.5 ${resendingId === report.id ? "animate-spin" : ""}`} />
                      <span>{resendingId === report.id ? "Wysyłanie..." : "Wyślij e-mail"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openPreviewReport(report)}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-sky-500" />
                      <span>Szczegóły</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(report)}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-sky-50 hover:bg-sky-100 dark:bg-sky-950 dark:hover:bg-sky-900 text-sky-600 dark:text-sky-300 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Pobierz PDF</span>
                    </button>
                  </div>
                </div>

                {/* METADANE RAPORTU */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400 font-bold block">Brygadzista:</span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200 truncate block">
                      {report.foremanName}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-bold block">
                      {isStart ? "Obecnych pracowników:" : "Załączonych zdjęć:"}
                    </span>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200 block">
                      {isStart
                        ? `${report.attendanceList?.length || 0} osób z podpisem`
                        : `${report.photoDocumentation?.length || 0} fotografii`}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-bold block">Status wysyłki:</span>
                    <span className="inline-flex items-center gap-1 font-extrabold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Wysłano e-mail</span>
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 font-bold block">Plik raportu:</span>
                    <span className="font-mono text-[11px] text-slate-500 truncate block">
                      {report.pdfFileName}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL SZCZEGÓŁÓW RAPORTU */}
      {previewReport && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-fade-in">
            <div className="p-6 border-b-2 border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-black uppercase ${
                      previewReport.reportType === "START_SHIFT"
                        ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                        : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                    }`}
                  >
                    {previewReport.reportType === "START_SHIFT"
                      ? "Rozpoczęcie prac"
                      : "Fotorelacja końcowa"}
                  </span>
                  <span className="font-mono text-xs text-slate-400">
                    {previewReport.date} {previewReport.time}
                  </span>
                </div>
                <h3 className="font-black text-xl text-slate-900 dark:text-white mt-1">
                  {previewReport.siteName}
                </h3>
              </div>
              <button
                type="button"
                onClick={closePreviewReport}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl text-sm font-semibold border border-slate-200 dark:border-slate-700">
                <div>
                  <div className="text-xs text-slate-400">Plac Budowy:</div>
                  <div className="font-black text-slate-900 dark:text-white text-base">
                    {previewReport.siteName}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Brygadzista:</div>
                  <div className="font-black text-slate-900 dark:text-white text-base">
                    {previewReport.foremanName}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Data i Godzina:</div>
                  <div className="font-bold text-slate-800 dark:text-slate-200">
                    {previewReport.date} | {previewReport.time}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Koordynaty GPS:</div>
                  {previewReport.location?.latitude && previewReport.location?.longitude ? (
                    <a
                      href={`https://www.google.com/maps?q=${previewReport.location.latitude},${previewReport.location.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Kliknij, aby otworzyć lokalizację w Google Maps"
                      className="inline-flex items-center gap-1.5 font-mono text-xs text-sky-600 dark:text-sky-400 font-bold hover:underline cursor-pointer mt-0.5 group"
                    >
                      <span>
                        {previewReport.location.latitude.toFixed(5)}° N, {previewReport.location.longitude.toFixed(5)}° E
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                    </a>
                  ) : (
                    <div className="font-mono text-xs text-slate-500">
                      Brak danych GPS
                    </div>
                  )}
                </div>
              </div>

              {/* TEMATY BHP */}
              {previewReport.discussedTopics && previewReport.discussedTopics.length > 0 && (
                <div>
                  <h4 className="font-black text-sm uppercase tracking-wider text-slate-900 dark:text-white mb-2">
                    Omawiane Tematy BHP / Zadania:
                  </h4>
                  <ul className="space-y-2">
                    {previewReport.discussedTopics.map((topic, idx) => (
                      <li
                        key={idx}
                        className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                      >
                        {idx + 1}. {topic}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* LISTA OBECNOŚCI */}
              {previewReport.attendanceList && previewReport.attendanceList.length > 0 && (
                <div>
                  <h4 className="font-black text-sm uppercase tracking-wider text-slate-900 dark:text-white mb-2">
                    Lista Obecności i Podpisy:
                  </h4>
                  <div className="space-y-2">
                    {previewReport.attendanceList.map((att) => (
                      <div
                        key={att.id}
                        className="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-between border border-slate-200 dark:border-slate-700"
                      >
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white text-sm">
                            {att.userName}
                          </div>
                          <div className="text-xs text-slate-500 font-mono font-bold">
                            {att.userRole} • {formatPolishTime(att.signedAt || previewReport.time)}
                          </div>
                        </div>
                        <div className="bg-white border-2 border-slate-300 rounded-xl p-1 w-28 h-10 flex items-center justify-center overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={att.signatureDataUrl}
                            alt="Podpis"
                            className="max-h-full object-contain"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DOKUMENTACJA FOTOGRAFICZNA Z ZOOMEM */}
              {previewReport.photoDocumentation && previewReport.photoDocumentation.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-black text-sm uppercase tracking-wider text-slate-900 dark:text-white">
                      Dokumentacja Fotograficzna:
                    </h4>
                    <span className="text-[11px] font-bold text-sky-500 flex items-center gap-1">
                      <ZoomIn className="w-3.5 h-3.5" />
                      <span>Kliknij zdjęcie, aby powiększyć</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {previewReport.photoDocumentation.map((photo, idx) => (
                      <div
                        key={photo.id}
                        onClick={() =>
                          openZoomPhoto({
                            url: photo.photoDataUrl,
                            description: photo.description,
                            takenAt: photo.takenAt,
                            index: idx + 1,
                            total: previewReport.photoDocumentation?.length || 1,
                          })
                        }
                        className="group border-2 border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-800 cursor-pointer hover:border-sky-500 transition-all hover:shadow-lg relative"
                      >
                        <div className="relative h-44 bg-slate-950 overflow-hidden flex items-center justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.photoDataUrl}
                            alt={photo.description || `Zdjęcie #${idx + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-bold text-xs backdrop-blur-[2px]">
                            <Maximize2 className="w-5 h-5 text-sky-400" />
                            <span>Powiększ zdjęcie</span>
                          </div>
                          <div className="absolute top-2 left-2 bg-slate-900/80 text-white text-[10px] font-black px-2 py-0.5 rounded-md">
                            #{idx + 1}
                          </div>
                        </div>
                        <div className="p-3 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                          <span className="truncate">{photo.description}</span>
                          <ZoomIn className="w-4 h-4 text-slate-400 group-hover:text-sky-400 flex-shrink-0" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/80 border-t-2 border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleResendEmail(previewReport)}
                disabled={resendingId === previewReport.id}
                title="Wyślij ten raport e-mailem ponownie"
                className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-2xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer active:scale-95 disabled:opacity-60"
              >
                <Send className={`w-4 h-4 ${resendingId === previewReport.id ? "animate-spin" : ""}`} />
                <span>{resendingId === previewReport.id ? "Wysyłanie e-maila..." : "Wyślij e-mail ponownie"}</span>
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={closePreviewReport}
                  className="px-5 py-3 rounded-2xl border-2 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-sm transition-colors cursor-pointer"
                >
                  Zamknij
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleDownload(previewReport);
                    closePreviewReport();
                  }}
                  className="flex items-center gap-2 px-5 py-3 bg-sky-600 hover:bg-sky-500 text-white font-black text-sm rounded-2xl shadow-lg shadow-sky-600/30 transition-all cursor-pointer active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Pobierz PDF</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULLSCREEN LIGHTBOX / ZOOM MODAL */}
      {zoomPhoto && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-6 animate-fade-in"
          onClick={closeZoomPhoto}
        >
          {/* Pasek górny modala powiększenia */}
          <div
            className="w-full max-w-4xl flex items-center justify-between text-white py-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-sky-600 text-white text-xs font-black rounded-lg">
                Zdjęcie {zoomPhoto.index} z {zoomPhoto.total}
              </span>
              {zoomPhoto.takenAt && (
                <span className="text-xs text-slate-400 font-mono hidden sm:inline-block">
                  Wykonano: {formatPolishTime(zoomPhoto.takenAt)}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <a
                href={zoomPhoto.url}
                target="_blank"
                rel="noreferrer"
                title="Otwórz oryginalne zdjęcie w nowej karcie"
                className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden sm:inline">Otwórz oryginał</span>
              </a>
              <button
                type="button"
                onClick={closeZoomPhoto}
                title="Zamknij (Esc lub Wstecz)"
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Zdjęcie w pełnej rozdzielczości */}
          <div
            className="flex-1 flex items-center justify-center w-full max-w-5xl my-auto p-2"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={zoomPhoto.url}
              alt={zoomPhoto.description || "Powiększone zdjęcie"}
              className="max-h-[78vh] max-w-[92vw] object-contain rounded-2xl shadow-2xl border-2 border-slate-800 animate-scale-in"
            />
          </div>

          {/* Pasek dolny z opisem */}
          <div
            className="w-full max-w-2xl bg-slate-900/90 border border-slate-800 text-white px-5 py-3 rounded-2xl text-center shadow-xl backdrop-blur-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-bold text-slate-200">
              {zoomPhoto.description || "Brak opisu fotografii"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
