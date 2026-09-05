import { NextRequest, NextResponse } from "next/server";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { requireAdmin, withRefreshedSession } from "@/lib/auth";
import { REPORTS_TABLE } from "@/lib/report-mapper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Etap 4 — usunięcie raportu z archiwum. Wyłącznie dla administratora.
 *
 * Kasujemy WIERSZ W BAZIE, a pliki (PDF, zdjęcia, podpisy) zostają w buckecie.
 * Tak ustalone: usunięć ma być znikoma liczba, a osierocony plik jest tańszy
 * niż bezpowrotnie skasowany protokół z podpisami, gdyby ktoś kliknął nie ten
 * wiersz. Ścieżki plików zostają w logu poniżej, więc dokument da się odnaleźć
 * w buckecie także po usunięciu wiersza.
 *
 * Kasowanie musi iść przez serwer, a nie z konsoli Supabase, bo urządzenia
 * trzymają lokalną kopię archiwum. Wiersz usunięty w bazie, którego telefon
 * nie ma oznaczonego jako zsynchronizowany, zostałby przy najbliższym
 * odświeżeniu wysłany z powrotem — to była „zmartwychwstająca" czwórka
 * raportów. Blokuje to znacznik cloudSyncedAt (patrz src/app/page.tsx),
 * ale tylko dla raportów, które wcześniej potwierdziły zapis w chmurze.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if ("response" in auth) return auth.response;

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, message: "Baza danych nie jest skonfigurowana." },
      { status: 503 }
    );
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { success: false, message: "Baza danych nie jest skonfigurowana." },
      { status: 503 }
    );
  }

  let reportId: string | undefined;
  try {
    const body = await req.json();
    reportId = typeof body?.reportId === "string" ? body.reportId.trim() : undefined;
  } catch {
    return NextResponse.json(
      { success: false, message: "Nieprawidłowy format żądania." },
      { status: 400 }
    );
  }

  if (!reportId) {
    return NextResponse.json(
      { success: false, message: "Brak identyfikatora raportu." },
      { status: 400 }
    );
  }

  // Odczyt przed usunięciem — chcemy wiedzieć, CO zniknęło, i mieć to w logu.
  const { data: row, error: readError } = await supabase
    .from(REPORTS_TABLE)
    .select("id, report_type, report_date, report_time, site_name, pdf_file_name, pdf_path")
    .eq("id", reportId)
    .maybeSingle();

  if (readError) {
    return NextResponse.json(
      { success: false, message: `Nie udało się odczytać raportu: ${readError.message}` },
      { status: 500 }
    );
  }
  if (!row) {
    // Nie ma go w bazie — z punktu widzenia archiwum cel osiągnięty. Klient ma
    // usunąć swoją kopię lokalną, żeby wpis nie wisiał na liście w nieskończoność.
    return withRefreshedSession(
      NextResponse.json({
        success: true,
        alreadyGone: true,
        message: "Tego raportu nie ma już w bazie.",
      }),
      auth.context
    );
  }

  const { error: deleteError } = await supabase
    .from(REPORTS_TABLE)
    .delete()
    .eq("id", reportId);

  if (deleteError) {
    return NextResponse.json(
      { success: false, message: `Nie udało się usunąć raportu: ${deleteError.message}` },
      { status: 500 }
    );
  }

  // Ślad w logach kontenera: kto, co i kiedy. To dokumentacja z podpisami,
  // więc usunięcie nie powinno być zdarzeniem bez autora.
  console.warn(
    `[ARCHIWUM] Raport usunięty przez ${auth.context.user.id} ` +
      `(${auth.context.user.firstName} ${auth.context.user.lastName}): ` +
      `id=${row.id} typ=${row.report_type} data=${row.report_date} ${String(row.report_time || "").slice(0, 5)} ` +
      `plac="${row.site_name}" plik="${row.pdf_file_name}" sciezka="${row.pdf_path || "-"}" ` +
      `(pliki w buckecie zostają)`
  );

  return withRefreshedSession(
    NextResponse.json({
      success: true,
      message: "Raport usunięty z archiwum. Plik PDF pozostał w magazynie.",
      removedId: row.id,
    }),
    auth.context
  );
}
