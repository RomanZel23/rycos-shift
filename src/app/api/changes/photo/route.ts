import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/supabase";
import { requireUser, forbidden, withRefreshedSession } from "@/lib/auth";
import {
  CHANGE_PHOTO_MAX_BYTES,
  canInitiateChanges,
  changePhotoPath,
  type ChangeSectionKey,
} from "@/lib/project-change";
import { CHANGES_TABLE, decodeImageDataUrl, uploadToBucket } from "@/lib/project-change-server";
import { isAllowedStoragePath } from "@/lib/storage-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Wgranie JEDNEGO zdjęcia karty zmiany.
 *
 * Karta może mieć dowolnie wiele zdjęć, więc nie wysyłamy ich hurtem w jednym
 * żądaniu (tak robią raporty dzienne) — kilkadziesiąt zdjęć w base64 to
 * kilkadziesiąt MB w jednym POST-cie przy zasięgu z placu budowy. Każde
 * zdjęcie idzie osobno zaraz po zrobieniu, a karta niesie już tylko ścieżki.
 *
 * Ścieżka jest deterministyczna (karta + sekcja + id zdjęcia), więc ponowienie
 * po zerwanym połączeniu nadpisuje ten sam plik zamiast tworzyć duplikat.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser(req);
  if ("response" in auth) return auth.response;
  if (!canInitiateChanges(auth.context.user)) return forbidden();

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ success: false, message: "Brak bazy." }, { status: 503 });
  }

  let body: { changeId?: unknown; section?: unknown; photoId?: unknown; dataUrl?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "Nieprawidłowe żądanie." }, { status: 400 });
  }

  const changeId = typeof body.changeId === "string" ? body.changeId.trim() : "";
  const photoId = typeof body.photoId === "string" ? body.photoId.trim() : "";
  const section: ChangeSectionKey | null =
    body.section === "jest" || body.section === "powinno" ? body.section : null;
  if (!changeId || !photoId || !section) {
    return NextResponse.json({ success: false, message: "Brak danych zdjęcia." }, { status: 400 });
  }

  // Do zablokowanej karty (po pierwszej akceptacji) nie da się już nic dołożyć.
  const { data: existing } = await supabase
    .from(CHANGES_TABLE)
    .select("author_id, locked_at")
    .eq("id", changeId)
    .maybeSingle();
  if (existing && (existing.author_id !== auth.context.user.id || existing.locked_at)) {
    return NextResponse.json(
      { success: false, message: "Tej karty nie można już zmieniać." },
      { status: 409 }
    );
  }

  const decoded = decodeImageDataUrl(body.dataUrl, ["image/jpeg", "image/png", "image/webp"], CHANGE_PHOTO_MAX_BYTES);
  if ("error" in decoded) {
    return NextResponse.json({ success: false, message: decoded.error }, { status: 400 });
  }

  const path = changePhotoPath(changeId, section, photoId);
  if (!isAllowedStoragePath(path)) {
    return NextResponse.json({ success: false, message: "Nieprawidłowa ścieżka." }, { status: 400 });
  }

  const uploadError = await uploadToBucket(supabase, path, decoded.bytes, decoded.contentType);
  if (uploadError) {
    return NextResponse.json(
      { success: false, message: `Nie udało się zapisać zdjęcia: ${uploadError}` },
      { status: 500 }
    );
  }

  return withRefreshedSession(NextResponse.json({ success: true, path }), auth.context);
}
