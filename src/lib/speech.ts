/**
 * Etap 4 — odczyt wyniku z Web Speech API.
 *
 * Awaria: przy dyktowaniu opisu zdjęcia w polu lądowało
 *   „O Opisz Opisz zdjęcia Opisz zdjęcia numer Opisz zdjęcia numer jeden…"
 * czyli każda kolejna, coraz dłuższa wersja rozpoznawanej frazy, doklejona
 * jedna za drugą.
 *
 * Powód: `onresult` nie odpala się raz na wypowiedź. Przeglądarka wywołuje go
 * wielokrotnie w trakcie mówienia i za każdym razem podaje CAŁĄ dotychczasową
 * listę wyników — w tym wyniki tymczasowe (`isFinal === false`), które przy
 * kolejnych wywołaniach są poprawiane w miejscu. Stary kod brał zawsze
 * `results[0][0].transcript` i doklejał go do opisu, więc do pola trafiała
 * każda pośrednia wersja hipotezy.
 *
 * Poprawnie: czytamy wyłącznie wyniki od `event.resultIndex` (czyli te, które
 * pojawiły się od poprzedniego wywołania) i wyłącznie te oznaczone jako
 * ostateczne. Reszta to robocze domysły silnika rozpoznawania i nie ma prawa
 * dotknąć pola tekstowego.
 */

export interface SpeechAlternative {
  transcript: string;
}

export interface SpeechResult {
  readonly [index: number]: SpeechAlternative;
  isFinal: boolean;
  length: number;
}

export interface SpeechResultList {
  readonly [index: number]: SpeechResult;
  length: number;
}

export interface SpeechResultEvent {
  /** Indeks pierwszego wyniku zmienionego od poprzedniego zdarzenia. */
  resultIndex?: number;
  results: SpeechResultList;
}

/**
 * Zwraca tekst do dopisania do pola — same nowe, ostateczne fragmenty.
 * Pusty napis znaczy „nic jeszcze nie jest pewne, nie ruszaj pola".
 */
export function finalTranscriptFrom(event: SpeechResultEvent): string {
  const results = event?.results;
  if (!results || typeof results.length !== "number") return "";

  // Brak resultIndex (starsze silniki) traktujemy jak 0 — filtr isFinal
  // i tak nie dopuści powtórzeń wyników tymczasowych.
  const start = Number.isInteger(event.resultIndex) ? (event.resultIndex as number) : 0;

  const parts: string[] = [];
  for (let i = Math.max(0, start); i < results.length; i++) {
    const result = results[i];
    if (!result || !result.isFinal) continue;
    const transcript = result[0]?.transcript;
    if (typeof transcript === "string" && transcript.trim()) {
      parts.push(transcript.trim());
    }
  }

  return parts.join(" ").replace(/\s+/g, " ").trim();
}
