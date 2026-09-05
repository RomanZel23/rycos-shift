import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * WYCOFANY w Etapie 2.
 *
 * Ten endpoint przyjmował listę odbiorców i klucz Resend z ciała żądania, przez
 * co pozwalał wysłać dowolny załącznik na dowolny adres z firmowej domeny.
 * Zastąpiły go:
 *   POST /api/reports        — zapis i wysyłka nowego raportu (multipart),
 *   POST /api/reports/resend — ponowna wysyłka archiwalnego raportu po id.
 *
 * Plik zostaje jako jawna odpowiedź 410 dla starych, zbuforowanych klientów PWA,
 * żeby nie dostawały mylącego 404. Można go usunąć, gdy wszystkie urządzenia
 * odświeżą aplikację.
 */
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      code: "ENDPOINT_REMOVED",
      message:
        "Ten sposób wysyłki został wycofany. Odśwież aplikację (wyczyść pamięć podręczną), aby pobrać aktualną wersję.",
    },
    { status: 410 }
  );
}
