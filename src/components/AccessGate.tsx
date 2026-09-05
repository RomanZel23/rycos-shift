"use client";

import React, { useState } from "react";
import { KeyRound, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";

interface AccessGateProps {
  onUnlocked: () => void;
}

/**
 * Etap 0 — jednorazowa autoryzacja urządzenia kodem dostępu.
 *
 * Ekran pokazuje się raz na urządzenie (ciasteczko httpOnly, 30 dni), przed
 * logowaniem pracownika. Etap 1 zastąpi tę bramkę pełną sesją użytkownika.
 */
export function AccessGate({ onUnlocked }: AccessGateProps) {
  const [code, setCode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || isLoading) return;

    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/gate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setCode("");
        onUnlocked();
        return;
      }

      setErrorMessage(data.message || "Nie udało się autoryzować urządzenia.");
    } catch {
      setErrorMessage("Brak połączenia z serwerem. Sprawdź zasięg i spróbuj ponownie.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100 font-sans">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-sky-600/20 border border-sky-700/60 flex items-center justify-center">
            <ShieldCheck className="w-8 h-8 text-sky-400" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              RYCOS Shift
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium mt-1">
              Autoryzacja urządzenia
            </p>
          </div>
        </div>

        {errorMessage && (
          <div className="p-4 bg-rose-950/80 border-2 border-rose-600/80 rounded-2xl text-rose-200 text-xs sm:text-sm font-bold flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl"
        >
          <p className="text-sm text-slate-300 leading-relaxed">
            To urządzenie nie ma jeszcze dostępu do systemu. Wpisz kod dostępu otrzymany
            od administratora — wystarczy raz na telefon.
          </p>

          <div className="space-y-2">
            <label
              htmlFor="access-code"
              className="text-[11px] font-black uppercase tracking-widest text-slate-400"
            >
              Kod dostępu
            </label>
            <div className="relative">
              <KeyRound className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                id="access-code"
                type="password"
                inputMode="text"
                autoComplete="one-time-code"
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border-2 border-slate-800 focus:border-sky-500 rounded-2xl py-3.5 pl-12 pr-4 text-base text-white placeholder:text-slate-600 outline-none transition-colors font-mono tracking-widest"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!code.trim() || isLoading}
            className="w-full py-3.5 rounded-2xl bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-black text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {isLoading ? "Sprawdzanie..." : "Autoryzuj urządzenie"}
            {!isLoading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>

        <p className="text-center text-[11px] text-slate-500 px-4 leading-relaxed">
          Kod dostępu chroni raporty z danymi osobowymi pracowników. Nie przekazuj go
          osobom spoza zespołu.
        </p>
      </div>
    </div>
  );
}
