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
      // Jeśli już był ten pracownik, zaktualizuj podpis
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
    <div className="w-full max-w-4xl mx-auto pb-28 md:pb-16">
      {/* BANER SUKCESU */}
      {successReport ? (
        <div className="bg-white dark:bg-slate-900 border-2 border-emerald-500/40 rounded-2xl p-6 sm:p-8 shadow-xl text-center space-y-5 animate-fade-in">
          <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
              Raport Rozpoczęcia Prac Został Wysłany!
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-lg mx-auto">
              Dokument PDF <strong>{successReport.pdfFileName}</strong> został wygenerowany,
              zarchiwizowany i wysłany na adresy:
            </p>
            <div className="mt-2 flex flex-wrap justify-center gap-1.5 max-w-md mx-auto">
              {successReport.sentToEmails.map((email, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs rounded-lg font-mono"
                >
                  {email}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl shadow-md shadow-sky-600/20 active:scale-95 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              Pobierz plik PDF
            </button>
            {onNavigateToArchive && (
              <button
                type="button"
                onClick={onNavigateToArchive}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl border border-slate-300 dark:border-slate-700 active:scale-95 transition-all cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                Zobacz w Archiwum
              </button>
            )}
            <button
              type="button"
              onClick={resetForm}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nowy Raport
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* NAGŁÓWEK KARTY FORMULARZA */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-sky-950 text-white rounded-2xl p-5 sm:p-6 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 text-xs font-semibold uppercase tracking-wider mb-2 border border-sky-500/30">
                <FileText className="w-3.5 h-3.5" />
                <span>Formularz Dzienny</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Rozpoczęcie Prac Zespołu
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                Odprawa stanowiskowa BHP, omówienie zadań i lista obecności z podpisami
              </p>
            </div>

            {/* AUTOMATYCZNA DATA I CZAS */}
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-white/10 text-xs">
              <div className="flex items-center gap-1.5 text-slate-200">
                <Calendar className="w-4 h-4 text-sky-400" />
                <span className="font-semibold">{date || "YYYY-MM-DD"}</span>
              </div>
              <span className="text-white/40">|</span>
              <div className="flex items-center gap-1.5 text-slate-200">
                <Clock className="w-4 h-4 text-sky-400" />
                <span className="font-semibold">{time || "00:00"}</span>
              </div>
            </div>
          </div>

          {errorBanner && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-800 dark:text-rose-200 text-sm font-medium flex items-center gap-2.5 animate-shake">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-600" />
              <span>{errorBanner}</span>
            </div>
          )}

          {/* KROK 1: PLAC BUDOWY, BRYGADZISTA & GPS */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-sky-600" />
              <span>1. Dane podstawowe i lokalizacja</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* WYBÓR PLACU BUDOWY */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Plac Budowy: <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={siteId}
                    onChange={(e) => setSiteId(e.target.value)}
                    className="w-full px-3.5 pr-10 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none appearance-none truncate"
                  >
                    {sites.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <Building2 className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                </div>
              </div>

              {/* WYBÓR BRYGADZISTY */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Brygadzista prowadzący: <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={foremanId}
                    onChange={(e) => setForemanId(e.target.value)}
                    className="w-full px-3.5 pr-10 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none appearance-none truncate"
                  >
                    {foremen.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.firstName} {f.lastName} ({f.role})
                      </option>
                    ))}
                  </select>
                  <UserCheck className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* GPS BADGE */}
            <GeoLocationBadge location={location} onLocationChange={setLocation} />
          </div>

          {/* KROK 2: OMAWIANE OBSZARY / BHP */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <MessageSquareCheck className="w-4 h-4 text-sky-600" />
                  <span>2. Omawiane obszary (BHP / Zakres robót)</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Zagadnienia poruszone podczas porannej odprawy
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsTopicModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Dodaj obszar (+)</span>
              </button>
            </div>

            {discussedTopics.length === 0 ? (
              <div className="p-6 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center text-slate-400 text-xs">
                Brak dodanych tematów odprawy. Kliknij przycisk „Dodaj obszar (+)”, aby dodać
                zagadnienia.
              </div>
            ) : (
              <div className="space-y-2">
                {discussedTopics.map((topic, idx) => (
                  <div
                    key={idx}
                    className="flex items-start justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl group transition-all"
                  >
                    <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-800 dark:text-slate-200">
                      <span className="w-5 h-5 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 font-bold flex items-center justify-center text-[10px] flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="font-medium leading-relaxed">{topic}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveTopic(idx)}
                      title="Usuń ten punkt"
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors flex-shrink-0 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* KROK 3: LISTA OBECNOŚCI Z PODPISAMI */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-600" />
                  <span>3. Lista obecności i podpisy pracowników</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Każdy uczestnik odprawy musi złożyć czytelny podpis na ekranie dotykowym
                </p>
              </div>

              {/* PRZYCISKI DODAWANIA PODPISÓW */}
              <div className="flex items-center gap-2">
                {/* GUZIK BRYGADZISTA */}
                <button
                  type="button"
                  onClick={() => setSignatureModalConfig({ isOpen: true, isForeman: true })}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer border ${
                    foremanSigned
                      ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                      : "bg-amber-500 text-white border-amber-600 hover:bg-amber-600 shadow-md shadow-amber-500/20 animate-bounce"
                  }`}
                >
                  <PenTool className="w-4 h-4" />
                  <span>{foremanSigned ? "✓ Brygadzista Podpisany" : "Podpisz Brygadzistę"}</span>
                </button>

                {/* GUZIK + PRACOWNIK */}
                <button
                  type="button"
                  onClick={() => setSignatureModalConfig({ isOpen: true, isForeman: false })}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Pracownik</span>
                </button>
              </div>
            </div>

            {/* TABELA OBECNOŚCI */}
            {attendanceList.length === 0 ? (
              <div className="p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center space-y-2">
                <Users className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="text-slate-600 dark:text-slate-300 text-xs font-medium">
                  Lista obecności jest pusta.
                </div>
                <div className="text-slate-400 text-[11px]">
                  Naciśnij przycisk „Podpisz Brygadzistę” oraz „+ Pracownik”, aby zarejestrować
                  podpisy zespołu.
                </div>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {attendanceList.map((attendee, index) => (
                  <div
                    key={attendee.id}
                    className="p-3 sm:p-4 bg-white dark:bg-slate-900 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold flex items-center justify-center text-xs">
                        {index + 1}
                      </span>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm flex items-center gap-2">
                          <span>{attendee.userName}</span>
                          {attendee.isForeman && (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-bold rounded-md">
                              Brygadzista
                            </span>
                          )}
                        </div>
                        <div className="text-slate-500 text-[11px] mt-0.5">
                          {attendee.userRole} • Podpisano o {attendee.signedAt.slice(11, 16)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* MINIATURKA PODPISU */}
                      <div className="bg-white border border-slate-200 dark:border-slate-700 rounded-lg p-1 w-24 sm:w-28 h-10 flex items-center justify-center overflow-hidden shadow-inner">
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
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Usuń z listy"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* GŁÓWNY PRZYCISK: WYŚLIJ RAPORT */}
          <div className="sticky bottom-4 z-20 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-4 px-6 rounded-2xl font-black text-base sm:text-lg shadow-2xl flex items-center justify-center gap-3 transition-all cursor-pointer active:scale-98 ${
                isSubmitting
                  ? "bg-slate-700 text-slate-300 cursor-wait"
                  : "bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white shadow-sky-600/30"
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Generowanie i wysyłanie raportu...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
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
