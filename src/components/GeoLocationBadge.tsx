"use client";

import React, { useEffect, useState, useCallback } from "react";
import { MapPin, RefreshCw, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import { GeoLocationData } from "@/types";

interface GeoLocationBadgeProps {
  onLocationChange?: (location: GeoLocationData) => void;
  location: GeoLocationData;
}

export function GeoLocationBadge({ onLocationChange, location }: GeoLocationBadgeProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchLocation = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setErrorMsg("Geolokalizacja nie jest wspierana przez Twoją przeglądarkę");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords: GeoLocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setLoading(false);
        if (onLocationChange) {
          onLocationChange(coords);
        }
      },
      (err) => {
        setLoading(false);
        console.warn("Geolocation warning:", err.message);
        // Fallback default coordinates (Poznań center) if permission blocked
        if (!location.latitude) {
          const fallback: GeoLocationData = {
            latitude: 52.4064,
            longitude: 16.9252,
            accuracy: 50,
          };
          if (onLocationChange) onLocationChange(fallback);
        }
        setErrorMsg("Brak uprawnień GPS (użyto współrzędnych placu)");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  }, [onLocationChange, location.latitude]);

  useEffect(() => {
    if (!location.latitude) {
      fetchLocation();
    }
  }, [fetchLocation, location.latitude]);

  const hasCoords = location.latitude !== null && location.longitude !== null;

  return (
    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`p-3 rounded-xl shadow-sm flex-shrink-0 ${
            hasCoords
              ? "bg-sky-500 text-white"
              : "bg-amber-500 text-white"
          }`}
        >
          <MapPin className="w-5 h-5" />
        </div>
        <div>
          <div className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white flex items-center gap-2">
            <span>Pozycja GPS</span>
            {hasCoords ? (
              <span className="inline-flex items-center text-xs text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Aktywna
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
            <div className="text-slate-600 dark:text-slate-300 text-xs sm:text-sm font-mono font-semibold mt-1">
              {errorMsg || "Pobieranie pozycji..."}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={fetchLocation}
        disabled={loading}
        title="Odśwież współrzędne GPS"
        className="flex items-center gap-2 px-3.5 py-2.5 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-900 dark:text-white border-2 border-slate-300 dark:border-slate-600 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer active:scale-95 shadow-sm"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-sky-600" : ""}`} />
        <span className="hidden sm:inline">Odśwież</span>
      </button>
    </div>
  );
}
