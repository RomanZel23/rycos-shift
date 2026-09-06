/**
 * Etap 3 — z tego modułu został wyłącznie sanityzator nazw plików.
 *
 * Cała maszyneria generowania PDF (jsPDF + html2canvas, kilkaset linii składania
 * stron ręcznie) przeniosła się na serwer do src/lib/pdf-renderer.ts. Powody:
 * html2canvas nie łamał stron, więc lista obecności powyżej dziewięciu osób
 * znikała z dokumentu; rysował tekst według metryk czcionek konkretnego
 * urządzenia, przez co układ rozjeżdżał się między telefonami; i produkował
 * raster, czyli plik bez przeszukiwalnego tekstu, kilkanaście razy cięższy,
 * renderowany przez telefon w terenie.
 *
 * Zależności jspdf, jspdf-autotable i html2canvas nie są już nigdzie używane —
 * do usunięcia z package.json w Etapie 4.
 */

/** Zamienia polskie znaki diakrytyczne na odpowiedniki ASCII. */
export function removePolishDiacritics(text: string): string {
  const map: Record<string, string> = {
    ą: "a", Ą: "A",
    ć: "c", Ć: "C",
    ę: "e", Ę: "E",
    ł: "l", Ł: "L",
    ń: "n", Ń: "N",
    ó: "o", Ó: "O",
    ś: "s", Ś: "S",
    ź: "z", Ź: "Z",
    ż: "z", Ż: "Z",
  };
  return (text || "").replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (char) => map[char] || char);
}

/**
 * Bezpieczna nazwa pliku dla nagłówków MIME (RFC 2231) i systemów plików.
 */
export function sanitizePdfFileName(name: string): string {
  let clean = removePolishDiacritics(name || "Raport");
  clean = clean
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/_+/g, "_")
    .replace(/-+/g, "-")
    // Etap 4: ciągi kropek. Ukośniki i tak wypadały wyżej, więc wyjście z katalogu
    // nie było możliwe, ale ".." w nazwie pliku przechodziło przez walidator ścieżek
    // w buckecie i zostawało w nagłówku Content-Disposition. Taniej to uciąć,
    // niż za pół roku dowodzić, że akurat tutaj było niegroźne.
    .replace(/\.{2,}/g, ".")
    // Kropka lub myślnik na początku robi plik ukryty albo nazwę wyglądającą
    // jak przełącznik wiersza poleceń.
    .replace(/^[.-]+/, "");

  if (!clean || clean === ".pdf") clean = "Raport";

  if (!clean.toLowerCase().endsWith(".pdf")) {
    clean += ".pdf";
  }
  return clean;
}

/**
 * Fragment nazwy pliku zrobiony z dowolnego tekstu — nazwy placu budowy,
 * nazwiska, czegokolwiek.
 *
 * Powstało, bo nazwa pliku wychodziła jako
 *   „…_Nastawnia_PKP_Pozna_-_Pi_tkowo.pdf"
 * zamiast „…_Nastawnia_PKP_Poznan_-_Piatkowo.pdf". Nazwa przechodziła przez
 * dwa sanityzatory: pierwszy wycinał wszystko spoza [a-zA-Z0-9_-] na
 * podkreślenia, więc do drugiego — tego, który umie przepisać „ń" na „n" —
 * docierało już samo „_". Kolejność ma znaczenie: NAJPIERW diakrytyki,
 * potem dopiero czyszczenie.
 */
export function slugifyForFileName(text: string, fallback = "x"): string {
  const czysty = removePolishDiacritics(text || "")
    // Wszystko, co nie jest literą, cyfrą, podkreśleniem ani myślnikiem, staje
    // się podkreśleniem — a nie znika. Inaczej „Gdańsk/Oliwa" sklejałoby się
    // w „GdanskOliwa".
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/-+/g, "-")
    .replace(/^[._-]+|[._-]+$/g, "");
  return czysty || fallback;
}
