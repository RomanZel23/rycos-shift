"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DraftKind,
  DraftPayload,
  clearDraft,
  draftHasContent,
  loadDraft,
  saveDraft,
} from "./draft-store";

/**
 * Automatyczny zapis szkicu formularza.
 *
 * Zapis jest zdławiony (600 ms), żeby wpisywanie opisu zdjęcia nie generowało
 * zapisu na każdą literę. Dodatkowo wymuszamy zapis natychmiastowy przy
 * `visibilitychange` i `pagehide` — na iOS to jedyne zdarzenia, na których można
 * polegać, gdy użytkownik przełącza aplikację albo gasi ekran. `beforeunload`
 * na mobile praktycznie nie działa.
 */

const DEBOUNCE_MS = 600;

interface Options<T> {
  /** Wyłącz zapis po wysłaniu raportu, żeby nie odtworzyć wysłanego szkicu. */
  enabled: boolean;
  /** Wywoływane raz, jeśli przy wejściu znaleziono szkic z treścią. */
  onRestore: (payload: T) => void;
}

export function useFormDraft<T extends DraftPayload>(
  kind: DraftKind,
  payload: T,
  { enabled, onRestore }: Options<T>
) {
  const [restoredAt, setRestoredAt] = useState<string | null>(null);

  const hydrated = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Najświeższy stan pod ręką dla zapisu awaryjnego przy chowaniu aplikacji.
  const latest = useRef(payload);
  const onRestoreRef = useRef(onRestore);

  // Refy aktualizujemy w efekcie, a nie w trakcie renderu. React Compiler
  // (babel-plugin-react-compiler jest włączony w tym projekcie) może zapamiętać
  // ciało komponentu i pominąć przypisanie w renderze — wtedy `latest.current`
  // zostałby ze starą zawartością formularza i zapis awaryjny przy chowaniu
  // aplikacji utrwaliłby stan sprzed kilku zdjęć. Czyli dokładnie tę stratę,
  // której ten hook ma zapobiegać.
  useEffect(() => {
    latest.current = payload;
  }, [payload]);

  useEffect(() => {
    onRestoreRef.current = onRestore;
  }, [onRestore]);

  const isEmpty = useCallback((value: DraftPayload): boolean => {
    const v = value as unknown as Record<string, unknown>;
    const photos = Array.isArray(v.photos) ? v.photos : [];
    const attendance = Array.isArray(v.attendanceList) ? v.attendanceList : [];
    return photos.length === 0 && attendance.length === 0 && !v.siteId;
  }, []);

  // Wejście do formularza: spróbuj wczytać szkic.
  useEffect(() => {
    let cancelled = false;
    loadDraft(kind)
      .then((draft) => {
        if (cancelled || !draft) return;
        if (!draftHasContent(kind, draft.payload)) return;
        onRestoreRef.current(draft.payload as T);
        setRestoredAt(draft.updatedAt);
      })
      .finally(() => {
        // Dopiero teraz wolno zapisywać — inaczej pusty stan początkowy
        // nadpisałby szkic, zanim zdąży się wczytać.
        if (!cancelled) hydrated.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  // Zapis zdławiony przy każdej zmianie stanu.
  useEffect(() => {
    if (!enabled || !hydrated.current) return;
    if (isEmpty(payload)) return;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveDraft(kind, payload);
    }, DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [kind, payload, enabled, isEmpty]);

  // Zapis awaryjny, gdy system zabiera aplikację.
  useEffect(() => {
    if (!enabled) return;

    const flush = () => {
      if (!hydrated.current) return;
      if (isEmpty(latest.current)) return;
      if (timer.current) clearTimeout(timer.current);
      saveDraft(kind, latest.current);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, [kind, enabled, isEmpty]);

  /** Skasowanie szkicu — po udanej wysyłce albo na życzenie użytkownika. */
  const discard = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setRestoredAt(null);
    return clearDraft(kind);
  }, [kind]);

  return { restoredAt, discard };
}
