/**
 * Rozpoznanie systemu na potrzeby podpowiedzi „jak odblokować lokalizację".
 *
 * Jeden komunikat dla wszystkich nie działa: ścieżka do uprawnienia jest w innym
 * miejscu na komputerze, w Safari na iPadzie i w aplikacji dodanej do ekranu
 * głównego. Brygadzista stojący na placu z zablokowanym GPS-em nie ma czasu
 * zgadywać, a wskazówka prowadząca donikąd jest gorsza niż jej brak.
 *
 * Funkcje są czyste — biorą to, co odczyta komponent — żeby dało się je
 * sprawdzić testem bez przeglądarki.
 */

export type Platforma = "ios-safari" | "ios-aplikacja" | "android" | "komputer";

export function wykryjPlatforme(opcje: {
  userAgent: string;
  maxTouchPoints?: number;
  standalone?: boolean;
}): Platforma {
  const ua = opcje.userAgent || "";

  /**
   * iPadOS od wersji 13 przedstawia się w User-Agent jako Mac — celowo, żeby
   * dostawać „pełne" wersje stron. Jedyne wiarygodne rozróżnienie iPada od
   * MacBooka to obecność ekranu dotykowego.
   */
  const iOS =
    /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (opcje.maxTouchPoints || 0) > 1);

  if (iOS) return opcje.standalone ? "ios-aplikacja" : "ios-safari";
  if (/Android/.test(ua)) return "android";
  return "komputer";
}

/** Druga część komunikatu o zablokowanym GPS — co konkretnie zrobić. */
export function wskazowkaLokalizacji(platforma: Platforma): string {
  switch (platforma) {
    case "ios-safari":
      // „AA" siedzi po lewej stronie adresu i otwiera ustawienia tej witryny.
      // Gdy Usługi lokalizacji są wyłączone dla Safari na poziomie systemu,
      // żadne klikanie w przeglądarce nie pokaże monitu — stąd drugie zdanie.
      return (
        "Dotknij „AA” po lewej stronie adresu strony, wejdź w ustawienia witryny " +
        "i zezwól na lokalizację. Jeśli monit nadal się nie pojawia, w Ustawieniach " +
        "iPada sprawdź Usługi lokalizacji dla Safari."
      );
    case "ios-aplikacja":
      // Aplikacja z ekranu głównego ma własny wpis w Usługach lokalizacji —
      // ustawienie zrobione wcześniej w Safari jej nie dotyczy.
      return (
        "Aplikacja dodana do ekranu głównego ma własne uprawnienie. Otwórz Ustawienia " +
        "iPada, znajdź Usługi lokalizacji i zezwól na dostęp dla RYCOS Shift."
      );
    case "android":
      return (
        "Dotknij ikonę po lewej stronie adresu strony, wejdź w Uprawnienia " +
        "i włącz Lokalizację."
      );
    default:
      return "Kliknij ikonę po lewej stronie adresu strony i włącz „Lokalizacja”.";
  }
}
