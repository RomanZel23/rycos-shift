import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { BUCKET_NAME, isAllowedStoragePath } from "@/lib/storage-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Etap 0 — serwowanie plików z prywatnego bucketu rycos-reports.
 *
 * Po zamknięciu bucketu publiczne URL-e CDN przestają działać. Ten endpoint
 * pobiera obiekt po stronie serwera (service_role) i oddaje go pod adresem
 * same-origin, dzięki czemu:
 *   - dostęp chroni bramka z proxy.ts (Etap 1 zastąpi ją sesją użytkownika),
 *   - html2canvas nie ma problemu z CORS przy regeneracji PDF,
 *   - w bazie nie trzymamy adresów działających dla całego internetu.
 */
export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get("path") || "";

  if (!isAllowedStoragePath(path)) {
    return NextResponse.json(
      { success: false, message: "Nieprawidłowa ścieżka pliku" },
      { status: 400 }
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, message: "Supabase nie jest skonfigurowany" },
      { status: 503 }
    );
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, message: "Supabase nie jest skonfigurowany" },
      { status: 503 }
    );
  }

  const { data, error } = await supabase.storage.from(BUCKET_NAME).download(path);

  if (error || !data) {
    return NextResponse.json(
      { success: false, message: error?.message || "Nie znaleziono pliku" },
      { status: 404 }
    );
  }

  const buffer = Buffer.from(await data.arrayBuffer());
  const contentType = data.type || guessContentType(path);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(buffer.byteLength),
      "Content-Disposition": `inline; filename="${path.split("/").pop()}"`,
      // Prywatny cache przeglądarki — pliki raportu nie zmieniają się w czasie.
      "Cache-Control": "private, max-age=3600",
    },
  });
}

function guessContentType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    default:
      return "application/octet-stream";
  }
}
