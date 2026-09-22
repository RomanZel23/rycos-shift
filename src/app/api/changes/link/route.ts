import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { clientIpFromHeaders } from "@/lib/client-ip";
import { burnVerificationTime, verifySecret } from "@/lib/password";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  isSessionSecretConfigured,
  sessionCookieOptions,
} from "@/lib/session";
import { GATE_COOKIE, expectedGateToken, gateCookieOptions, isGateConfigured } from "@/lib/gate";
import { CHANGES_TABLE, CHANGE_DECISIONS_TABLE, hashLinkToken } from "@/lib/project-change-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Wejście akceptującego z linku w mailu: link + PIN.
 *
 * Endpoint jest PRZED bramką urządzenia i przed sesją (proxy.ts) — akceptujący
 * klika link na swoim telefonie czy komputerze, na którym nikt nie wpisywał
 * kodu dostępu. Sam link nie wystarcza: przekazany dalej mail nie może
 * pozwolić komuś innemu podpisać się za akceptującego, dlatego wymagany jest
 * jeszcze jego PIN (nadaje go administrator).
 *
 * Po poprawnym PIN-ie przeglądarka dostaje ciasteczko bramki i sesję — od tej
 * chwili akceptujący loguje się do aplikacji zwyczajnie (wybór pracownika + PIN).
 */

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const IP_MAX_ATTEMPTS = 20;
const IP_WINDOW_MS = 15 * 60 * 1000;
const ipAttempts = new Map<string, { count: number; resetAt: number }>();

function ipBlocked(key: string): boolean {
  const e = ipAttempts.get(key);
  return Boolean(e && e.resetAt > Date.now() && e.count >= IP_MAX_ATTEMPTS);
}

function registerIpFailure(key: string): void {
  const now = Date.now();
  const e = ipAttempts.get(key);
  if (!e || e.resetAt < now) {
    ipAttempts.set(key, { count: 1, resetAt: now + IP_WINDOW_MS });
    return;
  }
  e.count += 1;
}

interface LinkLookup {
  decision: {
    id: string;
    change_id: string;
    acceptor_id: string;
    acceptor_name: string;
    decision: string;
    token_expires_at: string | null;
  };
  change: { number: string; name: string };
}

async function lookup(token: string): Promise<LinkLookup | "expired" | null> {
  const supabase = getSupabaseClient();
  if (!supabase || !token || token.length > 200) return null;
  const { data: decision } = await supabase
    .from(CHANGE_DECISIONS_TABLE)
    .select("id, change_id, acceptor_id, acceptor_name, decision, token_expires_at")
    .eq("token_hash", hashLinkToken(token))
    .maybeSingle();
  if (!decision) return null;
  if (!decision.token_expires_at || new Date(decision.token_expires_at).getTime() < Date.now()) {
    return "expired";
  }
  const { data: change } = await supabase
    .from(CHANGES_TABLE)
    .select("number, name")
    .eq("id", decision.change_id)
    .maybeSingle();
  if (!change) return null;
  return { decision, change };
}

/** Co pokazać na ekranie PIN-u — minimum: imię adresata, numer i nazwa karty. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const found = await lookup(token);
  if (found === "expired") {
    return NextResponse.json(
      {
        success: false,
        code: "LINK_EXPIRED",
        message:
          "Link wygasł albo karta została zmieniona i dostałeś nowy link. Zaloguj się do aplikacji albo poproś autora karty o ponowne wysłanie.",
      },
      { status: 410 }
    );
  }
  if (!found) {
    return NextResponse.json(
      { success: false, code: "LINK_INVALID", message: "Ten link jest nieprawidłowy." },
      { status: 404 }
    );
  }
  return NextResponse.json({
    success: true,
    acceptorName: found.decision.acceptor_name,
    number: found.change.number,
    name: found.change.name,
  });
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseClient();
  if (!supabase || !isSessionSecretConfigured()) {
    return NextResponse.json(
      { success: false, message: "Logowanie jest chwilowo niedostępne." },
      { status: 503 }
    );
  }

  const ip = clientIpFromHeaders(req.headers);
  if (ipBlocked(ip)) {
    return NextResponse.json(
      { success: false, code: "RATE_LIMITED", message: "Za dużo prób. Odczekaj kilkanaście minut." },
      { status: 429 }
    );
  }

  let token = "";
  let pin = "";
  try {
    const body = await req.json();
    token = typeof body?.token === "string" ? body.token : "";
    pin = typeof body?.pin === "string" ? body.pin : "";
  } catch {
    /* puste pola obsłuży kod niżej */
  }

  const found = await lookup(token);
  if (!found || found === "expired" || !pin) {
    registerIpFailure(ip);
    await burnVerificationTime();
    return NextResponse.json(
      {
        success: false,
        code: found === "expired" ? "LINK_EXPIRED" : "INVALID",
        message: found === "expired" ? "Link wygasł." : "Nieprawidłowy link lub PIN.",
      },
      { status: 401 }
    );
  }

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("id", found.decision.acceptor_id)
    .maybeSingle();
  if (!user || !user.can_accept_changes) {
    registerIpFailure(ip);
    return NextResponse.json(
      { success: false, message: "To konto nie ma już kompetencji akceptacji zmian." },
      { status: 403 }
    );
  }

  if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
    const minutes = Math.max(1, Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000));
    return NextResponse.json(
      {
        success: false,
        code: "ACCOUNT_LOCKED",
        message: `Konto tymczasowo zablokowane po nieudanych próbach. Spróbuj za ${minutes} min.`,
      },
      { status: 423 }
    );
  }

  if (!user.pin_hash) {
    await burnVerificationTime();
    return NextResponse.json(
      {
        success: false,
        code: "NO_PIN",
        message: "Nie masz jeszcze PIN-u. Poproś administratora o jego nadanie.",
      },
      { status: 403 }
    );
  }

  const ok = await verifySecret(pin, user.pin_hash);
  if (!ok) {
    registerIpFailure(ip);
    const attempts = (user.failed_login_attempts || 0) + 1;
    const lockedUntil =
      attempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString()
        : null;
    await supabase
      .from("users")
      .update({ failed_login_attempts: lockedUntil ? 0 : attempts, locked_until: lockedUntil })
      .eq("id", user.id);
    return NextResponse.json(
      {
        success: false,
        code: lockedUntil ? "ACCOUNT_LOCKED" : "INVALID",
        message: lockedUntil
          ? `Konto zablokowane na ${LOCK_MINUTES} min po ${MAX_FAILED_ATTEMPTS} nieudanych próbach.`
          : "Nieprawidłowy PIN.",
      },
      { status: lockedUntil ? 423 : 401 }
    );
  }

  await supabase
    .from("users")
    .update({ failed_login_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() })
    .eq("id", user.id);

  const res = NextResponse.json({ success: true, changeId: found.decision.change_id });
  res.cookies.set({
    name: SESSION_COOKIE,
    value: createSessionToken(user.id, Number(user.session_epoch ?? 1)),
    ...sessionCookieOptions(SESSION_TTL_SECONDS),
  });
  // Ta przeglądarka przeszła link + PIN — dostaje też autoryzację urządzenia,
  // żeby kolejne wejścia działały przez zwykłe logowanie.
  if (isGateConfigured()) {
    res.cookies.set({ name: GATE_COOKIE, value: expectedGateToken(), ...gateCookieOptions() });
  }
  return res;
}
