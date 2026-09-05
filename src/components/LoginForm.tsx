"use client";

import React, { useCallback, useEffect, useState } from "react";
import { User as UserType, TenantSettings } from "@/types";
import {
  Lock,
  User as UserIcon,
  Shield,
  HardHat,
  ArrowRight,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

interface RosterEntry {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  isForeman: boolean;
  hasPin: boolean;
}

interface LoginFormProps {
  settings?: TenantSettings;
  onLogin: (user: UserType) => void;
}

/**
 * Etap 1 — logowanie w całości po stronie serwera.
 *
 * Ten komponent nie zna i nie może poznać żadnego hasła: wysyła je do
 * /api/auth/login i dostaje albo sesję w ciasteczku httpOnly, albo błąd.
 * Lista pracowników w trybie szybkim pochodzi z /api/auth/roster, który jest
 * za bramką urządzenia i oddaje tylko imię, nazwisko i stanowisko.
 */
export function LoginForm({ settings, onLogin }: LoginFormProps) {
  const [activeMode, setActiveMode] = useState<"standard" | "quick">("quick");
  const [loginInput, setLoginInput] = useState("");
  const [secretInput, setSecretInput] = useState("");
  const [selectedUser, setSelectedUser] = useState<RosterEntry | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [isRosterLoading, setIsRosterLoading] = useState(true);

  const loadRoster = useCallback(async () => {
    setIsRosterLoading(true);
    try {
      const res = await fetch("/api/auth/roster");
      const data = await res.json();
      setRoster(Array.isArray(data?.roster) ? data.roster : []);
    } catch {
      setRoster([]);
    } finally {
      setIsRosterLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  const submitCredentials = async (payload: Record<string, unknown>) => {
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok && data.success && data.user) {
        setSecretInput("");
        onLogin(data.user as UserType);
        return;
      }
      setErrorMessage(data?.message || "Nie udało się zalogować.");
    } catch {
      setErrorMessage("Brak połączenia z serwerem. Sprawdź zasięg i spróbuj ponownie.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStandardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    submitCredentials({
      mode: "password",
      login: loginInput.trim(),
      secret: secretInput,
    });
  };

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || !selectedUser) return;
    submitCredentials({
      mode: "pin",
      userId: selectedUser.id,
      secret: secretInput,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100 font-sans">
      <div className="w-full max-w-md space-y-6 animate-fade-in">
        {/* LOGO I BRANDING FIRMOWY */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3 bg-slate-900/90 border border-slate-800 py-3.5 px-6 rounded-3xl backdrop-blur-md shadow-xl mx-auto inline-flex">
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-black tracking-tight text-sky-400">iDream</span>
              <div className="w-0.5 h-6 bg-slate-700 mx-1"></div>
              <div className="flex flex-col text-[8px] font-extrabold text-slate-400 uppercase tracking-widest text-left leading-none">
                <span>Business</span>
                <span>Center</span>
              </div>
            </div>

            <div className="w-px h-7 bg-slate-800 mx-1"></div>

            <div className="flex items-center gap-2">
              <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
                <polygon points="16,2 6,12 16,22 26,12" fill="#0284c7" />
                <polygon points="6,12 16,22 16,30" fill="#f97316" />
                <polygon points="26,12 16,22 16,30" fill="#ef4444" />
                <polygon points="16,2 26,12 16,22" fill="#38bdf8" />
              </svg>
              <span className="text-lg font-black tracking-tight text-white">
                Solutions<span className="text-sky-400">Bay</span>
              </span>
            </div>
          </div>

          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mt-2">
              RYCOS Shift
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">
              System raportowania odpraw i fotorelacji z budowy
            </p>
          </div>
        </div>

        {/* PRZEŁĄCZNIK TRYBU LOGOWANIA */}
        <div className="flex bg-slate-900/90 border border-slate-800 p-1.5 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              setActiveMode("quick");
              setErrorMessage(null);
              setSecretInput("");
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeMode === "quick"
                ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <HardHat className="w-4 h-4" />
            <span>Wybór Pracownika</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveMode("standard");
              setErrorMessage(null);
              setSecretInput("");
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeMode === "standard"
                ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Login i Hasło</span>
          </button>
        </div>

        {/* KOMUNIKAT BŁĘDU */}
        {errorMessage && (
          <div className="p-4 bg-rose-950/80 border-2 border-rose-600/80 rounded-2xl text-rose-200 text-xs sm:text-sm font-bold flex items-center gap-2.5 animate-shake">
            <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* KARTA FORMULARZA */}
        <div className="bg-slate-900/80 border-2 border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl space-y-6">
          {/* TRYB 1: SZYBKI WYBÓR PRACOWNIKA */}
          {activeMode === "quick" && (
            <form onSubmit={handleQuickSubmit} className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-300">
                    Wybierz swoje konto:
                  </label>
                  <button
                    type="button"
                    onClick={loadRoster}
                    disabled={isRosterLoading}
                    title="Pobierz aktualną listę pracowników"
                    className="inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRosterLoading ? "animate-spin" : ""}`} />
                    <span>{isRosterLoading ? "Pobieranie..." : "Odśwież listę"}</span>
                  </button>
                </div>

                {isRosterLoading ? (
                  <div className="p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3">
                    <RefreshCw className="w-6 h-6 text-sky-400 animate-spin mx-auto" />
                    <p className="text-xs font-bold text-slate-300">
                      Pobieranie listy pracowników...
                    </p>
                  </div>
                ) : roster.length === 0 ? (
                  <div className="p-6 text-center bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2">
                    <p className="text-xs font-bold text-slate-300">
                      Brak pracowników na liście.
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Zaloguj się w trybie „Login i Hasło" jako administrator i dodaj konta
                      w Ustawieniach.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
                    {roster.map((u) => {
                      const isSelected = selectedUser?.id === u.id;
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setSelectedUser(u);
                            setSecretInput("");
                            setErrorMessage(null);
                          }}
                          className={`p-3 rounded-2xl border-2 text-left transition-all flex items-center gap-3 cursor-pointer ${
                            isSelected
                              ? "bg-sky-950/80 border-sky-500 shadow-md shadow-sky-500/20 text-white"
                              : "bg-slate-800/60 border-slate-700/80 hover:bg-slate-800 text-slate-300"
                          } ${u.hasPin ? "" : "opacity-60"}`}
                        >
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs ${
                              u.isForeman ? "bg-sky-500 text-white" : "bg-slate-700 text-slate-200"
                            }`}
                          >
                            {u.firstName[0]}
                            {u.lastName[0]}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-black text-sm truncate text-white">
                              {u.firstName} {u.lastName}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate font-medium">
                              {u.hasPin ? u.role : "Brak PIN-u — zgłoś się do administratora"}
                            </div>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className="w-4 h-4 text-sky-400 flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedUser && (
                <div className="space-y-4 pt-2 border-t border-slate-800 animate-fade-in">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-300 mb-1.5">
                      PIN dla:{" "}
                      <span className="text-sky-400">
                        {selectedUser.firstName} {selectedUser.lastName}
                      </span>
                    </label>
                    <div className="relative">
                      <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        inputMode="numeric"
                        autoComplete="off"
                        required
                        autoFocus
                        placeholder="••••"
                        value={secretInput}
                        onChange={(e) => setSecretInput(e.target.value)}
                        className="w-full h-14 pl-12 pr-4 bg-slate-950 border-2 border-slate-700 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20 rounded-2xl text-base font-semibold text-white placeholder-slate-500 outline-none tracking-[0.3em]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-14 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 active:scale-95 text-white font-black text-base rounded-2xl shadow-xl shadow-sky-600/30 flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? (
                      <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <span>Zaloguj się do systemu</span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </form>
          )}

          {/* TRYB 2: STANDARDOWY LOGIN I HASŁO */}
          {activeMode === "standard" && (
            <form onSubmit={handleStandardSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-300 mb-1.5">
                  Login / Identyfikator pracownika:
                </label>
                <div className="relative">
                  <UserIcon className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    placeholder="np. m.bajda"
                    value={loginInput}
                    onChange={(e) => setLoginInput(e.target.value)}
                    className="w-full h-14 pl-12 pr-4 bg-slate-950 border-2 border-slate-700 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20 rounded-2xl text-base font-semibold text-white placeholder-slate-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-300 mb-1.5">
                  Hasło dostępu:
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={secretInput}
                    onChange={(e) => setSecretInput(e.target.value)}
                    className="w-full h-14 pl-12 pr-4 bg-slate-950 border-2 border-slate-700 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20 rounded-2xl text-base font-semibold text-white placeholder-slate-500 outline-none"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-14 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 active:scale-95 text-white font-black text-base rounded-2xl shadow-xl shadow-sky-600/30 flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isLoading ? (
                    <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <span>Zaloguj się</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          <div className="p-3.5 bg-slate-950/60 rounded-2xl border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
            <Shield className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
            <span>
              Hasła i PIN-y nadaje administrator. Po pięciu nieudanych próbach konto jest
              blokowane na 15 minut.
            </span>
          </div>
        </div>

        {/* STOPKA SYSTEMOWA */}
        <div className="text-center text-xs text-slate-500 space-y-1">
          <div>
            {settings?.organizationName || "iDream Business Center"} •{" "}
            {settings?.logoSubtitle || "SolutionsBay Sp. z o.o."}
          </div>
          <div className="font-mono text-[11px] text-slate-600">RYCOS Shift v1.4</div>
        </div>
      </div>
    </div>
  );
}
