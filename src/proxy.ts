import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { GATE_COOKIE, gateFailure } from "@/lib/gate";

/**
 * Etap 0 — bramka na /api/*.
 *
 * W Next 16 konwencja `middleware.ts` została przemianowana na `proxy.ts`
 * (funkcja `proxy`, domyślnie runtime Node.js).
 *
 * Wyjątki bez bramki:
 *   /api/gate   — endpoint, który tę bramkę otwiera,
 *   /api/health — healthcheck Coolify / HEALTHCHECK w Dockerfile.
 */
const PUBLIC_API_PATHS = ["/api/gate", "/api/health"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_API_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  if (isPublic) {
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

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
