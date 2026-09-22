import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { requireUser, withRefreshedSession } from "@/lib/auth";
import { canViewChange, changeRowToApp, loadChange } from "@/lib/project-change-server";
import { renderChangePdf } from "@/lib/project-change-mail";
import { BrowserLaunchError } from "@/lib/pdf-renderer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PDF karty w AKTUALNYM stanie (treść, decyzje, podpisy). Składany przy każdym
 * pobraniu, bo karta żyje, dopóki nie zbierze kompletu decyzji. Egzemplarz
 * z kompletem decyzji jest dodatkowo archiwizowany w buckecie (pdf_path).
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Brak bazy." }, { status: 503 });
  }

  let changeId = "";
  try {
    const body = await req.json();
    changeId = typeof body?.changeId === "string" ? body.changeId : "";
  } catch {
    changeId = "";
  }

  const loaded = changeId ? await loadChange(supabase, changeId) : null;
  if (!loaded || !canViewChange(auth.context.user, loaded.decisions)) {
    return NextResponse.json({ success: false, message: "Nie ma takiej karty." }, { status: 404 });
  }

  try {
    const pdf = await renderChangePdf(supabase, changeRowToApp(loaded.row, loaded.decisions));
    return withRefreshedSession(
      new NextResponse(new Uint8Array(pdf.buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Length": String(pdf.buffer.length),
          "Content-Disposition": `attachment; filename="${pdf.fileName}"; filename*=UTF-8''${encodeURIComponent(pdf.fileName)}`,
          "Cache-Control": "no-store",
        },
      }),
      auth.context
    );
  } catch (err) {
    console.error(`Karta ${changeId}: PDF:`, err);
    const message =
      err instanceof BrowserLaunchError ? err.message : "Nie udało się złożyć dokumentu PDF.";
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
