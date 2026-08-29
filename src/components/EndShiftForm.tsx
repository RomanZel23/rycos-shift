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
import { generateReportPDF } from "@/lib/pdf-generator";
import { saveStoredReport } from "@/lib/storage";

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

  const [photos, setPhotos] = useState<PhotoDocumentationItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stan nowego zdjęcia w trakcie dodawania
  const [tempPhotoUrl, setTempPhotoUrl] = useState<string | null>(null);
  const [tempDescription, setTempDescription] = useState("");
  const [isAddingPhoto, setIsAddingPhoto] = useState(false);

  // Statusy wysyłki
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successReport, setSuccessReport] = useState<DailyReport | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

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

  // Kompresja zdjęcia w przeglądarce przed zapisaniem
  const processImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        // Zoptymalizowany JPEG do przesyłania mobilnego
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        setTempPhotoUrl(dataUrl);
        setIsAddingPhoto(true);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processImageFile(file);
    }
    // Zresetuj input, aby umożliwić ponowny wybór tego samego pliku
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleConfirmAddPhoto = () => {
    if (!tempPhotoUrl) return;

    const newItem: PhotoDocumentationItem = {
      id: "photo-" + Date.now(),
      photoDataUrl: tempPhotoUrl,
      description: tempDescription.trim() || "Dokumentacja stanu robót",
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
      setErrorBanner("Dodaj co najmniej jedno zdjęcie z opisem wykonanych robót.");
      return;
    }

    setIsSubmitting(true);

    try {
      const siteName = selectedSite?.name || "Plac Budowy";
      const foremanName = selectedForeman
        ? `${selectedForeman.firstName} ${selectedForeman.lastName}`
        : "Brygadzista";

      const reportData: DailyReport = {
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
            reportType: "END_SHIFT",
            siteName,
            date,
            time,
            recipients: settings.endShiftEmailRecipients,
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

      // 3. Zapis do archiwum
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
    setPhotos([]);
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
              Raport Zakończenia Prac Został Wysłany!
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-lg mx-auto">
              Dokument PDF <strong>{successReport.pdfFileName}</strong> zawierający dokumentację
              fotograficzną został zapisany i wysłany na adresy:
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
          {/* NAGŁÓWEK KARTY */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-2xl p-5 sm:p-6 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-2 border border-indigo-500/30">
                <Camera className="w-3.5 h-3.5" />
                <span>Formularz Zdaniowy</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Zakończenie Prac Zespołu
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                Dokumentacja fotograficzna wykonanych robót z opisami głosowymi lub tekstowymi
              </p>
            </div>

            {/* DATA I GODZINA */}
            <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-white/10 text-xs">
              <div className="flex items-center gap-1.5 text-slate-200">
                <Calendar className="w-4 h-4 text-indigo-400" />
                <span className="font-semibold">{date || "YYYY-MM-DD"}</span>
              </div>
              <span className="text-white/40">|</span>
              <div className="flex items-center gap-1.5 text-slate-200">
                <Clock className="w-4 h-4 text-indigo-400" />
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
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>1. Dane podstawowe i lokalizacja</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Plac Budowy: <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={siteId}
                    onChange={(e) => setSiteId(e.target.value)}
                    className="w-full px-3.5 pr-10 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none appearance-none truncate"
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

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Brygadzista zdający zmianę: <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={foremanId}
                    onChange={(e) => setForemanId(e.target.value)}
                    className="w-full px-3.5 pr-10 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none appearance-none truncate"
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

            <GeoLocationBadge location={location} onLocationChange={setLocation} />
          </div>

          {/* KROK 2: DOKUMENTACJA FOTOGRAFICZNA */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-indigo-600" />
                  <span>2. Dokumentacja wykonanych robót</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Zrób zdjęcie aparatem lub załącz plik z galerii i dodaj opis
                </p>
              </div>

              {/* UKRYTY INPUT PLIKÓW DLA APARATU / GALERII */}
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
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-600/20 active:scale-95 transition-all cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>Zrób / Dodaj zdjęcie (+)</span>
              </button>
            </div>

            {/* FORMULARZ DLA BIEŻĄCEGO ZDJĘCIA (JEŚLI WYBRANO) */}
            {isAddingPhoto && tempPhotoUrl && (
              <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 border-2 border-indigo-200 dark:border-indigo-800 rounded-2xl space-y-3 animate-fade-in">
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300">
                  Opisz nowo zrobione zdjęcie:
                </div>
                <div className="flex flex-col sm:flex-row gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={tempPhotoUrl}
                    alt="Podgląd zdjęcia"
                    className="w-full sm:w-48 h-36 object-cover rounded-xl border border-indigo-200 shadow-md"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Opis wykonanych prac na zdjęciu:
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
                      className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleCancelAddPhoto}
                        className="px-3.5 py-1.5 text-xs font-semibold rounded-lg text-slate-600 hover:bg-slate-200 transition-colors"
                      >
                        Anuluj
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmAddPhoto}
                        className="px-4 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm"
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
              <div className="p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center space-y-2">
                <ImageIcon className="w-8 h-8 text-slate-400 mx-auto" />
                <div className="text-slate-600 dark:text-slate-300 text-xs font-medium">
                  Brak załączonych fotografii.
                </div>
                <div className="text-slate-400 text-[11px]">
                  Kliknij przycisk „Zrób / Dodaj zdjęcie (+)”, aby uruchomić aparat smartfona/tabletu.
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {photos.map((item, idx) => (
                  <div
                    key={item.id}
                    className="relative bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm flex flex-col group"
                  >
                    <div className="relative h-44 bg-slate-200 dark:bg-slate-700">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.photoDataUrl}
                        alt={`Zdjęcie ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-2 left-2 px-2 py-1 bg-slate-900/80 text-white text-[10px] font-bold rounded-md backdrop-blur-sm">
                        Zdjęcie #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(item.id)}
                        className="absolute top-2 right-2 p-1.5 bg-rose-600 text-white rounded-lg opacity-90 hover:opacity-100 shadow-md active:scale-95 transition-all cursor-pointer"
                        title="Usuń zdjęcie"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="p-3 flex-1 flex flex-col justify-between">
                      <p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                        {item.description}
                      </p>
                      <div className="text-[10px] text-slate-400 mt-2 font-mono">
                        Godzina: {item.takenAt.slice(11, 16)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* GŁÓWNY PRZYCISK: WYŚLIJ RAPORT ZAKOŃCZENIA */}
          <div className="sticky bottom-4 z-20 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-4 px-6 rounded-2xl font-black text-base sm:text-lg shadow-2xl flex items-center justify-center gap-3 transition-all cursor-pointer active:scale-98 ${
                isSubmitting
                  ? "bg-slate-700 text-slate-300 cursor-wait"
                  : "bg-gradient-to-r from-indigo-600 to-slate-900 hover:from-indigo-500 hover:to-slate-800 text-white shadow-indigo-600/30"
              }`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Generowanie i wysyłanie raportu zdaniowego...</span>
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
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
