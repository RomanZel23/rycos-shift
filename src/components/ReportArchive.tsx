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
    <div className="w-full max-w-5xl mx-auto space-y-5 pb-16">
      {/* NAGŁÓWEK ARCHIWUM */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-semibold uppercase tracking-wider mb-2 border border-sky-500/30">
            <FileText className="w-3.5 h-3.5" />
            <span>Repozytorium Raportów</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Archiwum Raportów Dziennych
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
            Zestawienie wygenerowanych i podpisanych raportów terenowych
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNewStartReport}
            className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
          >
            + Rozpoczęcie prac
          </button>
          <button
            type="button"
            onClick={onNewEndReport}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
          >
            + Zakończenie prac
          </button>
        </div>
      </div>

      {/* FILTROWANIE I SZUKANIE */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            placeholder="Szukaj placu, brygadzisty, daty..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
          >
            <option value="ALL">Wszystkie typy raportów</option>
            <option value="START_SHIFT">Tylko Rozpoczęcie prac</option>
            <option value="END_SHIFT">Tylko Zakończenie prac</option>
          </select>
        </div>
      </div>

      {/* LISTA RAPORTÓW */}
      {filteredReports.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <FileText className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
          <h3 className="text-base font-bold text-slate-700 dark:text-slate-300">
            Brak raportów spełniających kryteria
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Gdy wyślesz formularz rozpoczęcia lub zakończenia prac, pojawi się on tutaj automatycznie z możliwością pobrania pliku PDF.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredReports.map((report) => {
            const isStart = report.reportType === "START_SHIFT";
            return (
              <div
                key={report.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm shadow-sm ${
                      isStart
                        ? "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300"
                        : "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
                    }`}
                  >
                    <FileText className="w-5 h-5" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isStart
                            ? "bg-sky-100 text-sky-800 dark:bg-sky-900/60 dark:text-sky-300"
                            : "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300"
                        }`}
                      >
                        {isStart ? "Rozpoczęcie prac" : "Zakończenie prac"}
                      </span>
                      <span className="text-xs font-mono text-slate-400">
                        {report.date} • {report.time}
                      </span>
                    </div>

                    <div className="font-bold text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-slate-400" />
                      <span>{report.siteName}</span>
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-3">
                      <span className="flex items-center gap-1">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                        <span>Brygadzista: <strong>{report.foremanName}</strong></span>
                      </span>

                      {isStart && report.attendanceList && (
                        <span>
                          Obecność: <strong>{report.attendanceList.length} os.</strong>
                        </span>
                      )}

                      {!isStart && report.photoDocumentation && (
                        <span>
                          Zdjęcia: <strong>{report.photoDocumentation.length} szt.</strong>
                        </span>
                      )}

                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Zapisano & wysłano
                      </span>
                    </div>
                  </div>
                </div>

                {/* PRZYCISKI AKCJI DLA RAPORTU */}
                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => setPreviewReport(report)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Podgląd</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownload(report)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-sm transition-all active:scale-95 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>PDF</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL PODGLĄDU RAPORTU */}
      {previewReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base text-white">
                  Podgląd raportu: {previewReport.siteName}
                </h3>
                <p className="text-xs text-slate-400">
                  {previewReport.date} | {previewReport.time} • Brygadzista: {previewReport.foremanName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewReport(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs space-y-1">
                <div><strong>Nazwa pliku PDF:</strong> {previewReport.pdfFileName || "Automatyczna"}</div>
                <div><strong>Współrzędne GPS:</strong> {previewReport.location?.latitude?.toFixed(5) || "Brak"}, {previewReport.location?.longitude?.toFixed(5) || "Brak"}</div>
                <div><strong>Wysłano na adresy:</strong> {previewReport.sentToEmails.join(", ")}</div>
              </div>

              {previewReport.reportType === "START_SHIFT" && (
                <>
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Omawiane obszary (BHP / Zakres robót):
                    </h4>
                    <ul className="list-disc list-inside text-xs text-slate-600 dark:text-slate-300 space-y-1 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl">
                      {previewReport.discussedTopics?.map((t, idx) => (
                        <li key={idx}>{t}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Złożone podpisy ({previewReport.attendanceList?.length || 0}):
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {previewReport.attendanceList?.map((att) => (
                        <div
                          key={att.id}
                          className="p-2 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg text-xs flex items-center justify-between"
                        >
                          <div>
                            <div className="font-semibold text-slate-800 dark:text-white">{att.userName}</div>
                            <div className="text-[10px] text-slate-400">{att.userRole}</div>
                          </div>
                          {att.signatureDataUrl && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={att.signatureDataUrl}
                              alt="Podpis"
                              className="h-7 w-16 object-contain bg-white rounded border border-slate-200 p-0.5"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {previewReport.reportType === "END_SHIFT" && (
                <div>
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                    Dokumentacja zdjęciowa ({previewReport.photoDocumentation?.length || 0}):
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {previewReport.photoDocumentation?.map((photo, idx) => (
                      <div key={photo.id} className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.photoDataUrl} alt={`Zdjęcie ${idx + 1}`} className="w-full h-32 object-cover" />
                        <div className="p-2 bg-slate-50 font-medium text-slate-700">{photo.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="px-5 py-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setPreviewReport(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold cursor-pointer"
              >
                Zamknij
              </button>
              <button
                type="button"
                onClick={() => handleDownload(previewReport)}
                className="px-5 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Pobierz plik PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
