import { NextRequest, NextResponse } from "next/server";
import { loadAuthContext, withRefreshedSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kto jest zalogowany. Zwraca 200 z user:null zamiast 401, bo ekran logowania
 * odpytuje ten endpoint na starcie i brak sesji nie jest tam błędem.
 */
export async function GET(req: NextRequest) {
  const context = await loadAuthContext(req);
  if (!context) {
    return NextResponse.json({ success: true, user: null });
  }
  return withRefreshedSession(
    NextResponse.json({ success: true, user: context.user }),
    context
  );
}
