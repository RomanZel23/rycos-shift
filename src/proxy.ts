import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GATE_COOKIE, gateFailure } from "@/lib/gate";
import { SESSION_COOKIE, readSessionToken } from "@/lib/session";

/**
 * Dwie warstwy przed każdym /api/*:
 *
 *   1. Bramka urządzenia (Etap 0) — odcina anonimowy ruch z internetu.
 *   2. Sesja użytkownika (Etap 1) — tani sprawdzian podpisu ciasteczka.
 *
 * Warstwa druga celowo NIE dotyka bazy. Autorytatywna weryfikacja — czy konto
 * nadal istnieje, czy epoka sesji się zgadza, czy to administrator — dzieje się
 * w route handlerach przez requireUser/requireAdmin. Proxy ma tylko odsiać
 * ruch bez ważnego podpisu, zanim cokolwiek dotknie Supabase.
 *
 * W Next 16 konwencja `middleware.ts` jest przemianowana na `proxy.ts`
 * (funkcja `proxy`, domyślnie runtime Node.js).
 */

/** Poza bramką urządzenia i poza sesją. */
const PUBLIC_API_PATHS = ["/api/gate", "/api/health"];

/** Za bramką urządzenia, ale bez wymogu sesji — inaczej nie dałoby się zalogować. */
const GATE_ONLY_API_PATHS = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/auth/roster",
];

function matches(pathname: string, list: string[]): boolean {
  return list.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (matches(pathname, PUBLIC_API_PATHS)) {
    return NextResponse.next();
  }

  const failure = gateFailure(request.cookies.get(GATE_COOKIE)?.value);
  if (failure) {
    return NextResponse.json(
      {
        success: false,
        isConnected: false,
        code: failure.code,
        message: failure.message,
      },
      { status: failure.status }
    );
  }

  if (matches(pathname, GATE_ONLY_API_PATHS)) {
    return NextResponse.next();
  }

  const session = readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json(
      {
        success: false,
        isConnected: false,
        code: "UNAUTHENTICATED",
        message: "Sesja wygasła lub nie jesteś zalogowany.",
      },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
