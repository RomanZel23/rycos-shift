import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { burnVerificationTime, verifySecret } from "@/lib/password";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  isSessionSecretConfigured,
  sessionCookieOptions,
} from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

// Limiter na IP — niezależny od blokady konta, żeby jedno urządzenie nie mogło
// przeczesywać wielu kont po kolei.
const IP_MAX_ATTEMPTS = 20;
const IP_WINDOW_MS = 15 * 60 * 1000;
const ipAttempts = new Map<string, { count: number; resetAt: number }>();

function clientKey(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function ipBlocked(key: string): boolean {
  const entry = ipAttempts.get(key);
  return Boolean(entry && entry.resetAt > Date.now() && entry.count >= IP_MAX_ATTEMPTS);
}

function registerIpFailure(key: string): void {
  const now = Date.now();
  const entry = ipAttempts.get(key);
  if (!entry || entry.resetAt < now) {
    ipAttempts.set(key, { count: 1, resetAt: now + IP_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

/** Ta sama treść dla złego loginu i złego hasła — nie podpowiadamy, co było nie tak. */
function invalidCredentials() {
  return NextResponse.json(
    {
      success: false,
      code: "INVALID_CREDENTIALS",
      message: "Nieprawidłowe dane logowania.",
    },
    { status: 401 }
  );
}

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, code: "NO_DB", message: "Baza danych nie jest skonfigurowana." },
      { status: 503 }
    );
  }
  if (!isSessionSecretConfigured()) {
    return NextResponse.json(
      {
        success: false,
        code: "NO_SESSION_SECRET",
        message:
          "Brak SESSION_SECRET (lub GATE_SECRET) po stronie serwera — logowanie wyłączone.",
      },
      { status: 503 }
    );
  }

  const ipKey = clientKey(req);
  if (ipBlocked(ipKey)) {
    return NextResponse.json(
      {
        success: false,
        code: "RATE_LIMITED",
        message: "Za dużo prób logowania z tego urządzenia. Odczekaj kilkanaście minut.",
      },
      { status: 429 }
    );
  }

  let mode: "password" | "pin" = "password";
  let login = "";
  let userId = "";
  let secret = "";
  try {
    const body = await req.json();
    login = typeof body?.login === "string" ? body.login.trim() : "";
    userId = typeof body?.userId === "string" ? body.userId.trim() : "";
    secret = typeof body?.secret === "string" ? body.secret : "";
    mode = body?.mode === "pin" ? "pin" : "password";
  } catch {
    return invalidCredentials();
  }

  if (!secret || (mode === "pin" ? !userId : !login)) {
    registerIpFailure(ipKey);
    await burnVerificationTime();
    return invalidCredentials();
  }

  const supabase = getSupabaseClient();
  if (!supabase) return invalidCredentials();

  const query = supabase
    .from("users")
    .select(
      "id, first_name, last_name, role, is_foreman, is_admin, login, password_hash, pin_hash, failed_login_attempts, locked_until, session_epoch"
    );

  const { data: row } = await (mode === "pin"
    ? query.eq("id", userId).maybeSingle()
    : query.ilike("login", login).maybeSingle());

  if (!row) {
    registerIpFailure(ipKey);
    await burnVerificationTime(); // wyrównanie czasu odpowiedzi
    return invalidCredentials();
  }

  // Blokada konta po serii nieudanych prób
  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
    const minutes = Math.max(
      1,
      Math.ceil((new Date(row.locked_until).getTime() - Date.now()) / 60000)
    );
    return NextResponse.json(
      {
        success: false,
        code: "ACCOUNT_LOCKED",
        message: `Konto tymczasowo zablokowane po nieudanych próbach. Spróbuj za ${minutes} min.`,
      },
      { status: 423 }
    );
  }

  const storedHash = mode === "pin" ? row.pin_hash : row.password_hash;

  if (!storedHash) {
    registerIpFailure(ipKey);
    await burnVerificationTime();
    return NextResponse.json(
      {
        success: false,
        code: "NO_CREDENTIALS_SET",
        message:
          mode === "pin"
            ? "To konto nie ma jeszcze ustawionego PIN-u. Zgłoś się do administratora."
            : "To konto nie ma jeszcze ustawionego hasła. Zgłoś się do administratora.",
      },
      { status: 403 }
    );
  }

  const ok = await verifySecret(secret, storedHash);

  if (!ok) {
    registerIpFailure(ipKey);
    const attempts = (row.failed_login_attempts || 0) + 1;
    const lockedUntil =
      attempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString()
        : null;

    await supabase
      .from("users")
      .update({
        failed_login_attempts: lockedUntil ? 0 : attempts,
        locked_until: lockedUntil,
      })
      .eq("id", row.id);

    if (lockedUntil) {
      return NextResponse.json(
        {
          success: false,
          code: "ACCOUNT_LOCKED",
          message: `Konto zablokowane na ${LOCK_MINUTES} min po ${MAX_FAILED_ATTEMPTS} nieudanych próbach.`,
        },
        { status: 423 }
      );
    }
    return invalidCredentials();
  }

  // Sukces — zerujemy liczniki i wystawiamy sesję
  await supabase
    .from("users")
    .update({
      failed_login_attempts: 0,
      locked_until: null,
      last_login_at: new Date().toISOString(),
    })
    .eq("id", row.id);

  const epoch = Number(row.session_epoch ?? 1);
  const token = createSessionToken(row.id, epoch);

  const res = NextResponse.json({
    success: true,
    user: {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      role: row.role,
      isForeman: row.is_foreman,
      isAdmin: row.is_admin,
      login: row.login,
      createdAt: "",
    },
  });
  res.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    ...sessionCookieOptions(SESSION_TTL_SECONDS),
  });
  return res;
}
