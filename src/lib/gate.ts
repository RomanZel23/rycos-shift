import { createHmac, timingSafeEqual } from "crypto";

/**
 * Etap 0 — tymczasowa bramka dostępu do /api/*.
 *
 * Nie zastępuje autentykacji użytkownika (to Etap 1). Jej jedynym zadaniem jest
 * odcięcie anonimowego ruchu z internetu od API, które dziś oddaje wszystkie
 * dane osobowe i pozwala kasować rekordy.
 *
 * Zasada działania: przeglądarka raz podaje kod dostępu, dostaje ciasteczko
 * httpOnly z deterministycznym tokenem HMAC. Token da się zweryfikować
 * bezstanowo, więc nie potrzeba store'u sesji.
 *
 * Zakres ciasteczka to PRZEGLĄDARKA, nie urządzenie. Inny profil, tryb
 * prywatny i aplikacja dodana do ekranu głównego na iOS mają osobne magazyny
 * ciasteczek, więc każde z nich poprosi o kod osobno. Ekran bramki mówi o tym
 * wprost — wcześniejsze „wystarczy raz na telefon" było obietnicą nie do
 * dotrzymania.
 *
 * Ważność jest przedłużana przy każdym żądaniu z poprawnym tokenem (proxy.ts
 * oraz GET /api/gate), więc 30 dni liczy się od OSTATNIEGO użycia aplikacji,
 * a nie od pierwszego wpisania kodu. Bez tego ekran kodu wracał co miesiąc
 * nawet osobom pracującym w aplikacji codziennie.
 */

export const GATE_COOKIE = "rycos_gate";
export const GATE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dni od ostatniego użycia

const TOKEN_PAYLOAD = "rycos-gate-v1";

function accessCode(): string {
  return (process.env.APP_ACCESS_CODE || "").trim();
}

function signingSecret(): string {
  return (process.env.GATE_SECRET || process.env.APP_ACCESS_CODE || "").trim();
}

/** Czy kod dostępu jest w ogóle skonfigurowany. */
export function isGateConfigured(): boolean {
  return accessCode().length > 0;
}

/**
 * Czy bramka ma być egzekwowana.
 * Produkcja bez APP_ACCESS_CODE ma padać głośno (patrz gateFailure), a nie
 * po cichu wpuszczać wszystkich — dlatego tutaj zawsze true poza devem.
 */
export function isGateEnforced(): boolean {
  if (isGateConfigured()) return true;
  return process.env.NODE_ENV === "production";
}

/** Deterministyczny token wpisywany do ciasteczka. */
export function expectedGateToken(): string {
  return createHmac("sha256", signingSecret())
    .update(`${TOKEN_PAYLOAD}:${accessCode()}`)
    .digest("hex");
}

function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Porównanie i tak wykonujemy, żeby czas odpowiedzi nie zdradzał długości.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/** Weryfikacja wartości ciasteczka. */
export function verifyGateToken(token?: string | null): boolean {
  if (!isGateConfigured()) return false;
  if (!token) return false;
  return safeEquals(token, expectedGateToken());
}

/**
 * Opcje ciasteczka bramki — jedno miejsce dla /api/gate i dla przedłużania
 * ważności w proxy.ts. Rozjazd między tymi dwoma zestawami atrybutów kasowałby
 * i zakładał ciasteczko na przemian zamiast je przedłużać.
 */
export function gateCookieOptions(maxAgeSeconds: number = GATE_MAX_AGE_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

/** Weryfikacja kodu wpisanego przez użytkownika. */
export function verifyAccessCode(code?: string | null): boolean {
  if (!isGateConfigured()) return false;
  if (typeof code !== "string" || code.length === 0) return false;
  return safeEquals(code.trim(), accessCode());
}

/**
 * Powód odmowy, jeśli żądanie nie może przejść. `null` = przepuść.
 * Zwracamy strukturę, a nie Response, żeby dało się jej użyć zarówno
 * w proxy.ts, jak i wewnątrz route handlerów.
 */
export function gateFailure(token?: string | null):
  | { status: number; code: string; message: string }
  | null {
  if (!isGateEnforced()) return null;

  if (!isGateConfigured()) {
    return {
      status: 503,
      code: "GATE_NOT_CONFIGURED",
      message:
        "Brak zmiennej APP_ACCESS_CODE. API jest zablokowane do czasu jej ustawienia.",
    };
  }

  if (!verifyGateToken(token)) {
    return {
      status: 401,
      code: "GATE_LOCKED",
      message: "Ta przeglądarka nie ma autoryzacji. Podaj kod dostępu do aplikacji.",
    };
  }

  return null;
}
