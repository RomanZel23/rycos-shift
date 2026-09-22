"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ClipboardPen, Loader2, Plus, RefreshCw, Search } from "lucide-react";
import type { ConstructionSite, DailyReport, ProjectChange, User } from "@/types";
import { ProjectChangeForm } from "./ProjectChangeForm";
import { ProjectChangeDetail, statusBadgeClass } from "./ProjectChangeDetail";
import { formatPolishDateTimeShort } from "@/lib/date-utils";
import { canInitiateChanges, changeStatusLabel, pendingDecisionFor } from "@/lib/project-change";

interface Props {
  currentUser: User;
  sites: ConstructionSite[];
  users: User[];
  reports: DailyReport[];
  /** Karta do otwarcia od razu (np. po wejściu z linku w mailu). */
  focusChangeId?: string | null;
  onFocusHandled?: () => void;
  /** Tryb sekcji w Archiwum — bez zakładania nowych kart. */
  archiveOnly?: boolean;
}

type Widok =
  | { typ: "lista" }
  | { typ: "nowa" }
  | { typ: "edycja"; karta: ProjectChange }
  | { typ: "karta"; id: string };

const FILTRY: Array<{ id: "ALL" | ProjectChange["status"]; label: string }> = [
  { id: "ALL", label: "Wszystkie" },
  { id: "PENDING", label: "Oczekuje" },
  { id: "ACCEPTED", label: "Zaakceptowane" },
  { id: "REJECTED", label: "Odrzucone" },
  { id: "DISPUTED", label: "Sporne" },
];

export function ProjectChangesTab({
  currentUser,
  sites,
  users,
  reports,
  focusChangeId,
  onFocusHandled,
  archiveOnly = false,
}: Props) {
  const [karty, setKarty] = useState<ProjectChange[]>([]);
  const [ladowanie, setLadowanie] = useState(true);
  const [blad, setBlad] = useState<string | null>(null);
  const [widok, setWidok] = useState<Widok>({ typ: "lista" });
  const [filtr, setFiltr] = useState<(typeof FILTRY)[number]["id"]>("ALL");
  const [szukaj, setSzukaj] = useState("");
  const [baner, setBaner] = useState<string | null>(null);

  const mozeZakladac = canInitiateChanges(currentUser) && !archiveOnly;

  const odswiez = useCallback(async () => {
    setLadowanie(true);
    setBlad(null);
    try {
      const res = await fetch("/api/changes");
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setBlad(data?.message || "Nie udało się pobrać kart zmian.");
        return;
      }
      setKarty(Array.isArray(data.changes) ? data.changes : []);
    } catch {
      setBlad("Brak połączenia z serwerem.");
    } finally {
      setLadowanie(false);
    }
  }, []);

  useEffect(() => {
    void odswiez();
  }, [odswiez]);

  // Wejście z linku: otwórz wskazaną kartę.
  useEffect(() => {
    if (!focusChangeId) return;
    setWidok({ typ: "karta", id: focusChangeId });
    onFocusHandled?.();
  }, [focusChangeId, onFocusHandled]);

  const podmien = (karta: ProjectChange) =>
    setKarty((prev) => {
      const bez = prev.filter((k) => k.id !== karta.id);
      return [karta, ...bez].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    });

  // Punkt 11: kolejność wg daty (pierwszego) wysłania karty.
  const czekajaNaMnie = useMemo(
    () => karty.filter((k) => pendingDecisionFor(k, currentUser.id)),
    [karty, currentUser.id]
  );
  const widoczne = useMemo(() => {
    const q = szukaj.trim().toLowerCase();
    return karty
      .filter((k) => filtr === "ALL" || k.status === filtr)
      .filter(
        (k) =>
          !q ||
          k.name.toLowerCase().includes(q) ||
          k.number.toLowerCase().includes(q) ||
          k.siteName.toLowerCase().includes(q) ||
          k.authorName.toLowerCase().includes(q)
      );
  }, [karty, filtr, szukaj]);

  // --- Widoki -------------------------------------------------------------
  if (widok.typ === "nowa" || widok.typ === "edycja") {
    return (
      <ProjectChangeForm
        currentUser={currentUser}
        sites={sites}
        users={users}
        reports={reports}
        editing={widok.typ === "edycja" ? widok.karta : null}
        onCancel={() => setWidok(widok.typ === "edycja" ? { typ: "karta", id: widok.karta.id } : { typ: "lista" })}
        onSent={(karta, problemy) => {
          podmien(karta);
          setBaner(
            problemy.length
              ? `Karta ${karta.number} zapisana, ale nie wszystkie maile doszły: ${problemy.join("; ")}. Link można wysłać ponownie z karty.`
              : `Karta ${karta.number} wysłana do akceptujących.`
          );
          setWidok({ typ: "karta", id: karta.id });
        }}
      />
    );
  }

  if (widok.typ === "karta") {
    const karta = karty.find((k) => k.id === widok.id);
    if (!karta) {
      return (
        <div className="max-w-4xl mx-auto p-6 text-center space-y-4">
          {ladowanie ? (
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
          ) : (
            <>
              <p className="font-bold text-slate-700 dark:text-slate-300">
                Nie znaleziono tej karty albo nie masz do niej dostępu.
              </p>
              <button
                type="button"
                onClick={() => setWidok({ typ: "lista" })}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-800 rounded-xl font-bold cursor-pointer"
              >
                Wróć do listy
              </button>
            </>
          )}
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {baner && (
          <div className="max-w-4xl mx-auto p-4 bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-300 dark:border-emerald-800 rounded-2xl text-sm font-bold text-emerald-900 dark:text-emerald-100">
            {baner}
          </div>
        )}
        <ProjectChangeDetail
          key={`${karta.id}-${karta.version}`}
          change={karta}
          currentUser={currentUser}
          onClose={() => {
            setBaner(null);
            setWidok({ typ: "lista" });
          }}
          onEdit={(k) => {
            setBaner(null);
            setWidok({ typ: "edycja", karta: k });
          }}
          onUpdated={podmien}
        />
      </div>
    );
  }

  // --- Lista --------------------------------------------------------------
  return (
    <div className={`w-full max-w-5xl mx-auto space-y-5 ${archiveOnly ? "" : "pb-32 md:pb-20"}`}>
      {!archiveOnly && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-700/50">
          <div>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/25 text-emerald-300 text-xs sm:text-sm font-black uppercase tracking-wider mb-2.5 border border-emerald-500/40">
              <ClipboardPen className="w-4 h-4" />
              <span>Rejestr zmian</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Zmiany w projekcie</h1>
          </div>
          {mozeZakladac && (
            <button
              type="button"
              onClick={() => {
                setBaner(null);
                setWidok({ typ: "nowa" });
              }}
              className="flex items-center justify-center gap-2 px-5 py-3.5 bg-emerald-600 hover:bg-emerald-500 rounded-2xl text-base font-black shadow-lg cursor-pointer active:scale-95"
            >
              <Plus className="w-5 h-5" />
              <span>Nowa karta zmiany</span>
            </button>
          )}
        </div>
      )}

      {blad && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/50 border-2 border-rose-300 dark:border-rose-800 rounded-2xl text-sm font-bold text-rose-900 dark:text-rose-100 flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <span>{blad}</span>
        </div>
      )}

      {czekajaNaMnie.length > 0 && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border-2 border-emerald-400 dark:border-emerald-700 rounded-3xl p-5 space-y-3">
          <h2 className="text-base sm:text-lg font-black text-emerald-900 dark:text-emerald-200">
            Czekają na Twoją decyzję ({czekajaNaMnie.length})
          </h2>
          <div className="space-y-2">
            {czekajaNaMnie.map((k) => (
              <KartaWiersz key={k.id} k={k} onOpen={() => setWidok({ typ: "karta", id: k.id })} />
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="flex flex-wrap gap-1.5">
            {FILTRY.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFiltr(f.id)}
                className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black cursor-pointer ${
                  filtr === f.id
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="search"
                value={szukaj}
                onChange={(e) => setSzukaj(e.target.value)}
                placeholder="Szukaj: numer, nazwa, plac…"
                className="w-full h-10 pl-9 pr-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold"
              />
            </div>
            <button
              type="button"
              onClick={() => void odswiez()}
              title="Odśwież"
              className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-xl cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${ladowanie ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {ladowanie && karty.length === 0 ? (
          <div className="py-10 text-center">
            <Loader2 className="w-7 h-7 animate-spin mx-auto text-emerald-600" />
          </div>
        ) : widoczne.length === 0 ? (
          <div className="py-10 text-center text-sm font-bold text-slate-500">
            {karty.length === 0 ? "Nie ma jeszcze żadnych kart zmian." : "Brak kart dla wybranego filtra."}
          </div>
        ) : (
          <div className="space-y-2">
            {widoczne.map((k) => (
              <KartaWiersz key={k.id} k={k} onOpen={() => setWidok({ typ: "karta", id: k.id })} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KartaWiersz({ k, onOpen }: { k: ProjectChange; onOpen: () => void }) {
  const zdecydowalo = k.decisions.filter((d) => d.decision === "ACCEPTED" || d.decision === "REJECTED").length;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full text-left p-4 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 hover:border-emerald-400 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer transition-colors"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-black text-slate-500">{k.number}</span>
          <span className={`px-2 py-0.5 rounded-lg text-[11px] font-black border ${statusBadgeClass(k.status)}`}>
            {changeStatusLabel(k.status)}
          </span>
          {k.knaRequired && (
            <span className="px-2 py-0.5 rounded-lg text-[11px] font-black bg-rose-600 text-white">KNA</span>
          )}
        </div>
        <div className="mt-1 text-base font-black text-slate-900 dark:text-white truncate">{k.name}</div>
        <div className="text-xs font-semibold text-slate-500">
          {k.siteName} • {k.authorName}
        </div>
      </div>
      <div className="text-xs font-semibold text-slate-500 sm:text-right flex-shrink-0">
        <div className="font-mono">{formatPolishDateTimeShort(k.submittedAt)}</div>
        <div>
          decyzje: {zdecydowalo}/{k.decisions.length}
        </div>
      </div>
    </button>
  );
}
