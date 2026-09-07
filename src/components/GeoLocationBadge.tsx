"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { MapPin, RefreshCw, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { GeoLocationData } from "@/types";
import { wykryjPlatforme, wskazowkaLokalizacji } from "@/lib/platform";

interface GeoLocationBadgeProps {
  onLocationChange?: (location: GeoLocationData) => void;
  location: GeoLocationData;
}

/**
 * Odczyt pozycji GPS.
 *
 * Awaria zgłoszona 2026-09-06: na komputerze przycisk „Odśwież" po prostu nie
 * działał. Przyczyna nie leżała w uprawnieniach, tylko tutaj. Przy wejściu na
 * formularz komponent woła `getCurrentPosition` i ustawia `loading`, co
 * wyłączało przycisk. Na telefonie monit o lokalizację jest modalny —
 * zignorowanie go odpala callback błędu, `loading` gaśnie i przycisk wraca do
 * życia. Na komputerze monit to nieblokujący dymek przy pasku adresu: dopóki
 * użytkownik go nie kliknie, przeglądarka NIE woła żadnego callbacku, a
 * `timeout` z opcji nie biegnie. `loading` zostawał więc na zawsze, przycisk
 * był martwy i jedynym wyjściem było przeładowanie strony.
 *
 * Stąd dwie zmiany: własny licznik bezpieczeństwa, który zawsze odblokuje
 * przycisk, oraz odczyt `navigator.permissions` — przy trwałej odmowie żadne
 * klikanie nie wywoła już monitu i trzeba o tym powiedzieć wprost, zamiast
 * kazać ludziom naciskać przycisk, który nic nie zrobi.
 *
 * W komunikatach mowa o „ikonie po lewej stronie adresu”, a nie o kłódce:
 * Chrome pokazuje tam suwaki, Safari literki AA, a kłódka została już tylko
 * w części przeglądarek. Opis kształtu szybciej się dezaktualizuje niż miejsce.
 *
 * Sama wskazówka jest dobierana do systemu (src/lib/platform.ts), bo droga do
 * uprawnienia biegnie gdzie indziej na komputerze, gdzie indziej w Safari na
 * iPadzie, a w aplikacji dodanej do ekranu głównego prowadzi wprost do
 * Ustawień systemu. Zgłoszone 7 września 2026: brygadzista pracujący na iPadzie
 * dostawał instrukcję napisaną pod Chrome na komputerze.
 */

/** Dłuższy niż `timeout` poniżej — wchodzi do gry, gdy przeglądarka milczy. */
const WATCHDOG_MS = 15_000;
const GEO_TIMEOUT_MS = 10_000;

type Uprawnienie = "nieznane" | "pytanie" | "zgoda" | "odmowa";

export function GeoLocationBadge({ onLocationChange, location }: GeoLocationBadgeProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uprawnienie, setUprawnienie] = useState<Uprawnienie>("nieznane");

  const watchdog = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onLocationChangeRef = useRef(onLocationChange);
  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  /** Wskazówka „jak to odblokować" dopasowana do urządzenia użytkownika. */
  const wskazowka = useCallback((): string => {
    if (typeof navigator === "undefined" || typeof window === "undefined") {
      return wskazowkaLokalizacji("komputer");
    }
    const nawigator = navigator as Navigator & { standalone?: boolean };
    return wskazowkaLokalizacji(
      wykryjPlatforme({
        userAgent: nawigator.userAgent,
        maxTouchPoints: nawigator.maxTouchPoints,
        standalone:
          nawigator.standalone === true ||
          window.matchMedia?.("(display-mode: standalone)").matches === true,
      })
    );
  }, []);

  const zatrzymajLicznik = () => {
    if (watchdog.current) {
      clearTimeout(watchdog.current);
      watchdog.current = null;
    }
  };

  /** Stan uprawnienia, jeśli przeglądarka go udostępnia (Permissions API). */
  const odczytajUprawnienie = useCallback(async (): Promise<Uprawnienie> => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return "nieznane";
    try {
      const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
      const stan =
        status.state === "granted" ? "zgoda" : status.state === "denied" ? "odmowa" : "pytanie";
      setUprawnienie(stan);
      return stan;
    } catch {
      return "nieznane";
    }
  }, []);

  const fetchLocation = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setErrorMsg("Geolokalizacja nie jest wspierana przez tę przeglądarkę.");
      return;
    }

    const stan = await odczytajUprawnienie();
    if (stan === "odmowa") {
      // Wywołanie i tak skończyłoby się błędem bez pokazania monitu.
      setLoading(false);
      setErrorMsg(
        `Dostęp do lokalizacji jest zablokowany. ${wskazowka()} Potem naciśnij Odśwież.`
      );
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    // Ratunek na wypadek, gdyby przeglądarka nie zawołała żadnego callbacku.
    zatrzymajLicznik();
    watchdog.current = setTimeout(() => {
      setLoading(false);
      setErrorMsg(
        "Brak odpowiedzi na pytanie o lokalizację. Zezwól na dostęp w okienku przeglądarki " +
          "(zwykle przy pasku adresu), a potem naciśnij Odśwież."
      );
    }, WATCHDOG_MS);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        zatrzymajLicznik();
        setLoading(false);
        setUprawnienie("zgoda");
        onLocationChangeRef.current?.({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (err) => {
        zatrzymajLicznik();
        setLoading(false);
        console.warn("Geolocation warning:", err.code, err.message);

        // Trzy różne sytuacje wymagają trzech różnych reakcji użytkownika.
        if (err.code === err.PERMISSION_DENIED) {
          setUprawnienie("odmowa");
          setErrorMsg(
            `Odmówiono dostępu do lokalizacji. ${wskazowka()} Potem naciśnij Odśwież.`
          );
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setErrorMsg(
            "Nie udało się ustalić pozycji. Na komputerze bez modułu GPS bywa to normalne — " +
              "raport można złożyć bez współrzędnych."
          );
        } else {
          setErrorMsg("Ustalanie pozycji trwało zbyt długo. Naciśnij Odśwież, aby spróbować ponownie.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: GEO_TIMEOUT_MS,
        maximumAge: 60_000,
      }
    );
  }, [odczytajUprawnienie, wskazowka]);

  // Pierwsze pobranie przy wejściu na formularz.
  const pobranoRaz = useRef(false);
  useEffect(() => {
    if (pobranoRaz.current || location.latitude) return;
    pobranoRaz.current = true;
    fetchLocation();
  }, [fetchLocation, location.latitude]);

  // Gdy użytkownik odblokuje lokalizację w ustawieniach przeglądarki, chcemy
  // o tym wiedzieć bez przeładowania strony.
  useEffect(() => {
    let anulowane = false;
    let odepnij: (() => void) | null = null;

    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" as PermissionName })
        .then((s) => {
          if (anulowane) return;
          const zapisz = () => {
            setUprawnienie(
              s.state === "granted" ? "zgoda" : s.state === "denied" ? "odmowa" : "pytanie"
            );
            if (s.state === "granted") {
              setErrorMsg(null);
              fetchLocation();
            }
          };
          s.addEventListener("change", zapisz);
          odepnij = () => s.removeEventListener("change", zapisz);
        })
        .catch(() => {});
    }

    return () => {
      anulowane = true;
      odepnij?.();
      zatrzymajLicznik();
    };
    // Celowo raz: nasłuch ma żyć przez cały czas życia komponentu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasCoords = location.latitude !== null && location.longitude !== null;
  const zablokowane = uprawnienie === "odmowa";

  return (
    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`p-3 rounded-xl shadow-sm flex-shrink-0 ${
            hasCoords ? "bg-sky-500 text-white" : zablokowane ? "bg-rose-500 text-white" : "bg-amber-500 text-white"
          }`}
        >
          <MapPin className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
            <span>Pozycja GPS</span>
            {hasCoords ? (
              <span className="inline-flex items-center text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Aktywna
              </span>
            ) : zablokowane ? (
              <span className="inline-flex items-center text-xs text-rose-700 dark:text-rose-300 font-bold bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 rounded-full">
                <AlertCircle className="w-3.5 h-3.5 mr-1" /> Zablokowana
              </span>
            ) : (
              <span className="inline-flex items-center text-xs text-amber-700 dark:text-amber-300 font-bold bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-full">
                <AlertCircle className="w-3.5 h-3.5 mr-1" /> Oczekiwanie
              </span>
            )}
          </div>
          {hasCoords ? (
            <a
              href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Kliknij, aby otworzyć lokalizację w Google Maps"
              className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-mono font-bold mt-1 hover:text-sky-600 dark:hover:text-sky-400 hover:underline cursor-pointer transition-colors group"
            >
              <span>
                {location.latitude?.toFixed(5)}° N, {location.longitude?.toFixed(5)}° E{" "}
                {location.accuracy ? `(±${Math.round(location.accuracy)}m)` : ""}
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-sky-500 opacity-70 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </a>
          ) : (
            <div className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm font-semibold mt-1 leading-relaxed">
              {errorMsg || (loading ? "Pobieranie pozycji..." : "Naciśnij Odśwież, aby ustalić pozycję.")}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={fetchLocation}
        disabled={loading}
        title="Odśwież współrzędne GPS"
        className="flex items-center gap-2 px-3.5 py-2.5 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 disabled:opacity-60 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-600 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer active:scale-95 shadow-sm flex-shrink-0"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-sky-600" : ""}`} />
        <span className="hidden sm:inline">Odśwież</span>
      </button>
    </div>
  );
}
