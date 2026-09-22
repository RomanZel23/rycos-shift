"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  CircleCheck,
  CircleX,
  Download,
  History,
  Loader2,
  Pencil,
  PenLine,
  RefreshCw,
  Send,
  X,
} from "lucide-react";
import type { ChangeDecision, ChangePhoto, ProjectChange, User } from "@/types";
import { SignatureModal } from "./SignatureModal";
import { toAppFileUrl } from "@/lib/storage-paths";
import { formatPolishDateTimeShort } from "@/lib/date-utils";
import { formatDateTaken } from "@/lib/exif";
import {
  CHANGE_COMMENT_MAX,
  canEditChange,
  changeStatusLabel,
  decisionLabel,
  pendingDecisionFor,
} from "@/lib/project-change";

export function statusBadgeClass(status: ProjectChange["status"]): string {
  switch (status) {
    case "ACCEPTED":
      return "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800";
    case "REJECTED":
      return "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800";
    case "DISPUTED":
      return "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800";
    default:
      return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800";
  }
}

function decisionClass(d: ChangeDecision["decision"]): string {
  if (d === "ACCEPTED") return "text-emerald-700 dark:text-emerald-400";
  if (d === "REJECTED") return "text-rose-700 dark:text-rose-400";
  if (d === "SUPERSEDED") return "text-slate-400";
  return "text-amber-700 dark:text-amber-400";
}

interface Props {
  change: ProjectChange;
  currentUser: User;
  onClose: () => void;
  onEdit: (change: ProjectChange) => void;
  /** Karta po zmianie na serwerze (decyzja, ponowny link). */
  onUpdated: (change: ProjectChange) => void;
}

export function ProjectChangeDetail({ change, currentUser, onClose, onEdit, onUpdated }: Props) {
  const mojaDecyzja = currentUser.canAcceptChanges ? pendingDecisionFor(change, currentUser.id) : null;
  const mozeEdytowac = canEditChange(change, currentUser.id);
  const mozeWysylacLinki = change.authorId === currentUser.id || currentUser.isAdmin;

  const [wybor, setWybor] = useState<"ACCEPTED" | "REJECTED" | null>(null);
  const [komentarz, setKomentarz] = useState("");
  const [podpis, setPodpis] = useState<string | null>(null);
  const [podpisOtwarty, setPodpisOtwarty] = useState(false);
  const [wysylanie, setWysylanie] = useState(false);
  const [komunikat, setKomunikat] = useState<{ ok: boolean; text: string } | null>(null);
  const [pobieranie, setPobieranie] = useState(false);
  const [linkDla, setLinkDla] = useState<string | null>(null);
  const [powiekszone, setPowiekszone] = useState<string | null>(null);

  const wyslijDecyzje = async () => {
    if (!wybor || !podpis) return;
    if (wybor === "REJECTED" && !komentarz.trim()) {
      setKomunikat({ ok: false, text: "Przy odrzuceniu komentarz jest obowiązkowy." });
      return;
    }
    setWysylanie(true);
    setKomunikat(null);
    try {
      const res = await fetch("/api/changes/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          changeId: change.id,
          decision: wybor,
          comment: komentarz.trim(),
          signatureDataUrl: podpis,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        setKomunikat({ ok: false, text: data?.message || "Nie udało się zapisać decyzji." });
        return;
      }
      const uwagi: string[] = Array.isArray(data.notices) ? data.notices : [];
      setKomunikat({
        ok: true,
        text: `Decyzja zapisana${uwagi.length ? ` (${uwagi.join(" ")})` : "."}`,
      });
      setWybor(null);
      setPodpis(null);
      setKomentarz("");
      if (data.change) onUpdated(data.change as ProjectChange);
    } catch {
      setKomunikat({ ok: false, text: "Brak połączenia z serwerem — decyzja NIE została zapisana." });
    } finally {
      setWysylanie(false);
    }
  };

  const pobierzPdf = async () => {
    setPobieranie(true);
    try {
      const res = await fetch("/api/changes/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changeId: change.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setKomunikat({ ok: false, text: data?.message || "Nie udało się pobrać PDF." });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${change.number.replace(/\//g, "_")}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      setKomunikat({ ok: false, text: "Brak połączenia z serwerem." });
    } finally {
      setPobieranie(false);
    }
  };

  const wyslijLink = async (acceptorId: string) => {
    setLinkDla(acceptorId);
    try {
      const res = await fetch("/api/changes/resend-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ changeId: change.id, acceptorId }),
      });
      const data = await res.json().catch(() => null);
      setKomunikat({
        ok: Boolean(data?.success),
        text: data?.success ? "Nowy link wysłany." : data?.message || "Nie udało się wysłać linku.",
      });
      if (data?.change) onUpdated(data.change as ProjectChange);
    } catch {
      setKomunikat({ ok: false, text: "Brak połączenia z serwerem." });
    } finally {
      setLinkDla(null);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto pb-32 md:pb-20 space-y-5">
      {/* NAGŁÓWEK */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl space-y-3 border border-slate-800">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/25 text-emerald-300 text-xs sm:text-sm font-black font-mono border border-emerald-500/40">
              {change.number}
            </span>
            <span className={`px-3 py-1 rounded-full text-xs font-black border ${statusBadgeClass(change.status)}`}>
              {changeStatusLabel(change.status)}
            </span>
            {change.version > 1 && (
              <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-bold">
                wersja {change.version}
              </span>
            )}
            {change.lockedAt && (
              <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-xs font-bold">
                treść zablokowana
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-xl cursor-pointer"
            title="Wróć do listy"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <h1 className="text-xl sm:text-3xl font-black leading-tight">{change.name}</h1>
        <div className="text-sm text-slate-300 font-semibold">
          {change.siteName} • zgłosił {change.authorName} •{" "}
          {formatPolishDateTimeShort(change.submittedAt)}
          {change.version > 1 && ` • zmieniono ${formatPolishDateTimeShort(change.versionSentAt)}`}
        </div>
        {change.knaRequired && (
          <div className="p-3 rounded-2xl bg-rose-600/20 border-2 border-rose-500 text-rose-200 text-sm font-black">
            KONIECZNE KNA — rewizja całego projektu od początku
          </div>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={pobierzPdf}
            disabled={pobieranie}
            className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 rounded-2xl text-sm font-black cursor-pointer disabled:opacity-60"
          >
            {pobieranie ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            <span>Pobierz PDF</span>
          </button>
          {mozeEdytowac && (
            <button
              type="button"
              onClick={() => onEdit(change)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 rounded-2xl text-sm font-black cursor-pointer"
            >
              <Pencil className="w-4 h-4" />
              <span>Edytuj kartę</span>
            </button>
          )}
        </div>
      </div>

      {komunikat && (
        <div
          className={`p-4 rounded-2xl border-2 text-sm font-bold flex items-start gap-2.5 ${
            komunikat.ok
              ? "bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-100"
              : "bg-rose-50 border-rose-300 text-rose-900 dark:bg-rose-950/50 dark:border-rose-800 dark:text-rose-100"
          }`}
        >
          {komunikat.ok ? <CircleCheck className="w-5 h-5 flex-shrink-0" /> : <AlertTriangle className="w-5 h-5 flex-shrink-0" />}
          <span>{komunikat.text}</span>
        </div>
      )}

      <SectionView title="Jest" description={change.current.description} photos={change.current.photos} onZoom={setPowiekszone} />
      <SectionView title="Powinno być" description={change.target.description} photos={change.target.photos} onZoom={setPowiekszone} />

      {/* DECYZJA ZALOGOWANEGO AKCEPTUJĄCEGO — pod treścią, żeby najpierw ją przeczytał */}
      {mojaDecyzja && (
        <div className="bg-white dark:bg-slate-900 border-2 border-emerald-400 dark:border-emerald-700 rounded-3xl p-5 sm:p-7 shadow-lg space-y-4">
          <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-white">
            Twoja decyzja
          </h2>
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            Decyzja z podpisem jest ostateczna — nie da się jej później zmienić.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setWybor("ACCEPTED");
                setPodpis(null);
              }}
              className={`flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-black border-2 cursor-pointer ${
                wybor === "ACCEPTED"
                  ? "bg-emerald-600 border-emerald-600 text-white"
                  : "border-emerald-400 text-emerald-700 dark:text-emerald-300"
              }`}
            >
              <CircleCheck className="w-5 h-5" />
              Akceptuję
            </button>
            <button
              type="button"
              onClick={() => {
                setWybor("REJECTED");
                setPodpis(null);
              }}
              className={`flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-black border-2 cursor-pointer ${
                wybor === "REJECTED"
                  ? "bg-rose-600 border-rose-600 text-white"
                  : "border-rose-400 text-rose-700 dark:text-rose-300"
              }`}
            >
              <CircleX className="w-5 h-5" />
              Odrzucam
            </button>
          </div>

          {wybor && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-extrabold text-slate-800 dark:text-slate-200 mb-1.5">
                  Komentarz{" "}
                  {wybor === "REJECTED" ? (
                    <span className="text-rose-500">* (obowiązkowy przy odrzuceniu)</span>
                  ) : (
                    <span className="text-slate-500 font-semibold">(opcjonalnie)</span>
                  )}
                </label>
                <textarea
                  rows={3}
                  value={komentarz}
                  maxLength={CHANGE_COMMENT_MAX}
                  onChange={(e) => setKomentarz(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-base font-medium text-slate-900 dark:text-white focus:outline-none"
                />
              </div>

              {podpis ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={podpis} alt="Twój podpis" className="h-16 bg-white rounded-xl border-2 border-slate-200 p-1" />
                  <button
                    type="button"
                    onClick={() => setPodpisOtwarty(true)}
                    className="text-sm font-bold text-sky-700 dark:text-sky-400 underline cursor-pointer"
                  >
                    Podpisz ponownie
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setPodpisOtwarty(true)}
                  className="flex items-center gap-2 px-5 py-3.5 bg-slate-900 dark:bg-slate-700 text-white rounded-2xl text-sm font-black cursor-pointer"
                >
                  <PenLine className="w-5 h-5" />
                  Złóż podpis
                </button>
              )}

              <button
                type="button"
                onClick={wyslijDecyzje}
                disabled={!podpis || wysylanie || (wybor === "REJECTED" && !komentarz.trim())}
                className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-lg font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 disabled:opacity-50 cursor-pointer"
              >
                {wysylanie ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                Wyślij decyzję
              </button>
            </div>
          )}
        </div>
      )}

      {/* DECYZJE */}
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-md space-y-3">
        <h2 className="text-base sm:text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
          Akceptujący
        </h2>
        <div className="divide-y-2 divide-slate-100 dark:divide-slate-800">
          {change.decisions.map((d) => (
            <DecisionRowView
              key={d.id}
              d={d}
              action={
                mozeWysylacLinki && d.decision === "PENDING" ? (
                  <button
                    type="button"
                    onClick={() => wyslijLink(d.acceptorId)}
                    disabled={linkDla === d.acceptorId}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-black text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-950/60 rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${linkDla === d.acceptorId ? "animate-spin" : ""}`} />
                    Wyślij link ponownie
                  </button>
                ) : null
              }
            />
          ))}
        </div>
      </div>

      {change.history.length > 0 && (
        <div className="bg-slate-50 dark:bg-slate-900/60 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 space-y-3">
          <h2 className="text-sm sm:text-base font-black uppercase tracking-tight text-slate-600 dark:text-slate-300 flex items-center gap-2">
            <History className="w-4 h-4" />
            Decyzje dla wcześniejszych wersji
          </h2>
          <div className="divide-y divide-slate-200 dark:divide-slate-800 opacity-80">
            {change.history.map((d) => (
              <DecisionRowView key={d.id} d={d} showVersion />
            ))}
          </div>
        </div>
      )}

      <SignatureModal
        isOpen={podpisOtwarty}
        onClose={() => setPodpisOtwarty(false)}
        onConfirm={(record) => setPodpis(record.signatureDataUrl)}
        isForemanModal
        preselectedUser={currentUser}
        availableUsers={[]}
        alreadyAddedUserIds={[]}
        title={wybor === "REJECTED" ? "Podpis — odrzucam zmianę" : "Podpis — akceptuję zmianę"}
      />

      {powiekszone && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 flex items-center justify-center p-4"
          onClick={() => setPowiekszone(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={powiekszone} alt="Powiększone zdjęcie" className="max-w-full max-h-full rounded-2xl" />
        </div>
      )}
    </div>
  );
}

function DecisionRowView({
  d,
  action,
  showVersion,
}: {
  d: ChangeDecision;
  action?: React.ReactNode;
  showVersion?: boolean;
}) {
  return (
    <div className="py-3.5 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <div className="min-w-0">
        <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
          {d.acceptorName}
          {showVersion && <span className="ml-2 text-xs font-bold text-slate-500">wersja {d.version}</span>}
        </div>
        <div className={`text-sm font-bold ${decisionClass(d.decision)}`}>
          {decisionLabel(d.decision)}
          {d.decidedAt && (
            <span className="ml-2 font-mono text-xs text-slate-500">
              {formatPolishDateTimeShort(d.decidedAt)}
            </span>
          )}
        </div>
        {d.comment && (
          <div className="mt-1 text-sm text-slate-700 dark:text-slate-300 italic">„{d.comment}”</div>
        )}
        {d.decision === "PENDING" && d.emailError && (
          <div className="mt-1 text-xs font-semibold text-rose-600">Mail nie doszedł: {d.emailError}</div>
        )}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {d.signatureUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.signatureUrl} alt="Podpis" className="h-12 bg-white rounded-lg border border-slate-200 p-0.5" />
        )}
        {action}
      </div>
    </div>
  );
}

function SectionView({
  title,
  description,
  photos,
  onZoom,
}: {
  title: string;
  description: string;
  photos: ChangePhoto[];
  onZoom: (src: string) => void;
}) {
  return (
    <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-md space-y-4">
      <h2 className="text-base sm:text-xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
        {title}
      </h2>
      {description.trim() ? (
        <p className="text-sm sm:text-base text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-medium">
          {description}
        </p>
      ) : (
        <p className="text-sm text-slate-500 font-semibold">Brak opisu.</p>
      )}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((p, i) => {
            const src = p.path ? toAppFileUrl(p.path) : p.dataUrl || "";
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onZoom(src)}
                className="relative rounded-2xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 cursor-zoom-in"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`${title} ${i + 1}`} className="w-full h-32 sm:h-40 object-cover" />
                {p.source === "galeria" && (
                  <span className="absolute bottom-0 inset-x-0 py-1 bg-slate-900/70 text-white text-[10px] font-semibold">
                    {formatDateTaken(p.capturedAt) ? `z galerii • ${formatDateTaken(p.capturedAt)}` : "z galerii"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
