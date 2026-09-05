import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "./supabase";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  readSessionToken,
  sessionCookieOptions,
  shouldRefreshSession,
} from "./session";

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  isForeman: boolean;
  isAdmin: boolean;
  login: string;
  sessionEpoch: number;
}

export interface AuthContext {
  user: AuthUser;
  /** Ustawione, gdy ciasteczko zbliża się do końca ważności i warto je odnowić. */
  refreshedToken?: string;
}

const USER_COLUMNS =
  "id, first_name, last_name, role, is_foreman, is_admin, login, session_epoch";

function mapUser(row: Record<string, unknown>): AuthUser {
  return {
    id: String(row.id),
    firstName: String(row.first_name ?? ""),
    lastName: String(row.last_name ?? ""),
    role: String(row.role ?? ""),
    isForeman: Boolean(row.is_foreman),
    isAdmin: Boolean(row.is_admin),
    login: String(row.login ?? ""),
    sessionEpoch: Number(row.session_epoch ?? 0),
  };
}

/**
 * Autorytatywne rozpoznanie użytkownika: podpis ciasteczka + istnienie konta
 * w bazie + zgodność epoki sesji. Proxy sprawdza tylko podpis, więc każdy route
 * musi wywołać to sam — inaczej zmiana hasła albo usunięcie konta nie
 * unieważniłoby aktywnych sesji.
 */
export async function loadAuthContext(req: NextRequest): Promise<AuthContext | null> {
  const payload = readSessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!payload) return null;

  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("users")
    .select(USER_COLUMNS)
    .eq("id", payload.uid)
    .maybeSingle();

  if (error || !data) return null;

  const user = mapUser(data);
  if (user.sessionEpoch !== payload.ep) return null;

  const context: AuthContext = { user };
  if (shouldRefreshSession(payload)) {
    context.refreshedToken = createSessionToken(user.id, user.sessionEpoch);
  }
  return context;
}

export function unauthorized(message = "Wymagane zalogowanie.") {
  return NextResponse.json(
    { success: false, code: "UNAUTHENTICATED", message },
    { status: 401 }
  );
}

export function forbidden(message = "Brak uprawnień do tej operacji.") {
  return NextResponse.json({ success: false, code: "FORBIDDEN", message }, { status: 403 });
}

/** Dokleja odświeżone ciasteczko sesji do odpowiedzi, jeśli trzeba. */
export function withRefreshedSession<T extends NextResponse>(
  res: T,
  context: AuthContext
): T {
  if (context.refreshedToken) {
    res.cookies.set({
      name: SESSION_COOKIE,
      value: context.refreshedToken,
      ...sessionCookieOptions(SESSION_TTL_SECONDS),
    });
  }
  return res;
}

/**
 * Wygodny wrapper: zwraca albo kontekst, albo gotową odpowiedź błędu.
 * Użycie: `const auth = await requireUser(req); if ("response" in auth) return auth.response;`
 */
export async function requireUser(
  req: NextRequest
): Promise<{ context: AuthContext } | { response: NextResponse }> {
  const context = await loadAuthContext(req);
  if (!context) return { response: unauthorized() };
  return { context };
}

export async function requireAdmin(
  req: NextRequest
): Promise<{ context: AuthContext } | { response: NextResponse }> {
  const context = await loadAuthContext(req);
  if (!context) return { response: unauthorized() };
  if (!context.user.isAdmin) return { response: forbidden() };
  return { context };
}
