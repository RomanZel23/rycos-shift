import { createHmac, timingSafeEqual } from "crypto";

/**
 * Etap 1 — sesje użytkowników na podpisanym ciasteczku httpOnly.
 *
 * Świadomie bez tabeli sesji: podpis HMAC weryfikuje się bez zapytania do bazy,
 * więc proxy.ts może odsiać anonimowy ruch zanim dotknie Supabase. Unieważnianie
 * realizuje pole session_epoch na użytkowniku — route handlery i tak czytają
 * użytkownika z bazy, więc porównanie epoki nic nie kosztuje. Zmiana hasła,
 * PIN-u lub uprawnień podnosi epokę i wywala wszystkie stare ciasteczka.
 */

export const SESSION_COOKIE = "rycos_session";
export const SESSION_TTL_SECONDS = 12 * 60 * 60; // jedna zmiana robocza
/** Ciasteczko odnawiamy, gdy zostało mu mniej niż tyle czasu. */
export const SESSION_REFRESH_THRESHOLD_SECONDS = 2 * 60 * 60;

export interface SessionPayload {
  /** id użytkownika */
  uid: string;
  /** session_epoch z bazy w chwili logowania */
  ep: number;
  /** wystawione (ms) */
  iat: number;
  /** wygasa (ms) */
  exp: number;
}

function rawSecret(): string {
  return (process.env.SESSION_SECRET || process.env.GATE_SECRET || "").trim();
}

export function isSessionSecretConfigured(): boolean {
  return rawSecret().length >= 16;
}

/**
 * Klucz podpisu wyprowadzony z sekretu przez etykietę, żeby sesje i bramka
 * urządzenia nie używały tego samego materiału, nawet gdy dzielą GATE_SECRET.
 */
function signingKey(): Buffer {
  return createHmac("sha256", rawSecret()).update("rycos-session-v1").digest();
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(value: string): Buffer {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(body: string): string {
  return createHmac("sha256", signingKey()).update(body).digest("hex");
}

export function createSessionToken(uid: string, epoch: number, now = Date.now()): string {
  const payload: SessionPayload = {
    uid,
    ep: epoch,
    iat: now,
    exp: now + SESSION_TTL_SECONDS * 1000,
  };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

/**
 * Weryfikuje podpis i termin ważności. NIE sprawdza, czy użytkownik nadal
 * istnieje ani czy epoka się zgadza — to robi warstwa z dostępem do bazy
 * (src/lib/auth.ts). Tutaj chodzi o tani filtr do użycia w proxy.
 */
export function readSessionToken(
  token?: string | null,
  now = Date.now()
): SessionPayload | null {
  if (!token || !isSessionSecretConfigured()) return null;

  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;

  const body = token.slice(0, dot);
  const providedSignature = token.slice(dot + 1);
  const expectedSignature = sign(body);

  const a = Buffer.from(providedSignature, "utf8");
  const b = Buffer.from(expectedSignature, "utf8");
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(fromB64url(body).toString("utf8"));
  } catch {
    return null;
  }

  if (
    typeof payload?.uid !== "string" ||
    typeof payload?.ep !== "number" ||
    typeof payload?.exp !== "number"
  ) {
    return null;
  }
  if (payload.exp <= now) return null;

  return payload;
}

/** Czy ciasteczko warto odświeżyć w odpowiedzi na to żądanie. */
export function shouldRefreshSession(payload: SessionPayload, now = Date.now()): boolean {
  return payload.exp - now < SESSION_REFRESH_THRESHOLD_SECONDS * 1000;
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
