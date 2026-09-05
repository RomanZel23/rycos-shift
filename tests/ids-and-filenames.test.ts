import { test } from "node:test";
import assert from "node:assert/strict";
import { newId, newPrefixedId } from "@/lib/ids";
import { removePolishDiacritics, sanitizePdfFileName } from "@/lib/pdf-generator";

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
