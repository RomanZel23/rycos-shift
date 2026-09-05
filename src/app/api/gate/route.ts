import { NextRequest, NextResponse } from "next/server";
import {
  GATE_COOKIE,
  GATE_MAX_AGE_SECONDS,
  expectedGateToken,
  isGateConfigured,
  isGateEnforced,
  verifyAccessCode,
  verifyGateToken,
} from "@/lib/gate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Prosty limiter prób w pamięci procesu. Na jednym kontenerze VPS wystarczy;
// przy skalowaniu poziomym trzeba przenieść do Redis / tabeli.
// ---------------------------------------------------------------------------
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

const attempts = new Map<string, { count: number; resetAt: number }>();

function clientKey(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function tooManyAttempts(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) return false;
  return entry.count >= MAX_ATTEMPTS;
}

function registerFailure(key: string): void {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count += 1;
}

function clearAttempts(key: string): void {
  attempts.delete(key);
}

/** Stan bramki dla klienta: czy trzeba pytać o kod i czy to urządzenie już przeszło. */
export async function GET(req: NextRequest) {
  const token = req.cookies.get(GATE_COOKIE)?.value;
  return NextResponse.json({
    required: isGateEnforced(),
    configured: isGateConfigured(),
    unlocked: verifyGateToken(token),
  });
}

/** Odblokowanie urządzenia kodem dostępu. */
export async function POST(req: NextRequest) {
  if (!isGateConfigured()) {
    return NextResponse.json(
      {
        success: false,
        code: "GATE_NOT_CONFIGURED",
        message:
          "Brak zmiennej APP_ACCESS_CODE po stronie serwera. Skontaktuj się z administratorem.",
      },
      { status: 503 }
    );
  }

  const key = clientKey(req);
  if (tooManyAttempts(key)) {
    return NextResponse.json(
      {
        success: false,
        code: "RATE_LIMITED",
        message: "Za dużo nieudanych prób. Spróbuj ponownie za kilkanaście minut.",
      },
      { status: 429 }
    );
  }

  let code = "";
  try {
    const body = await req.json();
    code = typeof body?.code === "string" ? body.code : "";
  } catch {
    code = "";
  }

  if (!verifyAccessCode(code)) {
    registerFailure(key);
    return NextResponse.json(
      { success: false, code: "INVALID_CODE", message: "Nieprawidłowy kod dostępu." },
      { status: 401 }
    );
  }

  clearAttempts(key);

  const res = NextResponse.json({ success: true });
  res.cookies.set({
    name: GATE_COOKIE,
    value: expectedGateToken(),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GATE_MAX_AGE_SECONDS,
  });
  return res;
}

/** Odpięcie urządzenia (np. zgubiony telefon — po zmianie APP_ACCESS_CODE). */
export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set({
    name: GATE_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}
