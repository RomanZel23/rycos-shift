import { test } from "node:test";
import assert from "node:assert/strict";
import { finalTranscriptFrom } from "@/lib/speech";
import type { SpeechResultEvent, SpeechResultList } from "@/lib/speech";

/** Buduje listę wyników w kształcie, jaki oddaje przeglądarka. */
function results(items: Array<[string, boolean]>): SpeechResultList {
  const list: Record<number, unknown> & { length: number } = { length: items.length };
  items.forEach(([transcript, isFinal], i) => {
    list[i] = { 0: { transcript }, isFinal, length: 1 };
  });
  return list as unknown as SpeechResultList;
}

function event(items: Array<[string, boolean]>, resultIndex?: number): SpeechResultEvent {
  return { resultIndex, results: results(items) };
}

test("wyniki tymczasowe nie trafiają do pola", () => {
  assert.equal(finalTranscriptFrom(event([["O", false]])), "");
  assert.equal(finalTranscriptFrom(event([["Opisz zdjęcia numer", false]])), "");
});

test("do pola trafia dopiero wynik ostateczny", () => {
  assert.equal(
    finalTranscriptFrom(event([["Opisz zdjęcia numer jeden", true]])),
    "Opisz zdjęcia numer jeden"
  );
});

test("odtworzenie awarii: cała sesja dyktowania dokleja frazę dokładnie raz", () => {
  // Dokładnie taki ciąg zdarzeń wyprodukował w polu
  // „O Opisz Opisz zdjęcia Opisz zdjęcia numer Opisz zdjęcia numer jeden".
  const sesja: Array<[string, boolean]>[] = [
    [["O", false]],
    [["Opisz", false]],
    [["Opisz zdjęcia", false]],
    [["Opisz zdjęcia numer", false]],
    [["Opisz zdjęcia numer jeden", false]],
    [["Opisz zdjęcia numer jeden", true]],
  ];

  let pole = "";
  for (const krok of sesja) {
    const tekst = finalTranscriptFrom(event(krok, 0));
    if (tekst) pole = pole ? `${pole} ${tekst}` : tekst;
  }

  assert.equal(pole, "Opisz zdjęcia numer jeden");
});

test("resultIndex pomija fragmenty już dopisane", () => {
  // Druga wypowiedź w tej samej sesji: przeglądarka podaje CAŁĄ listę,
  // ale resultIndex wskazuje, co jest nowe. Bez tego pierwszy fragment
  // zostałby dopisany po raz drugi.
  const ev = event([["Wykonano wykop", true], ["pod fundament", true]], 1);
  assert.equal(finalTranscriptFrom(ev), "pod fundament");
});

test("brak resultIndex — bierzemy wszystko, co ostateczne", () => {
  const ev = event([["Wykonano wykop", true], ["pod fundament", true]]);
  assert.equal(finalTranscriptFrom(ev), "Wykonano wykop pod fundament");
});

test("mieszanka ostatecznych i tymczasowych bierze tylko ostateczne", () => {
  const ev = event([["Wykonano wykop", true], ["pod fund", false]], 0);
  assert.equal(finalTranscriptFrom(ev), "Wykonano wykop");
});

test("puste, białe znaki i uszkodzone dane nie psują pola", () => {
  assert.equal(finalTranscriptFrom(event([])), "");
  assert.equal(finalTranscriptFrom(event([["   ", true]])), "");
  assert.equal(finalTranscriptFrom(event([["  dwa   słowa  ", true]])), "dwa słowa");
  assert.equal(finalTranscriptFrom({ results: undefined } as unknown as SpeechResultEvent), "");
  assert.equal(finalTranscriptFrom({} as SpeechResultEvent), "");
  assert.equal(finalTranscriptFrom(event([["x", true]], -5)), "x");
});

test("polskie znaki przechodzą bez zmian", () => {
  assert.equal(
    finalTranscriptFrom(event([["Zażółć gęślą jaźń przy ścianie", true]])),
    "Zażółć gęślą jaźń przy ścianie"
  );
});
