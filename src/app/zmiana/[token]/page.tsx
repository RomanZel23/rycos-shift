"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

/**
 * Wejście akceptującego z linku w mailu: /zmiana/<token>.
 *
 * Link + PIN. Po poprawnym PIN-ie serwer zakłada sesję i autoryzuje tę
 * przeglądarkę, a my przechodzimy do aplikacji z otwartą kartą.
 * Kolejne wejścia — zwykłe logowanie w aplikacji.
 */
export default function ChangeLinkPage() {
  const params = useParams<{ token: string }>();
  const token = typeof params?.token === "string" ? params.token : "";

  const [info, setInfo] = useState<{ acceptorName: string; number: string; name: string } | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [ladowanie, setLadowanie] = useState(true);
  const [pin, setPin] = useState("");
  const [wysylanie, setWysylanie] = useState(false);

  useEffect(() => {
    let anulowane = false;
    fetch(`/api/changes/link?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (anulowane) return;
        if (data?.success) setInfo(data);
        else setBlad(data?.message || "Ten link jest nieprawidłowy.");
      })
      .catch(() => {
        if (!anulowane) setBlad("Brak połączenia z serwerem.");
      })
      .finally(() => {
        if (!anulowane) setLadowanie(false);
      });
    return () => {
      anulowane = true;
    };
  }, [token]);

  const zaloguj = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin) return;
    setWysylanie(true);
    setBlad(null);
    try {
      const res = await fetch("/api/changes/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, pin }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setBlad(data?.message || "Nie udało się zalogować.");
        setPin("");
        return;
      }
      window.location.replace(`/?zmiana=${encodeURIComponent(data.changeId)}`);
    } catch {
      setBlad("Brak połączenia z serwerem.");
    } finally {
      setWysylanie(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border-2 border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 text-white">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/95 p-2.5 flex-shrink-0">
            <BrandLogo kind="mark" variant="light" className="w-full h-full" />
          </div>
          <div>
            <div className="font-black text-lg">
              RYCOS <span className="text-sky-400">Shift</span>
            </div>
            <div className="text-xs text-slate-400 font-semibold">Rejestr zmian w projekcie</div>
          </div>
        </div>

        {ladowanie ? (
          <div className="py-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-500" />
          </div>
        ) : info ? (
          <form onSubmit={zaloguj} className="space-y-5">
            <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-1">
              <div className="font-mono text-xs font-black text-emerald-400">{info.number}</div>
              <div className="text-base font-black">{info.name}</div>
              <div className="text-xs text-slate-400 font-semibold">dla: {info.acceptorName}</div>
            </div>

            <div>
              <label className="block text-sm font-extrabold text-slate-200 mb-2">
                Podaj swój PIN
              </label>
              <div className="relative">
                <KeyRound className="w-5 h-5 text-slate-500 absolute left-4 top-4" />
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  className="w-full h-13 pl-12 pr-4 bg-slate-800 border-2 border-slate-700 rounded-2xl text-xl font-black tracking-[0.4em] focus:outline-none focus:border-emerald-500"
                />
              </div>
              <p className="mt-2 text-xs text-slate-400 font-semibold">
                PIN nadaje administrator. Po zalogowaniu następnym razem wejdziesz do aplikacji
                bezpośrednio.
              </p>
            </div>

            {blad && (
              <div className="p-3 bg-rose-950/60 border-2 border-rose-800 rounded-2xl text-sm font-bold text-rose-200">
                {blad}
              </div>
            )}

            <button
              type="submit"
              disabled={wysylanie || pin.length < 4}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-base font-black disabled:opacity-50 cursor-pointer"
            >
              {wysylanie ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
              Otwórz kartę zmiany
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-rose-950/60 border-2 border-rose-800 rounded-2xl text-sm font-bold text-rose-200">
              {blad}
            </div>
            <Link
              href="/"
              className="block text-center py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-sm font-black"
            >
              Przejdź do logowania w aplikacji
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
