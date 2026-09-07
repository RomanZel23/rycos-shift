import { LifeBuoy } from "lucide-react";

/**
 * TYMCZASOWY komunikat kontaktowy na ekranach logowania (7 września 2026).
 *
 * Powód: administrator nie zdążył rozdać PIN-ów i haseł, a zespoły właśnie
 * zaczynają pracę. Bez tego monter stojący na placu z zablokowanym ekranem nie
 * ma dokąd zadzwonić.
 *
 * DO USUNIĘCIA, gdy dostępy będą rozdane — wystarczy skasować ten plik i dwa
 * użycia (AccessGate, LoginForm).
 */

const KONTAKT = {
  osoba: "Roman Żeleźnik",
  telefon: "796 039 601",
  telefonHref: "+48796039601",
  email: "roman.zeleznik@solutionsbay.pl",
} as const;

export function SupportContact({ className = "" }: { className?: string }) {
  return (
    <div
      className={`p-3.5 bg-amber-950/40 border border-amber-800/60 rounded-2xl text-[11px] sm:text-xs text-amber-100/90 flex items-start gap-2.5 ${className}`}
    >
      <LifeBuoy className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
      <div className="leading-relaxed">
        <span className="font-bold text-amber-200">Problem z logowaniem?</span> Zadzwoń lub
        napisz: {KONTAKT.osoba},{" "}
        <a href={`tel:${KONTAKT.telefonHref}`} className="font-bold underline underline-offset-2">
          {KONTAKT.telefon}
        </a>
        ,{" "}
        <a href={`mailto:${KONTAKT.email}`} className="font-bold underline underline-offset-2 break-all">
          {KONTAKT.email}
        </a>
      </div>
    </div>
  );
}
