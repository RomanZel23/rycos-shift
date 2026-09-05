import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { requireAdmin, withRefreshedSession } from "@/lib/auth";
import { hashSecret, validatePassword, validatePin } from "@/lib/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Nadawanie i kasowanie poświadczeń przez administratora.
 *
 * Ustalona zasada: hasła i PIN-y nadaje administrator, nie ma samodzielnej
 * rejestracji ani resetu. Każda zmiana podnosi session_epoch, więc aktywne
 * sesje danego użytkownika natychmiast tracą ważność.
 *
 * body: { userId, password?, pin?, clearPassword?, clearPin? }
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("response" in auth) return auth.response;

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, message: "Baza danych nie jest skonfigurowana." },
      { status: 503 }
    );
  }

  let body: {
    userId?: string;
    password?: string;
    pin?: string;
    clearPassword?: boolean;
    clearPin?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Nieprawidłowe żądanie." },
      { status: 400 }
    );
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!userId) {
    return NextResponse.json(
      { success: false, message: "Brak identyfikatora użytkownika." },
      { status: 400 }
    );
  }

  const { data: target } = await supabase
    .from("users")
    .select("id, is_admin, session_epoch")
    .eq("id", userId)
    .maybeSingle();

  if (!target) {
    return NextResponse.json(
      { success: false, message: "Nie znaleziono użytkownika." },
      { status: 404 }
    );
  }

  const update: Record<string, unknown> = {};

  if (typeof body.password === "string" && body.password.length > 0) {
    const problem = validatePassword(body.password);
    if (problem) return NextResponse.json({ success: false, message: problem }, { status: 400 });
    update.password_hash = await hashSecret(body.password);
  } else if (body.clearPassword) {
    update.password_hash = null;
  }

  if (typeof body.pin === "string" && body.pin.length > 0) {
    const problem = validatePin(body.pin);
    if (problem) return NextResponse.json({ success: false, message: problem }, { status: 400 });
    update.pin_hash = await hashSecret(body.pin);
  } else if (body.clearPin) {
    update.pin_hash = null;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { success: false, message: "Nie podano hasła ani PIN-u do ustawienia." },
      { status: 400 }
    );
  }

  // Odbieranie sobie samemu ostatniego hasła zamknęłoby dostęp do panelu.
  if (
    userId === auth.context.user.id &&
    (update.password_hash === null || body.clearPassword)
  ) {
    return NextResponse.json(
      {
        success: false,
        message: "Nie można skasować własnego hasła administratora.",
      },
      { status: 400 }
    );
  }

  update.failed_login_attempts = 0;
  update.locked_until = null;
  update.session_epoch = Number(target.session_epoch ?? 1) + 1;

  const { error } = await supabase.from("users").update(update).eq("id", userId);
  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return withRefreshedSession(
    NextResponse.json({
      success: true,
      message: "Poświadczenia zaktualizowane. Aktywne sesje tego użytkownika wygasły.",
    }),
    auth.context
  );
}

/** Odblokowanie konta zablokowanego po nieudanych próbach. */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("response" in auth) return auth.response;

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Brak bazy." }, { status: 503 });
  }

  let userId = "";
  try {
    const body = await req.json();
    userId = typeof body?.userId === "string" ? body.userId.trim() : "";
  } catch {
    userId = "";
  }
  if (!userId) {
    return NextResponse.json({ success: false, message: "Brak userId." }, { status: 400 });
  }

  const { error } = await supabase
    .from("users")
    .update({ failed_login_attempts: 0, locked_until: null })
    .eq("id", userId);

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  return withRefreshedSession(
    NextResponse.json({ success: true, message: "Konto odblokowane." }),
    auth.context
  );
}
