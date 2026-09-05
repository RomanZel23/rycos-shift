import { NextResponse } from "next/server";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lista kafelków do trybu „Wybór Pracownika" na ekranie logowania.
 *
 * Endpoint wymaga bramki urządzenia (patrz proxy.ts), ale z oczywistych powodów
 * nie może wymagać sesji. Dlatego oddaje absolutne minimum: imię, nazwisko,
 * stanowisko i informację, czy konto ma w ogóle ustawiony PIN. Bez loginów,
 * bez uprawnień administratora, bez dat i bez czegokolwiek z tabeli raportów.
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true, roster: [] });
  }

  const supabase = getSupabaseClient();
  if (!supabase) return NextResponse.json({ success: true, roster: [] });

  const { data, error } = await supabase
    .from("users")
    .select("id, first_name, last_name, role, is_foreman, pin_hash")
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
    hasPin: Boolean(row.pin_hash),
  }));

  return NextResponse.json({ success: true, roster });
}
