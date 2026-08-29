"use client";

import React, { useEffect, useState, useCallback } from "react";
import { MapPin, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
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
    <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-xs">
      <div className="flex items-center gap-2.5">
        <div className={`p-2 rounded-lg ${hasCoords ? "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300" : "bg-amber-100 text-amber-700"}`}>
          <MapPin className="w-4 h-4" />
        </div>
        <div>
          <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <span>Pozycja GPS</span>
            {hasCoords ? (
              <span className="inline-flex items-center text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="w-3 h-3 mr-0.5" /> Aktywna
              </span>
            ) : (
              <span className="inline-flex items-center text-[10px] text-amber-600 font-medium">
                <AlertCircle className="w-3 h-3 mr-0.5" /> Oczekiwanie
              </span>
            )}
          </div>
          <div className="text-slate-500 dark:text-slate-400 text-[11px] font-mono mt-0.5">
            {hasCoords
              ? `${location.latitude?.toFixed(5)}° N, ${location.longitude?.toFixed(5)}° E ${location.accuracy ? `(±${Math.round(location.accuracy)}m)` : ""}`
              : errorMsg || "Pobieranie pozycji..."}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={fetchLocation}
        disabled={loading}
        title="Odśwież współrzędne GPS"
        className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg font-medium transition-colors cursor-pointer active:scale-95"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-sky-600" : ""}`} />
        <span className="hidden sm:inline">Odśwież</span>
      </button>
    </div>
  );
}
