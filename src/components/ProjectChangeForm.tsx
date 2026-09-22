"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Camera,
  ClipboardPen,
  ImagePlus,
  Loader2,
  RotateCcw,
  Send,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import type {
  ChangePhoto,
  ChangeSection,
  ConstructionSite,
  DailyReport,
  GeoLocationData,
  ProjectChange,
  User,
} from "@/types";
import { GeoLocationBadge } from "./GeoLocationBadge";
import { VoiceInputButton } from "./VoiceInputButton";
import { useFormDraft } from "@/lib/use-form-draft";
import { ProjectChangeDraft, formatDraftTime } from "@/lib/draft-store";
import { newPrefixedId } from "@/lib/ids";
import { compressImageFile } from "@/lib/image-compress";
import { toAppFileUrl } from "@/lib/storage-paths";
import { getPolishCurrentDate } from "@/lib/date-utils";
import { formatDateTaken } from "@/lib/exif";
import { validateChangeContent, type ChangeSectionKey } from "@/lib/project-change";

interface ProjectChangeFormProps {
  currentUser: User;
  sites: ConstructionSite[];
  users: User[];
  /** Do podpowiedzi placu z dzisiejszego raportu rozpoczęcia. */
  reports: DailyReport[];
  /** Edycja wysłanej karty (autor, przed pierwszą akceptacją). */
  editing?: ProjectChange | null;
  onSent: (change: ProjectChange, mailProblems: string[]) => void;
  onCancel: () => void;
}

const EMPTY_SECTION: ChangeSection = { description: "", photos: [] };

function photoSrc(p: ChangePhoto): string {
  if (p.dataUrl) return p.dataUrl;
  if (p.path) return toAppFileUrl(p.path);
  return "";
}

/** Wgranie jednego zdjęcia; zwraca ścieżkę w buckecie albo null. */
async function uploadPhoto(
  changeId: string,
  section: ChangeSectionKey,
  photo: ChangePhoto
): Promise<string | null> {
  if (!photo.dataUrl) return photo.path || null;
  try {
    const res = await fetch("/api/changes/photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ changeId, section, photoId: photo.id, dataUrl: photo.dataUrl }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.success || typeof data.path !== "string") return null;
    return data.path;
  } catch {
    return null;
  }
}

export function ProjectChangeForm({
  currentUser,
  sites,
  users,
  reports,
  editing,
  onSent,
  onCancel,
}: ProjectChangeFormProps) {
  const isEdit = Boolean(editing);

  const [changeId] = useState(() => editing?.id || newPrefixedId("chg"));
  const [sendKey, setSendKey] = useState(() => newPrefixedId("send"));
  const [siteId, setSiteId] = useState(editing?.siteId || "");
  const [location, setLocation] = useState<GeoLocationData>(
    editing?.location || { latitude: null, longitude: null, accuracy: null }
  );
  const [name, setName] = useState(editing?.name || "");
  const [current, setCurrent] = useState<ChangeSection>(editing?.current || EMPTY_SECTION);
  const [target, setTarget] = useState<ChangeSection>(editing?.target || EMPTY_SECTION);
  const [knaRequired, setKnaRequired] = useState(Boolean(editing?.knaRequired));
  const [excludedAcceptorIds, setExcludedAcceptorIds] = useState<string[]>(() => {
    if (!editing) return [];
    // Przy edycji zaznaczeni są ci, którzy byli na bieżącej wersji.
    const byli = new Set(editing.decisions.map((d) => d.acceptorId));
    return users.filter((u) => u.canAcceptChanges && !byli.has(u.id)).map((u) => u.id);
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const acceptors = useMemo(() => users.filter((u) => u.canAcceptChanges), [users]);

  // --- Szkic (tylko nowa karta) -------------------------------------------
  const draftPayload = useMemo<ProjectChangeDraft>(
    () => ({
      changeId,
      sendKey,
      siteId,
      location,
      name,
      current,
      target,
      knaRequired,
      excludedAcceptorIds,
    }),
    [changeId, sendKey, siteId, location, name, current, target, knaRequired, excludedAcceptorIds]
  );

  // Identyfikator karty pochodzi ze szkicu — przy odtworzeniu musimy go przejąć,
  // bo zdjęcia leżą już w buckecie pod ścieżką z tym id.
  const [restoredId, setRestoredId] = useState<string | null>(null);
  const effectiveId = restoredId || changeId;

  const { restoredAt, discard: discardDraft } = useFormDraft<ProjectChangeDraft>(
    "PROJECT_CHANGE",
    { ...draftPayload, changeId: effectiveId },
    {
      enabled: !isEdit,
      onRestore: (d) => {
        if (d.changeId) setRestoredId(d.changeId);
        if (d.sendKey) setSendKey(d.sendKey);
        if (d.siteId) setSiteId(d.siteId);
        if (d.location) setLocation(d.location);
        setName(d.name || "");
        if (d.current) setCurrent(d.current);
        if (d.target) setTarget(d.target);
        setKnaRequired(Boolean(d.knaRequired));
        if (Array.isArray(d.excludedAcceptorIds)) setExcludedAcceptorIds(d.excludedAcceptorIds);
      },
    }
  );

  // --- Domyślny plac: z dzisiejszego raportu rozpoczęcia tego brygadzisty ---
  useEffect(() => {
    if (siteId || sites.length === 0) return;
    const dzis = getPolishCurrentDate();
    const moj = reports.find(
      (r) =>
        r.reportType === "START_SHIFT" &&
        r.date === dzis &&
        (r.foremanId === currentUser.id || r.createdBy === currentUser.id) &&
        sites.some((s) => s.id === r.siteId)
    );
    setSiteId(moj?.siteId || sites[0].id);
  }, [siteId, sites, reports, currentUser.id]);

  // --- Zdjęcia -------------------------------------------------------------
  const setSection = useCallback(
    (key: ChangeSectionKey, updater: (s: ChangeSection) => ChangeSection) => {
      if (key === "jest") setCurrent(updater);
      else setTarget(updater);
    },
    []
  );

  const replacePhoto = useCallback(
    (key: ChangeSectionKey, photoId: string, patch: Partial<ChangePhoto>) => {
      setSection(key, (s) => ({
        ...s,
        photos: s.photos.map((p) => (p.id === photoId ? { ...p, ...patch } : p)),
      }));
    },
    [setSection]
  );

  // Zdjęcia wgrywamy od razu po dodaniu. Nieudane zostają jako base64
  // w szkicu i idą jeszcze raz przy „Wyślij".
  const idRef = useRef(effectiveId);
  useEffect(() => {
    idRef.current = effectiveId;
  }, [effectiveId]);

  const tryUpload = useCallback(
    async (key: ChangeSectionKey, photo: ChangePhoto) => {
      const path = await uploadPhoto(idRef.current, key, photo);
      if (path) replacePhoto(key, photo.id, { path, dataUrl: undefined });
      return path;
    },
    [replacePhoto]
  );

  const handleFiles = async (key: ChangeSectionKey, files: FileList | null, source: "aparat" | "galeria") => {
    if (!files || files.length === 0) return;
    setPhotoError(null);
    for (const file of Array.from(files)) {
      try {
        const { dataUrl, capturedAt } = await compressImageFile(file, source);
        const photo: ChangePhoto = {
          id: newPrefixedId("foto"),
          dataUrl,
          takenAt: new Date().toISOString(),
          source,
          ...(capturedAt ? { capturedAt } : {}),
        };
        setSection(key, (s) => ({ ...s, photos: [...s.photos, photo] }));
        void tryUpload(key, photo);
      } catch (err) {
        setPhotoError(err instanceof Error ? err.message : "Nie udało się dodać zdjęcia.");
      }
    }
  };

  const removePhoto = (key: ChangeSectionKey, photoId: string) => {
    setSection(key, (s) => ({ ...s, photos: s.photos.filter((p) => p.id !== photoId) }));
  };

  // --- Wysyłka ------------------------------------------------------------
  const selectedAcceptors = acceptors.filter((a) => !excludedAcceptorIds.includes(a.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);

    const problem = validateChangeContent({ name, siteId, current, target });
    if (problem) {
      setErrorBanner(problem);
      return;
    }
    if (selectedAcceptors.length === 0) {
      setErrorBanner("Zaznacz co najmniej jednego akceptującego.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Dosłanie zdjęć, które jeszcze czekają.
      const wgraj = async (key: ChangeSectionKey, sekcja: ChangeSection) => {
        const out: ChangePhoto[] = [];
        for (const p of sekcja.photos) {
          const path = p.path && !p.dataUrl ? p.path : await tryUpload(key, p);
          if (!path) return null;
          out.push({ ...p, path, dataUrl: undefined });
        }
        return out;
      };
      const [fotoJest, fotoPowinno] = [await wgraj("jest", current), await wgraj("powinno", target)];
      if (!fotoJest || !fotoPowinno) {
        setErrorBanner(
          "Nie wszystkie zdjęcia udało się wgrać — prawdopodobnie brak zasięgu. Karta jest zapisana na urządzeniu; spróbuj wysłać ponownie."
        );
        return;
      }

      // 2. Karta.
      let res: Response | null = null;
      try {
        res = await fetch("/api/changes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sendKey,
            acceptorIds: selectedAcceptors.map((a) => a.id),
            change: {
              id: effectiveId,
              siteId,
              location,
              name,
              knaRequired,
              current: { description: current.description, photos: fotoJest },
              target: { description: target.description, photos: fotoPowinno },
            },
          }),
        });
      } catch {
        res = null;
      }
      const data = res ? await res.json().catch(() => null) : null;

      if (!res || !res.ok || !data?.success || !data.change) {
        setErrorBanner(
          `${data?.message || "Brak połączenia z serwerem."} Karta jest zapisana na urządzeniu — możesz nacisnąć „Wyślij” ponownie, nie powstanie duplikat.`
        );
        return;
      }

      const problemy: string[] = (Array.isArray(data.mail) ? data.mail : [])
        .filter((m: { ok: boolean }) => !m.ok)
        .map((m: { acceptorName: string; message: string }) => `${m.acceptorName}: ${m.message}`);

      if (!isEdit) await discardDraft();
      setSendKey(newPrefixedId("send"));
      onSent(data.change as ProjectChange, problemy);
    } catch (err) {
      console.error("Wysyłka karty zmiany:", err);
      setErrorBanner(
        `Nieoczekiwany błąd: ${err instanceof Error ? err.message : String(err)}. Karta jest zapisana na urządzeniu.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const zaczniOdNowa = async () => {
    await discardDraft();
    setRestoredId(newPrefixedId("chg"));
    setSendKey(newPrefixedId("send"));
    setName("");
    setCurrent(EMPTY_SECTION);
    setTarget(EMPTY_SECTION);
    setKnaRequired(false);
    setExcludedAcceptorIds([]);
  };

  const oczekujaceZdjecia =
    current.photos.filter((p) => p.dataUrl).length + target.photos.filter((p) => p.dataUrl).length;

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-4xl mx-auto pb-32 md:pb-20 space-y-5">
      {/* NAGŁÓWEK */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-700/50">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/25 text-emerald-300 text-xs sm:text-sm font-black uppercase tracking-wider mb-2.5 border border-emerald-500/40">
            <ClipboardPen className="w-4 h-4" />
            <span>{isEdit ? `Edycja karty ${editing?.number}` : "Nowa karta"}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
            Zmiana w projekcie
          </h1>
          <p className="text-sm sm:text-base text-slate-300 mt-1 font-medium">
            Opisz stan obecny i docelowy — akceptujący dostaną kartę mailem
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="self-start sm:self-auto flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 rounded-2xl text-sm font-bold cursor-pointer"
        >
          <X className="w-4 h-4" />
          <span>Wróć do listy</span>
        </button>
      </div>

      {isEdit && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800 rounded-2xl text-sm font-semibold text-amber-900 dark:text-amber-100">
          Po wysłaniu zmienionej karty dotychczasowe decyzje tracą ważność, a akceptujący dostaną
          nowy link. Poprzednia wersja zostaje w historii.
        </div>
      )}

      {restoredAt && !isEdit && (
        <div className="p-3.5 bg-sky-50 dark:bg-sky-950/50 border-2 border-sky-300 dark:border-sky-800 rounded-2xl flex items-start gap-2.5">
          <RotateCcw className="w-4 h-4 text-sky-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-xs font-black text-sky-900 dark:text-sky-200">
            Przywrócono niedokończoną kartę z godz. {formatDraftTime(restoredAt)}
          </div>
          <button
            type="button"
            onClick={zaczniOdNowa}
            className="px-3 py-1.5 text-[11px] font-black text-sky-800 dark:text-sky-200 bg-sky-100 dark:bg-sky-900/70 rounded-xl cursor-pointer"
          >
            Zacznij od nowa
          </button>
        </div>
      )}

      {errorBanner && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/70 border-2 border-rose-300 dark:border-rose-800 rounded-2xl text-rose-900 dark:text-rose-100 text-sm font-bold flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 flex-shrink-0 text-rose-600" />
          <span>{errorBanner}</span>
        </div>
      )}

      {/* 1. DANE PODSTAWOWE */}
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-md space-y-5">
        <h2 className="text-base sm:text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5 pb-1 border-b border-slate-100 dark:border-slate-800">
          <Building2 className="w-5 h-5 text-emerald-600" />
          <span>1. Nazwa i miejsce</span>
        </h2>

        <div>
          <label className="block text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-200 mb-2">
            Nazwa: <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            maxLength={200}
            onChange={(e) => setName(e.target.value)}
            placeholder="np. Przesunięcie otworu drzwiowego w osi B"
            className="w-full h-14 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-base sm:text-lg font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-200 mb-2">
            Plac budowy: <span className="text-rose-500">*</span>
          </label>
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="w-full h-14 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-base sm:text-lg font-bold text-slate-900 dark:text-white focus:outline-none cursor-pointer"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <GeoLocationBadge location={location} onLocationChange={setLocation} />
      </div>

      {/* 2 i 3. JEST / POWINNO BYĆ */}
      <SectionEditor
        index={2}
        title="Jest"
        sectionKey="jest"
        section={current}
        onDescription={(fn) => setCurrent((s) => ({ ...s, description: fn(s.description) }))}
        onFiles={handleFiles}
        onRemove={removePhoto}
        onRetry={(p) => tryUpload("jest", p)}
      />
      <SectionEditor
        index={3}
        title="Powinno być"
        sectionKey="powinno"
        section={target}
        onDescription={(fn) => setTarget((s) => ({ ...s, description: fn(s.description) }))}
        onFiles={handleFiles}
        onRemove={removePhoto}
        onRetry={(p) => tryUpload("powinno", p)}
      />

      {photoError && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-300 dark:border-rose-800 rounded-2xl text-rose-800 dark:text-rose-200 text-sm font-bold">
          {photoError}
        </div>
      )}

      {/* 4. KNA */}
      <label
        className={`flex items-start gap-3.5 p-5 rounded-3xl border-2 cursor-pointer shadow-md ${
          knaRequired
            ? "bg-rose-50 dark:bg-rose-950/40 border-rose-400 dark:border-rose-700"
            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
        }`}
      >
        <input
          type="checkbox"
          checked={knaRequired}
          onChange={(e) => setKnaRequired(e.target.checked)}
          className="mt-1 w-6 h-6 rounded-lg border-slate-400 text-rose-600 focus:ring-rose-500"
        />
        <div>
          <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
            4. Konieczne KNA
          </div>
          <div className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">
            Zaznaczenie oznacza konieczność rewizji całego projektu od początku.
          </div>
        </div>
      </label>

      {/* 5. AKCEPTUJĄCY */}
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-md space-y-4">
        <h2 className="text-base sm:text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5 pb-1 border-b border-slate-100 dark:border-slate-800">
          <UserCheck className="w-5 h-5 text-emerald-600" />
          <span>5. Akceptujący</span>
        </h2>
        {acceptors.length === 0 ? (
          <div className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            Nikt nie ma kompetencji „Akceptacja zmian w projekcie”. Administrator nadaje ją w
            Ustawieniach → Użytkownicy → Kompetencje.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {acceptors.map((a) => {
              const checked = !excludedAcceptorIds.includes(a.id);
              return (
                <label
                  key={a.id}
                  className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 cursor-pointer ${
                    checked
                      ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 dark:border-emerald-700"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) =>
                      setExcludedAcceptorIds((prev) =>
                        e.target.checked ? prev.filter((x) => x !== a.id) : [...prev, a.id]
                      )
                    }
                    className="w-5 h-5 rounded-lg border-slate-400 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="text-sm font-black text-slate-900 dark:text-white">
                      {a.firstName} {a.lastName}
                    </div>
                    <div className="text-xs font-semibold text-slate-500">{a.role}</div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>

      {/* Komunikat także tuż nad przyciskiem — górny baner jest poza ekranem,
          gdy użytkownik naciska „Wyślij" na dole długiego formularza. */}
      {errorBanner && (
        <div
          role="alert"
          className="p-4 bg-rose-50 dark:bg-rose-950/70 border-2 border-rose-300 dark:border-rose-800 rounded-2xl text-rose-900 dark:text-rose-100 text-sm font-bold flex items-center gap-3"
        >
          <AlertTriangle className="w-6 h-6 flex-shrink-0 text-rose-600" />
          <span>{errorBanner}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-5 px-8 rounded-3xl font-black text-lg sm:text-xl shadow-2xl flex items-center justify-center gap-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white disabled:opacity-60 cursor-pointer"
      >
        {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
        <span>
          {isSubmitting
            ? "Wysyłanie…"
            : isEdit
            ? "Wyślij zmienioną kartę"
            : "Wyślij"}
        </span>
      </button>
      {oczekujaceZdjecia > 0 && !isSubmitting && (
        <p className="text-center text-xs font-semibold text-slate-500">
          {oczekujaceZdjecia} zdjęć czeka na wgranie — pójdą razem z kartą.
        </p>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------

interface SectionEditorProps {
  index: number;
  title: string;
  sectionKey: ChangeSectionKey;
  section: ChangeSection;
  /** Aktualizacja przez funkcję — dyktowanie dopisuje do NAJŚWIEŻSZEGO tekstu. */
  onDescription: (update: (prev: string) => string) => void;
  onFiles: (key: ChangeSectionKey, files: FileList | null, source: "aparat" | "galeria") => void;
  onRemove: (key: ChangeSectionKey, photoId: string) => void;
  onRetry: (photo: ChangePhoto) => void;
}

function SectionEditor({
  index,
  title,
  sectionKey,
  section,
  onDescription,
  onFiles,
  onRemove,
  onRetry,
}: SectionEditorProps) {
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const galleryRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-md space-y-5">
      <h2 className="text-base sm:text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white pb-1 border-b border-slate-100 dark:border-slate-800">
        {index}. {title}
      </h2>

      {/* Zdjęcia */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
            Zdjęcia ({section.photos.length})
          </div>
          <div className="flex flex-wrap gap-2.5">
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                onFiles(sectionKey, e.target.files, "aparat");
                e.target.value = "";
              }}
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                onFiles(sectionKey, e.target.files, "galeria");
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex items-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-sm font-black cursor-pointer active:scale-95"
            >
              <Camera className="w-5 h-5" />
              <span>Zrób zdjęcie</span>
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="flex items-center gap-2 px-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white rounded-2xl text-sm font-black cursor-pointer active:scale-95"
            >
              <ImagePlus className="w-5 h-5" />
              <span>Z galerii</span>
            </button>
          </div>
        </div>

        {section.photos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {section.photos.map((p, i) => (
              <div
                key={p.id}
                className="relative rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoSrc(p)} alt={`${title} ${i + 1}`} className="w-full h-32 sm:h-36 object-cover" />
                <span className="absolute top-2 left-2 px-2 py-0.5 bg-slate-900/85 text-white text-[11px] font-black rounded-lg">
                  #{i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(sectionKey, p.id)}
                  title="Usuń zdjęcie"
                  className="absolute top-2 right-2 p-1.5 bg-rose-600 text-white rounded-xl cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                {p.dataUrl && (
                  <button
                    type="button"
                    onClick={() => onRetry(p)}
                    className="absolute bottom-0 inset-x-0 py-1 bg-amber-500/90 text-slate-950 text-[11px] font-black cursor-pointer"
                    title="Zdjęcie jeszcze nie jest na serwerze — dotknij, aby wgrać"
                  >
                    Czeka na wgranie
                  </button>
                )}
                {!p.dataUrl && p.source === "galeria" && (
                  <span className="absolute bottom-0 inset-x-0 py-1 bg-slate-900/70 text-white text-[10px] font-semibold text-center">
                    {formatDateTaken(p.capturedAt)
                      ? `z galerii • ${formatDateTaken(p.capturedAt)}`
                      : "z galerii • brak daty"}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Opis */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-extrabold text-slate-800 dark:text-slate-200">Opis:</label>
          <VoiceInputButton
            onTranscript={(txt) => onDescription((prev) => (prev ? `${prev} ${txt}` : txt))}
            placeholderText={`Podyktuj opis „${title}”...`}
          />
        </div>
        <textarea
          rows={4}
          value={section.description}
          maxLength={5000}
          onChange={(e) => {
            const v = e.target.value;
            onDescription(() => v);
          }}
          placeholder="Wpisz opis lub użyj mikrofonu…"
          className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-base font-medium text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-none"
        />
      </div>
    </div>
  );
}
