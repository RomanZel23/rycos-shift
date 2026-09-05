"use client";

import React, { useState, useEffect, useRef } from "react";
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
  Camera,
  Image as ImageIcon,
} from "lucide-react";
import {
  ConstructionSite,
  User,
  PhotoDocumentationItem,
  GeoLocationData,
  DailyReport,
  TenantSettings,
} from "@/types";
import { GeoLocationBadge } from "./GeoLocationBadge";
import { VoiceInputButton } from "./VoiceInputButton";
import { saveStoredReport } from "@/lib/storage";
import { getPolishCurrentDate, getPolishCurrentTime } from "@/lib/date-utils";

interface EndShiftFormProps {
  sites: ConstructionSite[];
  users: User[];
  settings: TenantSettings;
  onReportCreated?: (report: DailyReport) => void;
  onNavigateToArchive?: () => void;
}

export function EndShiftForm({
  sites,
  users,
  settings,
  onReportCreated,
  onNavigateToArchive,
}: EndShiftFormProps) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const [siteId, setSiteId] = useState("");
  const [foremanId, setForemanId] = useState("");
  const [location, setLocation] = useState<GeoLocationData>({
    latitude: null,
    longitude: null,
    accuracy: null,
  });

  const [photos, setPhotos] = useState<PhotoDocumentationItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [tempPhotoUrl, setTempPhotoUrl] = useState<string | null>(null);
  const [tempDescription, setTempDescription] = useState("");
  const [isAddingPhoto, setIsAddingPhoto] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  // Etap 2: gdy raport zapisał się, ale mail nie poszedł, mówimy to wprost.
  const [emailWarning, setEmailWarning] = useState<string | null>(null);
  const [successReport, setSuccessReport] = useState<DailyReport | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  useEffect(() => {
    setDate(getPolishCurrentDate());
    setTime(getPolishCurrentTime());

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

  const processImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1024;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.70);
          setTempPhotoUrl(compressedDataUrl);
          setTempDescription("");
          setIsAddingPhoto(true);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processImageFile(files[0]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleConfirmAddPhoto = () => {
    if (!tempPhotoUrl) return;
    const newItem: PhotoDocumentationItem = {
      id: "photo-" + Date.now() + "-" + Math.random().toString(36).substr(2, 4),
      photoDataUrl: tempPhotoUrl,
      description: tempDescription.trim() || "Dokumentacja stanu robót na placu budowy.",
      takenAt: new Date().toISOString(),
    };

    setPhotos((prev) => [...prev, newItem]);
    setTempPhotoUrl(null);
    setTempDescription("");
    setIsAddingPhoto(false);
  };

  const handleCancelAddPhoto = () => {
    setTempPhotoUrl(null);
    setTempDescription("");
    setIsAddingPhoto(false);
  };

  const handleRemovePhoto = (photoId: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);

    if (!siteId) {
      setErrorBanner("Wybierz plac budowy.");
      return;
    }
    if (!foremanId) {
      setErrorBanner("Wybierz brygadzistę zdającego zmianę.");
      return;
    }
    if (photos.length === 0) {
      setErrorBanner("Dodaj co najmniej jedno zdjęcie z dokumentacją wykonanych prac.");
      return;
    }

    setIsSubmitting(true);

    try {
      const siteName = selectedSite?.name || "Plac Budowy";
      const foremanName = selectedForeman
        ? `${selectedForeman.firstName} ${selectedForeman.lastName}`
        : "Brygadzista";

      let reportData: DailyReport = {
        id: "rep-end-" + Date.now(),
        tenantId: settings.tenantId,
        reportType: "END_SHIFT",
        date,
        time,
        siteId,
        siteName,
        foremanId,
        foremanName,
        location,
        photoDocumentation: photos,
        pdfFileName: "",
        sentToEmails: settings.endShiftEmailRecipients || [],
        sentAt: new Date().toISOString(),
        status: "SENT",
      };

      // Etap 3: dokument PDF generuje Chromium na serwerze. Telefon wysyła
      // wyłącznie dane raportu — nie renderuje już nic i nie dźwiga base64.
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: reportData }),
      });
      const resData = await response.json().catch(() => null);

      if (!response.ok || !resData?.success) {
        // Zapis się nie udał — trzymamy raport lokalnie, żeby nie przepadł,
        // i mówimy o tym wprost zamiast pokazywać ekran sukcesu.
        const failed: DailyReport = {
          ...reportData,
          status: "FAILED",
          errorMessage: resData?.message || "Nie udało się zapisać raportu na serwerze.",
        };
        saveStoredReport(failed);
        if (onReportCreated) onReportCreated(failed);
        setErrorBanner(
          `${failed.errorMessage} Raport został zachowany na tym urządzeniu i zostanie dosłany przy następnej synchronizacji.`
        );
        return;
      }

      const saved: DailyReport = {
        ...(resData.report as DailyReport),
        cloudSyncedAt: new Date().toISOString(),
        syncAttempts: 0,
      };

      saveStoredReport(saved);
      if (onReportCreated) onReportCreated(saved);
      setEmailWarning(resData.emailSent ? null : resData.message || null);
      reportData = saved;

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
    setEmailWarning(null);
    setPhotos([]);
    setDate(getPolishCurrentDate());
    setTime(getPolishCurrentTime());
  };

  const handleDownloadPDF = async () => {
    if (!successReport?.pdfDataUrl) return;
    // Pobieramy dokładnie ten plik, który trafił do archiwum i poszedł mailem,
    // zamiast generować nową wersję dokumentu.
    try {
      const res = await fetch(successReport.pdfDataUrl);
      if (!res.ok) throw new Error("nie udało się pobrać pliku");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = successReport.pdfFileName || "raport.pdf";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      setErrorBanner("Nie udało się pobrać dokumentu PDF z archiwum.");
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto pb-32 md:pb-20">
      {successReport ? (
        <div className={`bg-white dark:bg-slate-900 border-2 ${emailWarning ? "border-amber-500" : "border-indigo-500"} rounded-3xl p-6 sm:p-10 shadow-2xl text-center space-y-6 animate-fade-in`}>
          <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {emailWarning
                ? "Raport Zakończenia Prac — zapisany, ale nie wysłany"
                : "Raport Zakończenia Prac Został Wysłany!"}
            </h2>
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 mt-2 max-w-xl mx-auto font-medium">
              {emailWarning ? (
                <>
                  Dokument PDF z fotorelacją <strong>{successReport.pdfFileName}</strong> został
                  zapisany w archiwum, ale wiadomość e-mail nie wyszła.
                </>
              ) : (
                <>
                  Dokument PDF z fotorelacją <strong>{successReport.pdfFileName}</strong> został
                  wygenerowany i przesłany do:
                </>
              )}
            </p>

            {emailWarning && (
              <div className="mt-4 mx-auto max-w-xl p-4 bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-400 dark:border-amber-700 rounded-2xl text-left space-y-2">
                <div className="text-sm font-black text-amber-900 dark:text-amber-200">
                  Wysyłka e-mail nie powiodła się
                </div>
                <p className="text-xs text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
                  {emailWarning}
                </p>
                <p className="text-xs text-amber-900/80 dark:text-amber-200/80 leading-relaxed">
                  Raport jest bezpieczny w archiwum — możesz ponowić wysyłkę z zakładki Archiwum
                  po usunięciu przyczyny.
                </p>
              </div>
            )}

            <div className="mt-3 flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
              {(emailWarning ? [] : successReport.sentToEmails).map((email, idx) => (
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
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-base sm:text-lg rounded-2xl shadow-xl shadow-indigo-600/30 active:scale-95 transition-all cursor-pointer"
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
          {/* NAGŁÓWEK KARTY */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-5 border border-slate-700/50">
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/25 text-indigo-300 text-xs sm:text-sm font-black uppercase tracking-wider mb-2.5 border border-indigo-500/40">
                <Camera className="w-4 h-4" />
                <span>Formularz Zdaniowy</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
                Zakończenie Prac Zespołu
              </h1>
              <p className="text-sm sm:text-base text-slate-300 mt-1 font-medium">
                Dokumentacja fotograficzna wykonanych robót z opisami głosowymi lub tekstowymi
              </p>
            </div>

            {/* DATA I GODZINA */}
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/15 text-sm sm:text-base font-extrabold self-start sm:self-auto">
              <div className="flex items-center gap-2 text-slate-100">
                <Calendar className="w-5 h-5 text-indigo-400" />
                <span>{date || "YYYY-MM-DD"}</span>
              </div>
              <span className="text-white/40">|</span>
              <div className="flex items-center gap-2 text-slate-100">
                <Clock className="w-5 h-5 text-indigo-400" />
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
              <Building2 className="w-5 h-5 text-indigo-600" />
              <span>1. Dane podstawowe i lokalizacja</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-200 mb-2">
                  Plac Budowy: <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={siteId}
                    onChange={(e) => setSiteId(e.target.value)}
                    className="w-full h-14 px-4 pr-12 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-base sm:text-lg font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none appearance-none truncate cursor-pointer shadow-inner"
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

              <div>
                <label className="block text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-200 mb-2">
                  Brygadzista zdający zmianę: <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={foremanId}
                    onChange={(e) => setForemanId(e.target.value)}
                    className="w-full h-14 px-4 pr-12 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-base sm:text-lg font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none appearance-none truncate cursor-pointer shadow-inner"
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

            <GeoLocationBadge location={location} onLocationChange={setLocation} />
          </div>

          {/* KROK 2: DOKUMENTACJA FOTOGRAFICZNA */}
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-md space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base sm:text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
                  <Camera className="w-5 h-5 text-indigo-600" />
                  <span>2. Dokumentacja wykonanych robót</span>
                </h2>
                <p className="text-xs sm:text-sm font-semibold text-slate-500 mt-0.5">
                  Zrób zdjęcie aparatem lub załącz z galerii
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
                id="camera-file-input"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-2.5 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-sm sm:text-base font-black shadow-lg shadow-indigo-600/30 active:scale-95 transition-all cursor-pointer self-start sm:self-auto"
              >
                <Camera className="w-5 h-5" />
                <span>Zrób / Dodaj zdjęcie (+)</span>
              </button>
            </div>

            {/* FORMULARZ DLA NOWEGO ZDJĘCIA */}
            {isAddingPhoto && tempPhotoUrl && (
              <div className="p-5 bg-indigo-50/80 dark:bg-indigo-950/50 border-2 border-indigo-300 dark:border-indigo-800 rounded-3xl space-y-4 animate-fade-in">
                <div className="text-sm font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-200">
                  Opisz nowo zrobione zdjęcie:
                </div>
                <div className="flex flex-col sm:flex-row gap-5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={tempPhotoUrl}
                    alt="Podgląd zdjęcia"
                    className="w-full sm:w-56 h-44 object-cover rounded-2xl border-2 border-indigo-200 shadow-md"
                  />
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                        Opis wykonanych prac:
                      </label>
                      <VoiceInputButton
                        onTranscript={(txt) =>
                          setTempDescription((prev) => (prev ? `${prev} ${txt}` : txt))
                        }
                        placeholderText="Podyktuj opis zdjęcia..."
                      />
                    </div>
                    <textarea
                      rows={3}
                      value={tempDescription}
                      onChange={(e) => setTempDescription(e.target.value)}
                      placeholder="Wpisz opis elementu lub użyj dyktowania głosem..."
                      className="w-full p-3.5 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-base font-medium text-slate-900 dark:text-white focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500 focus:outline-none shadow-inner"
                    />
                    <div className="flex items-center justify-end gap-3 pt-1">
                      <button
                        type="button"
                        onClick={handleCancelAddPhoto}
                        className="px-4 py-2.5 text-sm font-bold rounded-xl text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                      >
                        Anuluj
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmAddPhoto}
                        className="px-6 py-2.5 text-sm font-black rounded-xl bg-indigo-600 text-white hover:bg-indigo-500 shadow-md cursor-pointer active:scale-95"
                      >
                        Zatwierdź zdjęcie
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SIATKA DODANYCH ZDJĘĆ */}
            {photos.length === 0 ? (
              <div className="p-10 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-center space-y-3">
                <ImageIcon className="w-12 h-12 text-slate-400 mx-auto" />
                <div className="text-slate-800 dark:text-slate-200 text-base font-extrabold">
                  Brak załączonych fotografii.
                </div>
                <div className="text-slate-500 text-sm font-medium">
                  Kliknij przycisk „Zrób / Dodaj zdjęcie (+)”, aby uruchomić aparat smartfona/tabletu.
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
                {photos.map((item, idx) => (
                  <div
                    key={item.id}
                    className="relative bg-slate-50 dark:bg-slate-800/70 border-2 border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden shadow-sm flex flex-col group"
                  >
                    <div className="relative h-52 bg-slate-200 dark:bg-slate-700">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.photoDataUrl}
                        alt={`Zdjęcie ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-3 left-3 px-3 py-1 bg-slate-900/85 text-white text-xs font-black rounded-lg backdrop-blur-sm">
                        Zdjęcie #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(item.id)}
                        className="absolute top-3 right-3 p-2 bg-rose-600 text-white rounded-xl opacity-90 hover:opacity-100 shadow-md active:scale-95 transition-all cursor-pointer"
                        title="Usuń zdjęcie"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <p className="text-sm sm:text-base text-slate-900 dark:text-slate-100 font-bold leading-relaxed">
                        {item.description}
                      </p>
                      <div className="text-xs text-slate-400 mt-2 font-mono font-semibold">
                        Godzina: {item.takenAt.slice(11, 16)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* GŁÓWNY PRZYCISK: WYŚLIJ RAPORT ZAKOŃCZENIA */}
          <div className="sticky bottom-20 md:bottom-6 z-30 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-4.5 sm:py-5 px-8 rounded-3xl font-black text-lg sm:text-xl shadow-2xl flex items-center justify-center gap-3.5 transition-all cursor-pointer active:scale-98 border-2 border-white/20 ${
                isSubmitting
                  ? "bg-slate-700 text-slate-300 cursor-wait"
                  : "bg-gradient-to-r from-indigo-600 to-slate-900 hover:from-indigo-500 hover:to-slate-800 text-white shadow-indigo-600/40"
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Generowanie i wysyłanie raportu zdaniowego...</span>
                </>
              ) : (
                <>
                  <Send className="w-6 h-6" />
                  <span>Wyślij Raport Zakończenia Prac</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
