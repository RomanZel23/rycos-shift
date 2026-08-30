"use client";

import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Building2,
  UserCheck,
  Plus,
  Trash2,
  Send,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Users,
  MessageSquareCheck,
  PenTool,
} from "lucide-react";
import {
  ConstructionSite,
  DiscussedTopicTemplate,
  User,
  AttendanceRecord,
  GeoLocationData,
  DailyReport,
  TenantSettings,
} from "@/types";
import { GeoLocationBadge } from "./GeoLocationBadge";
import { SignatureModal } from "./SignatureModal";
import { AddTopicModal } from "./AddTopicModal";
import { generateReportPDF } from "@/lib/pdf-generator";
import { saveStoredReport } from "@/lib/storage";

interface StartShiftFormProps {
  sites: ConstructionSite[];
  users: User[];
  topicTemplates: DiscussedTopicTemplate[];
  settings: TenantSettings;
  onReportCreated?: (report: DailyReport) => void;
  onNavigateToArchive?: () => void;
}

export function StartShiftForm({
  sites,
  users,
  topicTemplates,
  settings,
  onReportCreated,
  onNavigateToArchive,
}: StartShiftFormProps) {
  // Automatyczna data i godzina otwarcia
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const [siteId, setSiteId] = useState("");
  const [foremanId, setForemanId] = useState("");
  const [location, setLocation] = useState<GeoLocationData>({
    latitude: null,
    longitude: null,
    accuracy: null,
  });

  const [discussedTopics, setDiscussedTopics] = useState<string[]>([
    "Szkolenie BHP i instruktaż stanowiskowy przed rozpoczęciem prac",
  ]);

  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);

  // Modale
  const [isTopicModalOpen, setIsTopicModalOpen] = useState(false);
  const [signatureModalConfig, setSignatureModalConfig] = useState<{
    isOpen: boolean;
    isForeman: boolean;
  }>({ isOpen: false, isForeman: false });

  // Status wysyłki / PDF
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successReport, setSuccessReport] = useState<DailyReport | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Inicjalizacja daty, godziny, domyślnego placu i brygadzisty
  useEffect(() => {
    const now = new Date();
    const formattedDate = now.toISOString().split("T")[0];
    const formattedTime = now.toTimeString().slice(0, 5);
    setDate(formattedDate);
    setTime(formattedTime);

    if (sites.length > 0 && !siteId) {
      setSiteId(sites[0].id);
    }

    const foremen = users.filter((u) => u.isForeman);
    if (foremen.length > 0 && !foremanId) {
      setForemanId(foremen[0].id);
    }
  }, [sites, users, siteId, foremanId]);

  const foremen = users.filter((u) => u.isForeman);
  const selectedForeman = users.find((u) => u.id === foremanId);
  const selectedSite = sites.find((s) => s.id === siteId);

  // Sprawdź czy brygadzista podpisał już listę
  const foremanSigned = attendanceList.some((a) => a.isForeman || a.userId === foremanId);

  const handleAddTopic = (newTopic: string) => {
    setDiscussedTopics((prev) => [...prev, newTopic]);
  };

  const handleRemoveTopic = (indexToRemove: number) => {
    setDiscussedTopics((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleAddAttendanceRecord = (record: AttendanceRecord) => {
    setAttendanceList((prev) => {
      const existingIndex = prev.findIndex((a) => a.userId === record.userId);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = record;
        return updated;
      }
      return [...prev, record];
    });
  };

  const handleRemoveAttendanceRecord = (recordId: string) => {
    setAttendanceList((prev) => prev.filter((a) => a.id !== recordId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);

    // Walidacja
    if (!siteId) {
      setErrorBanner("Wybierz plac budowy.");
      return;
    }
    if (!foremanId) {
      setErrorBanner("Wybierz brygadzistę prowadzącego odprawę.");
      return;
    }
    if (discussedTopics.length === 0) {
      setErrorBanner("Dodaj co najmniej jeden omawiany obszar / temat BHP.");
      return;
    }
    if (!foremanSigned) {
      setErrorBanner("Wymagany jest podpis brygadzisty na liście obecności.");
      return;
    }
    if (attendanceList.length === 0) {
      setErrorBanner("Lista obecności musi zawierać co najmniej jednego pracownika.");
      return;
    }

    setIsSubmitting(true);

    try {
      const siteName = selectedSite?.name || "Plac Budowy";
      const foremanName = selectedForeman
        ? `${selectedForeman.firstName} ${selectedForeman.lastName}`
        : "Brygadzista";

      const reportData: DailyReport = {
        id: "rep-start-" + Date.now(),
        tenantId: settings.tenantId,
        reportType: "START_SHIFT",
        date,
        time,
        siteId,
        siteName,
        foremanId,
        foremanName,
        location,
        discussedTopics,
        attendanceList,
        pdfFileName: "",
        sentToEmails: settings.startShiftEmailRecipients || [],
        sentAt: new Date().toISOString(),
        status: "SENT",
      };

      // 1. Generowanie PDF
      const pdfResult = generateReportPDF(reportData);
      reportData.pdfFileName = pdfResult.fileName;
      reportData.pdfDataUrl = pdfResult.dataUrl;

      // 2. Wysłanie mailem przez Resend API
      try {
        const response = await fetch("/api/send-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pdfBase64: pdfResult.dataUrl,
            fileName: pdfResult.fileName,
            reportType: "START_SHIFT",
            siteName,
            date,
            time,
            recipients: settings.startShiftEmailRecipients,
            apiKey: settings.resendApiKey,
            fromEmail: settings.resendFromEmail,
            foremanName,
          }),
        });
        const resData = await response.json();
        if (!resData.success) {
          console.warn("Mail send notice:", resData.message);
        }
      } catch (mailErr) {
        console.warn("Mail dispatch error:", mailErr);
      }

      // 3. Zapis do archiwum lokalnego
      saveStoredReport(reportData);
      if (onReportCreated) onReportCreated(reportData);

      setSuccessReport(reportData);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Błąd podczas generowania raportu";
      setErrorBanner(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setSuccessReport(null);
    setAttendanceList([]);
    setDiscussedTopics(["Szkolenie BHP i instruktaż stanowiskowy przed rozpoczęciem prac"]);
    const now = new Date();
    setDate(now.toISOString().split("T")[0]);
    setTime(now.toTimeString().slice(0, 5));
  };

  const handleDownloadPDF = () => {
    if (!successReport) return;
    const pdfResult = generateReportPDF(successReport);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(pdfResult.blob);
    link.download = pdfResult.fileName;
    link.click();
  };

  return (
    <div className="w-full max-w-4xl mx-auto pb-32 md:pb-20">
      {/* BANER SUKCESU */}
      {successReport ? (
        <div className="bg-white dark:bg-slate-900 border-2 border-emerald-500 rounded-3xl p-6 sm:p-10 shadow-2xl text-center space-y-6 animate-fade-in">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Raport Rozpoczęcia Prac Został Wysłany!
            </h2>
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 mt-2 max-w-xl mx-auto font-medium">
              Dokument PDF <strong>{successReport.pdfFileName}</strong> został wygenerowany i przesłany do odbiorców:
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
              {successReport.sentToEmails.map((email, idx) => (
                <span
                  key={idx}
                  className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs sm:text-sm rounded-xl font-mono font-bold border border-slate-300 dark:border-slate-700"
                >
                  {email}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 bg-sky-600 hover:bg-sky-500 text-white font-black text-base sm:text-lg rounded-2xl shadow-xl shadow-sky-600/30 active:scale-95 transition-all cursor-pointer"
            >
              <Download className="w-5 h-5" />
              Pobierz plik PDF
            </button>
            {onNavigateToArchive && (
              <button
                type="button"
                onClick={onNavigateToArchive}
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white font-black text-base sm:text-lg rounded-2xl border-2 border-slate-300 dark:border-slate-700 active:scale-95 transition-all cursor-pointer"
              >
                <FileText className="w-5 h-5" />
                Zobacz w Archiwum
              </button>
            )}
            <button
              type="button"
              onClick={resetForm}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 bg-slate-900 hover:bg-slate-800 text-white font-black text-base sm:text-lg rounded-2xl active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              Nowy Raport
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* NAGŁÓWEK KARTY FORMULARZA */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-5 border border-slate-700/50">
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-500/25 text-sky-300 text-xs sm:text-sm font-black uppercase tracking-wider mb-2.5 border border-sky-500/40">
                <FileText className="w-4 h-4" />
                <span>Formularz Dzienny</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
                Rozpoczęcie Prac Zespołu
              </h1>
              <p className="text-sm sm:text-base text-slate-300 mt-1 font-medium">
                Odprawa stanowiskowa BHP, omówienie zadań i lista obecności z podpisami
              </p>
            </div>

            {/* AUTOMATYCZNA DATA I CZAS */}
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/15 text-sm sm:text-base font-extrabold self-start sm:self-auto">
              <div className="flex items-center gap-2 text-slate-100">
                <Calendar className="w-5 h-5 text-sky-400" />
                <span>{date || "YYYY-MM-DD"}</span>
              </div>
              <span className="text-white/40">|</span>
              <div className="flex items-center gap-2 text-slate-100">
                <Clock className="w-5 h-5 text-sky-400" />
                <span>{time || "00:00"}</span>
              </div>
            </div>
          </div>

          {errorBanner && (
            <div className="p-4 sm:p-5 bg-rose-50 dark:bg-rose-950/70 border-2 border-rose-300 dark:border-rose-800 rounded-2xl text-rose-900 dark:text-rose-100 text-sm sm:text-base font-bold flex items-center gap-3 animate-shake shadow-md">
              <AlertTriangle className="w-6 h-6 flex-shrink-0 text-rose-600" />
              <span>{errorBanner}</span>
            </div>
          )}

          {/* KROK 1: PLAC BUDOWY, BRYGADZISTA & GPS */}
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-md space-y-5">
            <h2 className="text-base sm:text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5 pb-1 border-b border-slate-100 dark:border-slate-800">
              <Building2 className="w-5 h-5 text-sky-600" />
              <span>1. Dane podstawowe i lokalizacja</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* WYBÓR PLACU BUDOWY */}
              <div>
                <label className="block text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-200 mb-2">
                  Plac Budowy: <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={siteId}
                    onChange={(e) => setSiteId(e.target.value)}
                    className="w-full h-14 px-4 pr-12 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-base sm:text-lg font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none appearance-none truncate cursor-pointer shadow-inner"
                  >
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <Building2 className="w-5 h-5 text-slate-400 absolute right-4 top-4.5 pointer-events-none" />
                </div>
              </div>

              {/* WYBÓR BRYGADZISTY */}
              <div>
                <label className="block text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-200 mb-2">
                  Brygadzista prowadzący: <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={foremanId}
                    onChange={(e) => setForemanId(e.target.value)}
                    className="w-full h-14 px-4 pr-12 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-base sm:text-lg font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none appearance-none truncate cursor-pointer shadow-inner"
                  >
                    {foremen.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.firstName} {f.lastName} ({f.role})
                      </option>
                    ))}
                  </select>
                  <UserCheck className="w-5 h-5 text-slate-400 absolute right-4 top-4.5 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* GPS BADGE */}
            <GeoLocationBadge location={location} onLocationChange={setLocation} />
          </div>

          {/* KROK 2: OMAWIANE OBSZARY / BHP */}
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-md space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base sm:text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
                  <MessageSquareCheck className="w-5 h-5 text-sky-600" />
                  <span>2. Omawiane obszary (BHP / Zakres robót)</span>
                </h2>
                <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-0.5">
                  Zagadnienia poruszone podczas odprawy
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsTopicModalOpen(true)}
                className="flex items-center justify-center gap-2 px-5 py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl text-sm sm:text-base font-black shadow-md shadow-sky-600/25 transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-5 h-5" />
                <span>Dodaj obszar (+)</span>
              </button>
            </div>

            {discussedTopics.length === 0 ? (
              <div className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-center text-slate-500 font-semibold text-sm">
                Brak dodanych tematów odprawy. Kliknij przycisk „Dodaj obszar (+)”, aby dodać zagadnienia.
              </div>
            ) : (
              <div className="space-y-3">
                {discussedTopics.map((topic, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-800/70 border-2 border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm"
                  >
                    <div className="flex items-start gap-3.5 text-sm sm:text-base text-slate-900 dark:text-slate-100">
                      <span className="w-7 h-7 rounded-xl bg-sky-500 text-white font-black flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-sm">
                        {idx + 1}
                      </span>
                      <span className="font-bold leading-relaxed">{topic}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveTopic(idx)}
                      title="Usuń ten punkt"
                      className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-950/60 transition-colors flex-shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* KROK 3: LISTA OBECNOŚCI Z PODPISAMI */}
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-md space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base sm:text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
                  <Users className="w-5 h-5 text-sky-600" />
                  <span>3. Lista obecności i podpisy pracowników</span>
                </h2>
                <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-0.5">
                  Każdy uczestnik odprawy musi złożyć podpis palcem/rysikiem
                </p>
              </div>

              {/* PRZYCISKI PODPISÓW (DUŻE I WYRAŹNE) */}
              <div className="flex flex-wrap items-center gap-3">
                {/* GUZIK BRYGADZISTA */}
                <button
                  type="button"
                  onClick={() => setSignatureModalConfig({ isOpen: true, isForeman: true })}
                  className={`flex items-center gap-2 px-5 py-3.5 rounded-2xl text-sm sm:text-base font-black transition-all active:scale-95 cursor-pointer border-2 shadow-md ${
                    foremanSigned
                      ? "bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/30"
                      : "bg-amber-500 text-slate-950 border-amber-400 hover:bg-amber-400 shadow-amber-500/30 animate-pulse"
                  }`}
                >
                  <PenTool className="w-5 h-5" />
                  <span>{foremanSigned ? "✓ Brygadzista Podpisany" : "Podpisz Brygadzistę"}</span>
                </button>

                {/* GUZIK + PRACOWNIK */}
                <button
                  type="button"
                  onClick={() => setSignatureModalConfig({ isOpen: true, isForeman: false })}
                  className="flex items-center gap-2 px-5 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-sm sm:text-base font-black shadow-lg border-2 border-slate-700 active:scale-95 transition-all cursor-pointer"
                >
                  <Plus className="w-5 h-5" />
                  <span>+ Pracownik</span>
                </button>
              </div>
            </div>

            {/* TABELA OBECNOŚCI */}
            {attendanceList.length === 0 ? (
              <div className="p-10 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-center space-y-3">
                <Users className="w-12 h-12 text-slate-400 mx-auto" />
                <div className="text-slate-800 dark:text-slate-200 text-base font-extrabold">
                  Lista obecności jest pusta.
                </div>
                <div className="text-slate-500 text-sm font-medium">
                  Naciśnij „Podpisz Brygadzistę” oraz „+ Pracownik”, aby złożyć podpisy zespołu.
                </div>
              </div>
            ) : (
              <div className="divide-y-2 divide-slate-100 dark:divide-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm">
                {attendanceList.map((attendee, index) => (
                  <div
                    key={attendee.id}
                    className="p-4 sm:p-5 bg-white dark:bg-slate-900 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3.5">
                      <span className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black flex items-center justify-center text-sm border border-slate-200 dark:border-slate-700">
                        {index + 1}
                      </span>
                      <div>
                        <div className="font-black text-slate-900 dark:text-white text-base sm:text-lg flex items-center gap-2.5">
                          <span>{attendee.userName}</span>
                          {attendee.isForeman && (
                            <span className="px-2.5 py-0.5 bg-amber-500 text-slate-950 text-xs font-black rounded-lg shadow-sm">
                              Brygadzista
                            </span>
                          )}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-semibold mt-0.5">
                          {attendee.userRole} • Podpisano o {attendee.signedAt.slice(11, 16)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* MINIATURKA PODPISU */}
                      <div className="bg-white border-2 border-slate-300 rounded-xl p-1.5 w-28 sm:w-36 h-12 flex items-center justify-center overflow-hidden shadow-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={attendee.signatureDataUrl}
                          alt={`Podpis ${attendee.userName}`}
                          className="max-h-full max-w-full object-contain"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveAttendanceRecord(attendee.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-100 transition-colors cursor-pointer"
                        title="Usuń z listy"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* GŁÓWNY PRZYCISK: WYŚLIJ RAPORT (POTĘŻNY I WYGODNY DLA PALCA) */}
          <div className="sticky bottom-20 md:bottom-6 z-30 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-4.5 sm:py-5 px-8 rounded-3xl font-black text-lg sm:text-xl shadow-2xl flex items-center justify-center gap-3.5 transition-all cursor-pointer active:scale-98 border-2 border-white/20 ${
                isSubmitting
                  ? "bg-slate-700 text-slate-300 cursor-wait"
                  : "bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white shadow-sky-600/40"
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Generowanie i wysyłanie raportu...</span>
                </>
              ) : (
                <>
                  <Send className="w-6 h-6" />
                  <span>Wyślij Raport Rozpoczęcia Prac</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* MODAL DODAWANIA TEMATU */}
      <AddTopicModal
        isOpen={isTopicModalOpen}
        onClose={() => setIsTopicModalOpen(false)}
        onAddTopic={handleAddTopic}
        availableTemplates={topicTemplates}
      />

      {/* MODAL SKŁADANIA PODPISU */}
      <SignatureModal
        isOpen={signatureModalConfig.isOpen}
        onClose={() => setSignatureModalConfig({ isOpen: false, isForeman: false })}
        onConfirm={handleAddAttendanceRecord}
        isForemanModal={signatureModalConfig.isForeman}
        preselectedUser={selectedForeman}
        availableUsers={users}
        alreadyAddedUserIds={attendanceList.map((a) => a.userId)}
      />
    </div>
  );
}
