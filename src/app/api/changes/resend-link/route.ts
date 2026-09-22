import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { forbidden, requireUser, withRefreshedSession } from "@/lib/auth";
import { changeRowToApp, loadChange, reloadChangeApp } from "@/lib/project-change-server";
import { issueInvitation } from "@/lib/project-change-mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ponowne wysłanie imiennego linku akceptującemu, który jeszcze nie
 * zdecydował (mail nie doszedł, link wygasł). Stary link przestaje działać.
 * Może autor karty albo administrator.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Brak bazy." }, { status: 503 });
  }

  let changeId = "";
  let acceptorId = "";
  try {
    const body = await req.json();
    changeId = typeof body?.changeId === "string" ? body.changeId : "";
    acceptorId = typeof body?.acceptorId === "string" ? body.acceptorId : "";
  } catch {
    /* obsłużone niżej */
  }

  const loaded = changeId ? await loadChange(supabase, changeId) : null;
  if (!loaded) {
    return NextResponse.json({ success: false, message: "Nie ma takiej karty." }, { status: 404 });
  }
  if (loaded.row.author_id !== auth.context.user.id && !auth.context.user.isAdmin) {
    return forbidden("Link może wysłać ponownie autor karty albo administrator.");
  }

  const row = loaded.decisions.find(
    (d) => d.version === loaded.row.version && d.acceptor_id === acceptorId
  );
  if (!row || row.decision !== "PENDING") {
    return NextResponse.json(
      { success: false, message: "Ta osoba nie czeka na decyzję w bieżącej wersji karty." },
      { status: 409 }
    );
  }

  const outcome = await issueInvitation(
    supabase,
    changeRowToApp(loaded.row, loaded.decisions),
    row,
    null
  );
  const change = await reloadChangeApp(supabase, changeId);
  return withRefreshedSession(
    NextResponse.json({ success: outcome.ok, message: outcome.message, change }),
    auth.context
  );
}
