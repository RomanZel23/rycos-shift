"use client";

import React, { useState } from "react";
import {
  FileText,
  Download,
  Eye,
  Calendar,
  Building2,
  UserCheck,
  Search,
  Filter,
  CheckCircle2,
  X,
  Send,
  Camera,
} from "lucide-react";
import { DailyReport } from "@/types";
import { generateReportPDF } from "@/lib/pdf-generator";

interface ReportArchiveProps {
  reports: DailyReport[];
  onNewStartReport: () => void;
  onNewEndReport: () => void;
}

export function ReportArchive({
  reports,
  onNewStartReport,
  onNewEndReport,
}: ReportArchiveProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");
  const [previewReport, setPreviewReport] = useState<DailyReport | null>(null);

  const filteredReports = reports.filter((r) => {
    const matchesType =
      filterType === "ALL" || r.reportType === filterType;
    const matchesSearch =
      r.siteName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.foremanName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.date.includes(searchTerm) ||
      (r.pdfFileName && r.pdfFileName.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesType && matchesSearch;
  });

  const handleDownload = (report: DailyReport) => {
    const result = generateReportPDF(report);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(result.blob);
    link.download = result.fileName;
    link.click();
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-32 md:pb-20">
      {/* NAGŁÓWEK ARCHIWUM */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-5 border border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/25 text-sky-300 text-xs sm:text-sm font-black uppercase tracking-wider mb-2.5 border border-sky-500/40">
            <FileText className="w-4 h-4" />
            <span>Repozytorium Raportów</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Archiwum Raportów Dziennych
          </h1>
          <p className="text-sm sm:text-base text-slate-300 mt-1 font-medium">
            Zestawienie wygenerowanych i podpisanych raportów terenowych
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onNewStartReport}
            className="px-5 py-3 bg-sky-600 hover:bg-sky-500 text-white text-sm sm:text-base font-black rounded-2xl shadow-md shadow-sky-600/30 transition-all active:scale-95 cursor-pointer"
          >
            + Rozpoczęcie prac
          </button>
          <button
            type="button"
            onClick={onNewEndReport}
            className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-sm sm:text-base font-black rounded-2xl shadow-md shadow-indigo-600/30 transition-all active:scale-95 cursor-pointer"
          >
            + Zakończenie prac
          </button>
        </div>
      </div>

      {/* FILTROWANIE I SZUKANIE */}
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-96">
          <input
            type="text"
            placeholder="Szukaj placu, brygadzisty, daty..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-13 pl-11 pr-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-sm sm:text-base font-semibold text-slate-900 dark:text-white focus:ring-4 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none shadow-inner"
          />
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-4" />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setFilterType("ALL")}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
              filterType === "ALL"
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
            }`}
          >
            Wszystkie ({reports.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("START_SHIFT")}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
              filterType === "START_SHIFT"
                ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
            }`}
          >
            Rozpoczęcie ({reports.filter((r) => r.reportType === "START_SHIFT").length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("END_SHIFT")}
            className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
              filterType === "END_SHIFT"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
            }`}
          >
            Zakończenie ({reports.filter((r) => r.reportType === "END_SHIFT").length})
          </button>
        </div>
      </div>

      {/* LISTA RAPORTÓW */}
      {filteredReports.length === 0 ? (
        <div className="p-12 bg-white dark:bg-slate-900 border-2 border-dashed border-slate-300 dark:border-slate-800 rounded-3xl text-center space-y-3 shadow-sm">
          <FileText className="w-12 h-12 text-slate-400 mx-auto" />
          <div className="text-slate-900 dark:text-white text-lg font-black">
            Brak raportów spełniających kryteria
          </div>
          <div className="text-slate-500 text-sm font-medium">
            Wygeneruj swój pierwszy raport odprawy rozpoczęcia lub fotorelację zakończenia robót.
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-5"
            >
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={`px-3 py-1 text-xs sm:text-sm font-black rounded-xl uppercase tracking-wider ${
                      report.reportType === "START_SHIFT"
                        ? "bg-sky-100 text-sky-900 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-300 dark:border-sky-700"
                        : "bg-indigo-100 text-indigo-900 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700"
                    }`}
                  >
                    {report.reportType === "START_SHIFT"
                      ? "Rozpoczęcie prac"
                      : "Zakończenie prac"}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-mono font-bold">
                    <Calendar className="w-4 h-4" />
                    <span>
                      {report.date} | {report.time}
                    </span>
                  </div>
                  <span className="inline-flex items-center text-xs text-emerald-600 font-extrabold bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 rounded-lg">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Wysłano (PDF)
                  </span>
                </div>

                <div className="text-lg sm:text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-slate-400" />
                  <span>{report.siteName}</span>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-semibold">
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-sky-500" />
                    <span>Brygadzista: <strong className="text-slate-900 dark:text-white">{report.foremanName}</strong></span>
                  </div>
                  {report.reportType === "START_SHIFT" && (
                    <div>
                      Obecność: <strong className="text-slate-900 dark:text-white">{report.attendanceList?.length || 0} osób</strong>
                    </div>
                  )}
                  {report.reportType === "END_SHIFT" && (
                    <div>
                      Fotorelacja: <strong className="text-slate-900 dark:text-white">{report.photoDocumentation?.length || 0} zdjęć</strong>
                    </div>
                  )}
                </div>

                <div className="text-xs text-slate-400 font-mono">
                  Plik: {report.pdfFileName}
                </div>
              </div>

              {/* PRZYCISKI AKCJI (DUŻE I WYRAŹNE) */}
              <div className="flex items-center gap-3 self-end md:self-center">
                <button
                  type="button"
                  onClick={() => setPreviewReport(report)}
                  className="flex items-center gap-2 px-5 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-bold text-sm rounded-2xl transition-all cursor-pointer active:scale-95 border border-slate-200 dark:border-slate-700 shadow-sm"
                >
                  <Eye className="w-4 h-4" />
                  <span>Szczegóły</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDownload(report)}
                  className="flex items-center gap-2 px-5 py-3 bg-sky-600 hover:bg-sky-500 text-white font-black text-sm rounded-2xl shadow-lg shadow-sky-600/30 transition-all cursor-pointer active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  <span>Pobierz PDF</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL PODGLĄDU SZCZEGÓŁÓW RAPORTU */}
      {previewReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
          onClick={() => setPreviewReport(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-sky-500/25 text-sky-400 rounded-xl">
                  <FileText className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-lg sm:text-xl text-white">
                    {previewReport.reportType === "START_SHIFT"
                      ? "Raport Rozpoczęcia Prac"
                      : "Raport Zakończenia Prac"}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 font-mono">
                    {previewReport.pdfFileName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewReport(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
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
                  <div className="font-mono text-xs text-slate-800 dark:text-slate-200">
                    {previewReport.location?.latitude?.toFixed(5)}° N, {previewReport.location?.longitude?.toFixed(5)}° E
                  </div>
                </div>
              </div>

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
                          <div className="text-xs text-slate-500">{att.userRole}</div>
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

              {previewReport.photoDocumentation && previewReport.photoDocumentation.length > 0 && (
                <div>
                  <h4 className="font-black text-sm uppercase tracking-wider text-slate-900 dark:text-white mb-2">
                    Dokumentacja Fotograficzna:
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {previewReport.photoDocumentation.map((photo, idx) => (
                      <div
                        key={photo.id}
                        className="border-2 border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-800"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.photoDataUrl}
                          alt="Zdjęcie"
                          className="w-full h-40 object-cover"
                        />
                        <div className="p-3 text-xs font-bold text-slate-800 dark:text-slate-200">
                          {photo.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/80 border-t-2 border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setPreviewReport(null)}
                className="px-5 py-3 rounded-2xl border-2 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-sm transition-colors cursor-pointer"
              >
                Zamknij
              </button>
              <button
                type="button"
                onClick={() => {
                  handleDownload(previewReport);
                  setPreviewReport(null);
                }}
                className="flex items-center gap-2 px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white font-black text-sm rounded-2xl shadow-lg shadow-sky-600/30 transition-all cursor-pointer active:scale-95"
              >
                <Download className="w-4 h-4" />
                Pobierz dokument PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
