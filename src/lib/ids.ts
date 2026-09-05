/**
 * Etap 4 — identyfikatory raportów, zdjęć i podpisów.
 *
 * Wcześniej było `"rep-start-" + Date.now()`. Przy zegarze z rozdzielczością
 * milisekundy dwa raporty złożone w tej samej milisekundzie dostawały ten sam
 * identyfikator, a zapis idzie przez `upsert` po kolumnie `id` — drugi raport
 * nadpisałby pierwszy zamiast dołożyć wiersz. To nie jest teoria: 2026-09-02
 * powstały dwie fotorelacje w odstępie ośmiu minut, więc dublowanie w obrębie
 * jednego dnia to normalny scenariusz, a nie wyjątek.
 *
 * Dodatkowo `Date.now()` zdradza czas utworzenia w treści identyfikatora
 * i przy przestawieniu zegara urządzenia potrafi się cofnąć.
 */

/** UUID v4 z fallbackiem dla przeglądarek bez `crypto.randomUUID`. */
export function newId(): string {
  if (typeof crypto !== "undefined") {
    if (typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    // Safari poniżej 15.4 ma getRandomValues, ale nie ma randomUUID.
    if (typeof crypto.getRandomValues === "function") {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // wersja 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // wariant RFC 4122
      const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
  }
  // Ostatnia deska ratunku — środowisko bez Web Crypto. Nie jest kryptograficznie
  // losowe, ale nadal nie koliduje w obrębie jednej milisekundy.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

/**
 * Identyfikator z czytelnym prefiksem. Sam UUID w logach i w archiwum nic nie
 * mówi; prefiks pozwala od razu poznać, na co się patrzy.
 */
export function newPrefixedId(prefix: string): string {
  return `${prefix}-${newId()}`;
}
