import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";

/**
 * Polityka prywatności portalu RYCOS Shift (uwaga klienta #016).
 *
 * DWIE RZECZY DO POTWIERDZENIA PRZED POKAZANIEM KLIENTOWI:
 *
 * 1. ADMINISTRATOR. Poniżej są dane SolutionsBay P.S.A. — te same, które stoją
 *    w polityce na solutionsbay.pl. Papier firmowy raportów (docs/company_layout.pdf,
 *    src/lib/brand.ts) należy jednak do iDream Business Center sp. z o.o., NIP
 *    9591971466, KRS 0000612724, i to ten podmiot prowadzi budowę. Klient
 *    zapowiedział podmianę. Zmiana to jedna stała niżej.
 *
 * 2. TREŚĆ NIE JEST KOPIĄ polityki z solutionsbay.pl i nie powinna nią być.
 *    Tamta opisuje marketing, Google Analytics, Facebook Pixel i wtyczki
 *    społecznościowe — RYCOS Shift nie ma żadnej z tych rzeczy, więc przepisanie
 *    jej tutaj byłoby oświadczeniem niezgodnym ze stanem faktycznym, a to akurat
 *    w polityce prywatności kosztuje najwięcej. Zostały przeniesione dane
 *    administratora, kontakt do ADO i konstrukcja dokumentu; opis przetwarzania
 *    jest napisany pod to, co aplikacja naprawdę zbiera.
 *
 * Dokument opisuje stan techniczny wiernie, ale nie jest opinią prawną —
 * przed publikacją powinien go przejrzeć prawnik klienta. Miejsca wymagające
 * decyzji biznesowej są oznaczone niżej jako DO USTALENIA.
 */

const ADMINISTRATOR = {
  legalName: "SolutionsBay Prosta Spółka Akcyjna",
  address: "ul. Malików 150D, 25-639 Kielce",
  krs: "0000118265",
  nip: "9591972649",
  regon: "364505264",
  adoEmail: "ado@solutionsbay.pl",
  adoPhone: "+48 447 111 144",
} as const;

const AKTUALIZACJA = "6 września 2026";

export const metadata: Metadata = {
  title: "Polityka prywatności — RYCOS Shift",
  description:
    "Zasady przetwarzania danych osobowych w systemie raportowania odpraw i fotorelacji z budowy RYCOS Shift.",
};

function Sekcja({ nr, tytul, children }: { nr: number; tytul: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-black text-slate-900 dark:text-white">
        <span className="text-sky-600 dark:text-sky-400">{nr}.</span> {tytul}
      </h2>
      <div className="space-y-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
        {children}
      </div>
    </section>
  );
}

export default function PolitykaPrywatnosci() {
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 py-8 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="space-y-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Powrót do aplikacji
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Polityka prywatności
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Dotyczy systemu RYCOS Shift — raportowania odpraw BHP i fotorelacji z budowy.
            Ostatnia aktualizacja: {AKTUALIZACJA}.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-8 shadow-sm">
          <Sekcja nr={1} tytul="Administrator danych osobowych">
            <p>
              Administratorem danych osobowych przetwarzanych w systemie RYCOS Shift jest{" "}
              <strong className="text-slate-900 dark:text-white">{ADMINISTRATOR.legalName}</strong>{" "}
              z siedzibą w Kielcach, {ADMINISTRATOR.address}, wpisana do Krajowego Rejestru
              Sądowego pod numerem KRS {ADMINISTRATOR.krs}, NIP {ADMINISTRATOR.nip},
              REGON {ADMINISTRATOR.regon}.
            </p>
            <p>
              W sprawach dotyczących danych osobowych kontakt:{" "}
              <a
                href={`mailto:${ADMINISTRATOR.adoEmail}`}
                className="text-sky-700 dark:text-sky-400 font-semibold hover:underline"
              >
                {ADMINISTRATOR.adoEmail}
              </a>
              , tel. {ADMINISTRATOR.adoPhone}.
            </p>
          </Sekcja>

          <Sekcja nr={2} tytul="Kogo dotyczą dane">
            <p>
              System jest narzędziem wewnętrznym. Przetwarzane są dane pracowników i
              współpracowników uczestniczących w pracach na placu budowy: osób prowadzących
              odprawę oraz osób obecnych na odprawie i podpisujących listę obecności.
              Aplikacja nie jest dostępna publicznie — wymaga kodu dostępu do przeglądarki
              oraz indywidualnego logowania.
            </p>
          </Sekcja>

          <Sekcja nr={3} tytul="Jakie dane są przetwarzane">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Dane konta:</strong> imię, nazwisko, stanowisko, login, informacja
                o uprawnieniach (brygadzista, administrator). Hasło i PIN są przechowywane
                wyłącznie jako skrót kryptograficzny (scrypt) — nie da się z nich odtworzyć
                hasła.
              </li>
              <li>
                <strong>Dane raportu:</strong> data i godzina złożenia, nazwa placu budowy,
                osoba prowadząca odprawę, lista omówionych tematów.
              </li>
              <li>
                <strong>Podpisy odręczne</strong> osób obecnych na odprawie, składane palcem
                na ekranie i zapisywane jako obraz.
              </li>
              <li>
                <strong>Zdjęcia z placu budowy</strong> wraz z opisami i godziną wykonania.
                Zdjęcia mogą przypadkowo obejmować wizerunek osób pracujących w kadrze.
              </li>
              <li>
                <strong>Położenie geograficzne</strong> urządzenia w chwili składania
                raportu (szerokość, długość, dokładność pomiaru) — wyłącznie za zgodą
                wyrażoną w przeglądarce; raport można złożyć również bez współrzędnych.
              </li>
              <li>
                <strong>Dane techniczne wysyłki:</strong> adresy e-mail odbiorców raportu,
                data przekazania wiadomości do wysłania, status doręczenia.
              </li>
            </ul>
            <p>
              System nie prowadzi profilowania, nie podejmuje decyzji w sposób
              zautomatyzowany i nie śledzi położenia urządzenia poza momentem składania
              raportu.
            </p>
          </Sekcja>

          <Sekcja nr={4} tytul="Cel i podstawa prawna przetwarzania">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                Dokumentowanie odpraw BHP i przebiegu prac — art. 6 ust. 1 lit. c RODO
                w związku z obowiązkami pracodawcy w zakresie bezpieczeństwa i higieny
                pracy, a w pozostałym zakresie art. 6 ust. 1 lit. f RODO (uzasadniony
                interes administratora polegający na udokumentowaniu wykonanych prac).
              </li>
              <li>
                Dostęp do systemu i bezpieczeństwo kont — art. 6 ust. 1 lit. f RODO.
              </li>
              <li>
                Ustalenie położenia w chwili składania raportu — art. 6 ust. 1 lit. a RODO
                (zgoda wyrażana w przeglądarce, możliwa do cofnięcia w każdej chwili
                w ustawieniach przeglądarki).
              </li>
            </ul>
          </Sekcja>

          <Sekcja nr={5} tytul="Odbiorcy danych">
            <p>
              Raporty są przekazywane pocztą elektroniczną na adresy wskazane przez
              administratora systemu. Poza tym dane powierzane są wyłącznie dostawcom
              niezbędnym do działania aplikacji:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>dostawcy hostingu bazy danych i plików (Supabase),</li>
              <li>dostawcy usługi wysyłki poczty elektronicznej (Resend),</li>
              <li>dostawcy serwera, na którym działa aplikacja.</li>
            </ul>
            <p>
              Dane nie są sprzedawane ani udostępniane w celach marketingowych. Poza tym
              krąg odbiorców ogranicza się do organów uprawnionych na podstawie przepisów
              prawa.
            </p>
          </Sekcja>

          <Sekcja nr={6} tytul="Okres przechowywania">
            <p>
              Raporty wraz z podpisami i zdjęciami są przechowywane jako dokumentacja
              przebiegu prac przez okres wynikający z przepisów oraz z umowy dotyczącej
              danej budowy. Dane kont pracowniczych są usuwane po zakończeniu współpracy.
            </p>
          </Sekcja>

          <Sekcja nr={7} tytul="Prawa osób, których dane dotyczą">
            <p>
              Przysługuje prawo dostępu do danych, ich sprostowania, usunięcia lub
              ograniczenia przetwarzania, prawo do przenoszenia danych, prawo sprzeciwu
              wobec przetwarzania opartego na uzasadnionym interesie oraz prawo cofnięcia
              zgody — cofnięcie nie wpływa na zgodność z prawem przetwarzania dokonanego
              przed cofnięciem.
            </p>
            <p>
              Realizację praw prowadzi administrator pod adresem{" "}
              <a
                href={`mailto:${ADMINISTRATOR.adoEmail}`}
                className="text-sky-700 dark:text-sky-400 font-semibold hover:underline"
              >
                {ADMINISTRATOR.adoEmail}
              </a>
              . Przysługuje również prawo wniesienia skargi do Prezesa Urzędu Ochrony
              Danych Osobowych.
            </p>
          </Sekcja>

          <Sekcja nr={8} tytul="Pliki cookie">
            <p>
              Aplikacja używa wyłącznie plików cookie niezbędnych do jej działania. Nie ma
              w niej narzędzi analitycznych, reklamowych ani wtyczek serwisów
              społecznościowych.
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  rycos_gate
                </code>{" "}
                — potwierdzenie, że przeglądarka została autoryzowana kodem dostępu.
                Ważność 30 dni od ostatniego użycia aplikacji.
              </li>
              <li>
                <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  rycos_session
                </code>{" "}
                — sesja zalogowanego użytkownika. Ważność 12 godzin; kasowane przy
                wylogowaniu.
              </li>
            </ul>
            <p>
              Oba pliki są oznaczone jako httpOnly, więc nie odczytuje ich żaden skrypt
              strony, i nie zawierają danych osobowych.
            </p>
          </Sekcja>

          <Sekcja nr={9} tytul="Dane pozostające na urządzeniu">
            <p>
              Aby aplikacja działała przy słabym zasięgu na budowie, kopia ostatnio
              pobranych danych oraz niedokończony formularz są zapisywane w pamięci
              przeglądarki na urządzeniu. Wersje robocze formularzy są automatycznie
              kasowane po 7 dniach, a pozostałe dane znikają po wyczyszczeniu danych
              przeglądarki.
            </p>
          </Sekcja>

          <Sekcja nr={10} tytul="Bezpieczeństwo">
            <p>
              Połączenie z aplikacją jest szyfrowane. Dostęp wymaga kodu autoryzującego
              przeglądarkę oraz indywidualnego logowania z blokadą konta po kolejnych
              nieudanych próbach. Hasła i PIN-y przechowywane są wyłącznie w postaci
              skrótów kryptograficznych, a zdjęcia, podpisy i pliki PDF leżą w prywatnym
              magazynie plików, niedostępnym z internetu bez uwierzytelnienia.
            </p>
          </Sekcja>

          <Sekcja nr={11} tytul="Zmiany polityki">
            <p>
              Administrator zastrzega prawo do zmiany niniejszej polityki z ważnych
              powodów, w szczególności przy zmianie przepisów lub zakresu działania
              aplikacji. Aktualna wersja jest zawsze publikowana pod tym adresem.
            </p>
          </Sekcja>
        </div>

        <p className="text-center text-xs text-slate-500">
          <Link href="/" className="hover:text-sky-600 dark:hover:text-sky-400 hover:underline">
            RYCOS Shift
          </Link>
        </p>
      </div>
    </div>
  );
}
