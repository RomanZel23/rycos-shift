import { createHmac, timingSafeEqual } from "crypto";

/**
 * Etap 0 — tymczasowa bramka dostępu do /api/*.
 *
 * Nie zastępuje autentykacji użytkownika (to Etap 1). Jej jedynym zadaniem jest
 * odcięcie anonimowego ruchu z internetu od API, które dziś oddaje wszystkie
 * dane osobowe i pozwala kasować rekordy.
 *
 * Zasada działania: urządzenie raz podaje kod dostępu, dostaje ciasteczko
 * httpOnly z deterministycznym tokenem HMAC. Token da się zweryfikować
 * bezstanowo, więc nie potrzeba store'u sesji.
 */

export const GATE_COOKIE = "rycos_gate";
export const GATE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dni

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
      message: "Urządzenie nie ma autoryzacji. Podaj kod dostępu do aplikacji.",
    };
  }

  return null;
}
