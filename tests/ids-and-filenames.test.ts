import { test } from "node:test";
import assert from "node:assert/strict";
import { newId, newPrefixedId } from "@/lib/ids";
import {
  removePolishDiacritics,
  sanitizePdfFileName,
  slugifyForFileName,
} from "@/lib/pdf-generator";

test("identyfikatory nie kolidują w obrębie jednej milisekundy", () => {
  // Dokładnie ten przypadek psuł stare `"rep-end-" + Date.now()`: dwa raporty
  // złożone w tej samej milisekundzie dostawały jeden identyfikator, a upsert
  // po kolumnie id nadpisywał pierwszy zamiast dołożyć wiersz.
  const ids = new Set(Array.from({ length: 20_000 }, () => newId()));
  assert.equal(ids.size, 20_000);
});

test("identyfikator ma format UUID v4", () => {
  assert.match(newId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test("prefiks pozwala poznać rodzaj rekordu", () => {
  assert.match(newPrefixedId("rep-end"), /^rep-end-[0-9a-f-]{36}$/);
  assert.match(newPrefixedId("photo"), /^photo-[0-9a-f-]{36}$/);
});

test("polskie znaki znikają z nazwy pliku", () => {
  assert.equal(removePolishDiacritics("Zażółć gęślą jaźń"), "Zazolc gesla jazn");
  assert.equal(removePolishDiacritics("ŁÓDŹ"), "LODZ");
  assert.equal(removePolishDiacritics(""), "");
});

test("nazwa pliku PDF nadaje się do nagłówka i do systemu plików", () => {
  assert.equal(
    sanitizePdfFileName("Raport końcowy — Poznań/Piątkowo 2026"),
    "Raport_koncowy_PoznanPiatkowo_2026.pdf"
  );
  assert.equal(sanitizePdfFileName("już.pdf"), "juz.pdf");
  assert.equal(sanitizePdfFileName(""), "Raport.pdf");
});

test("nazwa pliku nie przemyca ścieżki", () => {
  for (const brudna of ["../../etc/passwd", "..\\..\\windows\\system32", "....//raport"]) {
    const name = sanitizePdfFileName(brudna);
    assert.ok(!name.includes("/"), brudna);
    assert.ok(!name.includes("\\"), brudna);
    assert.ok(!name.includes(".."), brudna);
    assert.ok(!name.startsWith("."), brudna);
  }
});

test("nazwa złożona z samych odrzuconych znaków nie daje pustego pliku", () => {
  assert.equal(sanitizePdfFileName("///"), "Raport.pdf");
  assert.equal(sanitizePdfFileName("..."), "Raport.pdf");
});

/**
 * Regresja z 2026-09-06: w mailu przyszedł załącznik o nazwie
 * „…_Nastawnia_PKP_Pozna_-_Pi_tkowo.pdf". Nazwa placu przechodziła przez dwa
 * sanityzatory i pierwszy zamieniał polskie znaki na podkreślenia, zanim drugi
 * zdążył je przepisać na odpowiedniki łacińskie.
 */
test("nazwa placu zachowuje polskie znaki jako odpowiedniki łacińskie", () => {
  assert.equal(
    slugifyForFileName("Nastawnia PKP Poznań - Piątkowo", "plac"),
    "Nastawnia_PKP_Poznan_-_Piatkowo"
  );
  assert.equal(slugifyForFileName("Łódź Widzew", "plac"), "Lodz_Widzew");
  assert.equal(slugifyForFileName("Świnoujście", "plac"), "Swinoujscie");
});

test("cała nazwa pliku raportu jest czytelna", () => {
  const slug = slugifyForFileName("Nastawnia PKP Poznań - Piątkowo", "plac");
  assert.equal(
    sanitizePdfFileName(`2026-09-06_Zakonczenie_prac_zespolu_${slug}`),
    "2026-09-06_Zakonczenie_prac_zespolu_Nastawnia_PKP_Poznan_-_Piatkowo.pdf"
  );
  assert.ok(!sanitizePdfFileName(`x_${slug}`).includes("__"), "podwójne podkreślenia");
});

test("separatory nie sklejają słów", () => {
  // Ukośnik i myślnik długi mają rozdzielać, a nie znikać.
  assert.equal(slugifyForFileName("Gdańsk/Oliwa", "plac"), "Gdansk_Oliwa");
  assert.equal(slugifyForFileName("Świnoujście — Ostrów", "plac"), "Swinoujscie_Ostrow");
});

test("pusta lub bezużyteczna nazwa placu daje wartość zastępczą", () => {
  for (const wejscie of ["", "   ", "!!!", "///"]) {
    assert.equal(slugifyForFileName(wejscie, "plac"), "plac", JSON.stringify(wejscie));
  }
});

test("slug nie zaczyna się ani nie kończy separatorem", () => {
  for (const wejscie of ["  Poznań  ", "-Poznań-", "_Poznań_", ".Poznań."]) {
    const s = slugifyForFileName(wejscie, "plac");
    assert.ok(!/^[._-]|[._-]$/.test(s), `${JSON.stringify(wejscie)} -> ${s}`);
  }
});
