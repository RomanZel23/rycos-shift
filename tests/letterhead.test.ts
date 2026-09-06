import { test } from "node:test";
import assert from "node:assert/strict";
import { LETTERHEAD } from "@/lib/brand";
import { PAGE_MARGIN_MM } from "@/lib/pdf-html-templates";

/**
 * Geometria papieru firmowego. Liczby pochodzą z pomiaru
 * docs/logo/company_layout.pdf i klient sprawdza je z linijką, więc każda
 * przypadkowa zmiana ma tu zapalić czerwone światło.
 *
 * Testy nie renderują PDF-a (to wymaga Chromium) — pilnują wartości wejściowych
 * i tego, że marginesy strony w ogóle mieszczą nagłówek i stopkę. Sam wynik
 * renderowania mierzy się osobno, skryptem scripts/zmierz-uklad.mjs.
 */

test("pozycje logo zgadzają się z pomiarem wzorca", () => {
  assert.deepEqual(LETTERHEAD.idream, { xMm: 22.51, yMm: 13.7, widthMm: 42.85, heightMm: 9.37 });
  assert.deepEqual(LETTERHEAD.solutionsBay, {
    xMm: 131.2,
    yMm: 13.5,
    widthMm: 54.55,
    heightMm: 9.3,
  });
});

test("oba znaki stoją na wspólnej linii i mają zbliżoną wysokość", () => {
  const { idream, solutionsBay } = LETTERHEAD;
  assert.ok(Math.abs(idream.yMm - solutionsBay.yMm) < 0.5, "górne krawędzie rozjechane");
  assert.ok(Math.abs(idream.heightMm - solutionsBay.heightMm) < 0.5, "różna wysokość znaków");
});

test("stopka: wcięcie i skok wierszy jak we wzorcu", () => {
  assert.equal(LETTERHEAD.footerLeftMm, 47.5);
  const [a, b, c] = LETTERHEAD.footerBaselinesMm;
  assert.equal(a, 277.35);
  assert.equal(c, 284.64);
  // Odstępy muszą być równe — inaczej stopka wygląda na złożoną „na oko".
  assert.ok(Math.abs((b - a) - (c - b)) < 0.05, `nierówny skok wierszy: ${b - a} vs ${c - b}`);
});

test("górny margines mieści nagłówek", () => {
  const { idream, solutionsBay } = LETTERHEAD;
  const dolNaglowka = Math.max(idream.yMm + idream.heightMm, solutionsBay.yMm + solutionsBay.heightMm);
  assert.ok(
    PAGE_MARGIN_MM.top > dolNaglowka,
    `treść zaczyna się na ${PAGE_MARGIN_MM.top} mm, a logo kończy na ${dolNaglowka} mm`
  );
});

test("dolny margines mieści stopkę", () => {
  const ostatnia = LETTERHEAD.footerBaselinesMm[2];
  const gornaKrawedzTekstu = LETTERHEAD.footerBaselinesMm[0] - 3;
  const koniecTresci = LETTERHEAD.pageHeightMm - PAGE_MARGIN_MM.bottom;
  assert.ok(
    koniecTresci < gornaKrawedzTekstu,
    `treść sięga ${koniecTresci} mm, a stopka zaczyna się ${gornaKrawedzTekstu} mm`
  );
  assert.ok(ostatnia < LETTERHEAD.pageHeightMm, "stopka wychodzi poza stronę");
});

test("marginesy treści są wyrównane do logo", () => {
  assert.equal(PAGE_MARGIN_MM.left, LETTERHEAD.contentLeftMm);
  assert.equal(PAGE_MARGIN_MM.right, LETTERHEAD.contentRightMm);
  // Lewa krawędź kolumny tekstu ma sięgać nie dalej niż lewa krawędź logo.
  assert.ok(PAGE_MARGIN_MM.left <= LETTERHEAD.idream.xMm);
  // Prawa krawędź kolumny ma pokrywać się z prawą krawędzią logo SolutionsBay.
  const prawaLogo = LETTERHEAD.solutionsBay.xMm + LETTERHEAD.solutionsBay.widthMm;
  const prawaTresci = LETTERHEAD.pageWidthMm - PAGE_MARGIN_MM.right;
  assert.ok(Math.abs(prawaTresci - prawaLogo) < 2.5, `${prawaTresci} vs ${prawaLogo}`);
});

test("strona wzorca to A4", () => {
  assert.ok(Math.abs(LETTERHEAD.pageWidthMm - 210) < 0.5);
  assert.ok(Math.abs(LETTERHEAD.pageHeightMm - 297) < 0.5);
});
