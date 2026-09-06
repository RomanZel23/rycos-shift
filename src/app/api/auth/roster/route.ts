import { NextResponse } from "next/server";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lista kafelków do trybu „Wybór Pracownika" na ekranie logowania.
 *
 * Endpoint wymaga bramki urządzenia (patrz proxy.ts), ale z oczywistych powodów
 * nie może wymagać sesji. Oddaje więc minimum: imię, nazwisko, stanowisko oraz
 * informację, czy konto ma ustawiony PIN. Bez loginów, bez dat, bez czegokolwiek
 * z tabeli raportów.
 *
 * `isAdmin` jest tu świadomym wyjątkiem, na życzenie klienta: kafelek
 * administratora ma być wyróżniony kolorem już na ekranie wyboru pracownika.
 * Oznacza to, że lista serwowana PRZED zalogowaniem wskazuje, które konto jest
 * administratorem. Ryzyko domykają PIN, blokada po nieudanych próbach
 * (src/app/api/auth/login) i kod dostępu do urządzenia.
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true, roster: [] });
  }

  const supabase = getSupabaseClient();
  if (!supabase) return NextResponse.json({ success: true, roster: [] });

  const { data, error } = await supabase
    .from("users")
    .select("id, first_name, last_name, role, is_foreman, is_admin, pin_hash")
    .order("last_name", { ascending: true });

  if (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }

  const roster = (data || []).map((row) => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    isForeman: Boolean(row.is_foreman),
    isAdmin: Boolean(row.is_admin),
    hasPin: Boolean(row.pin_hash),
  }));

  return NextResponse.json({ success: true, roster });
}
