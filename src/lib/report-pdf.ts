import { getSupabaseClient } from "./supabase";
import { BUCKET_NAME } from "./storage-paths";
import { REPORTS_TABLE, rowToDailyReport } from "./report-mapper";
import type { ReportRow } from "./report-mapper";
import { generateEndShiftHtml, generateStartShiftHtml } from "./pdf-html-templates";
import { renderHtmlToPdf, BrowserLaunchError } from "./pdf-renderer";
import { loadExoFontFaceCss, loadLogoDataUrl, mediaAsDataUrls } from "./pdf-assets";
import { sanitizePdfFileName, slugifyForFileName } from "./pdf-generator";

/**
 * Zdobycie pliku PDF raportu z archiwum — z bucketu, a gdy go tam nie ma,
 * przez wygenerowanie z zapisanych danych.
 *
 * Powód powstania (zgłoszenie z 8 września 2026): raport złożony na iPadzie
 * przy słabym zasięgu idzie ścieżką awaryjną. /api/reports — jedyne miejsce,
 * które renderuje dokument — nie odpowiedziało, więc raport wylądował
 * w kolejce offline i został dosłany przez /api/db/sync. Ta ścieżka zapisuje
 * dane, ale PDF-a nie tworzy, bo nie ma go z czego wziąć. W efekcie w archiwum
 * stał raport z podpisami, którego nie dało się ani wysłać, ani pobrać,
 * a komunikat radził „wygeneruj go ponownie z formularza" — czyli zwołaj
 * jeszcze raz odprawę i zbierz podpisy od nowa. Bez sensu.
 *
 * Dokument tworzony po fakcie powstaje wyłącznie z tego, co leży w bazie:
 * z tematami, listą obecności, podpisami i ich godzinami oraz datą złożenia
 * raportu. Nie ma w nim niczego z chwili generowania — pod względem treści
 * jest tym samym dokumentem, który poszedłby mailem od razu, gdyby zasięg
 * dopisał. Po pierwszym wygenerowaniu plik ląduje w buckecie i od tej pory
 * pobiera się już archiwalny egzemplarz, a nie kolejny nowy.
 */

export type WynikPdf =
  | {
      ok: true;
      buffer: Buffer;
      /** Ścieżka w buckecie; pusta tylko wtedy, gdy zapis pliku się nie udał. */
      path: string;
      fileName: string;
      /** Wiersz z bazy — wołający potrzebuje go i tak do nagłówka wiadomości. */
      row: ReportRow;
      /** Czy dokument powstał przed chwilą, czy był już w archiwum. */
      wygenerowanyTeraz: boolean;
    }
  | { ok: false; status: number; message: string };

function nazwaPliku(row: ReportRow): string {
  if (row.pdf_file_name) return row.pdf_file_name;
  const czynnosc =
    row.report_type === "START_SHIFT" ? "Rozpoczecie_prac_zespolu" : "Zakonczenie_prac_zespolu";
  return sanitizePdfFileName(
    `${row.report_date}_${czynnosc}_${slugifyForFileName(row.site_name, "plac")}`
  );
}

function sciezkaWBuckecie(row: ReportRow): string {
  const dateStr = String(row.report_date || "").replace(/[^0-9-]/g, "");
  const siteSlug = slugifyForFileName(row.site_name, "plac");
  return `pdf/${dateStr}_${row.report_type}_${siteSlug}_${row.id}.pdf`;
}

export async function ensureReportPdf(reportId: string): Promise<WynikPdf> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, status: 503, message: "Baza danych nie jest skonfigurowana." };
  }

  const { data: row } = await supabase
    .from(REPORTS_TABLE)
    .select("*")
    .eq("id", reportId)
    .maybeSingle<ReportRow>();

  if (!row) {
    return { ok: false, status: 404, message: "Nie znaleziono raportu w archiwum." };
  }

  const fileName = nazwaPliku(row);

  // 1. Plik już zarchiwizowany — oddajemy dokładnie ten egzemplarz.
  if (row.pdf_path) {
    const { data: file, error } = await supabase.storage.from(BUCKET_NAME).download(row.pdf_path);
    if (error || !file) {
      return {
        ok: false,
        status: 500,
        message: `Nie udało się pobrać pliku PDF z archiwum: ${error?.message || "brak pliku"}`,
      };
    }
    return {
      ok: true,
      buffer: Buffer.from(await file.arrayBuffer()),
      path: row.pdf_path,
      fileName,
      row,
      wygenerowanyTeraz: false,
    };
  }

  // 2. Najstarsze raporty trzymają cały plik w kolumnie. Wysyłamy go, a przy
  // okazji przenosimy do bucketu, żeby wiersz przestał ważyć kilka megabajtów.
  if (typeof row.legacy_pdf_base64 === "string" && row.legacy_pdf_base64.startsWith("data:")) {
    const base64 = row.legacy_pdf_base64.split("base64,")[1] || "";
    const buffer = Buffer.from(base64, "base64");
    if (buffer.length > 0) {
      const path = sciezkaWBuckecie(row);
      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, new Uint8Array(buffer), { contentType: "application/pdf", upsert: true });

      // Kolumna z base64 to jedyny egzemplarz, więc kasujemy ją dopiero po
      // odczytaniu wgranego pliku z powrotem i porównaniu długości. Gdyby coś
      // poszło nie tak, wiersz zostaje nietknięty i raport dalej działa.
      if (!error) {
        const { data: kontrola } = await supabase.storage.from(BUCKET_NAME).download(path);
        if (kontrola && (await kontrola.arrayBuffer()).byteLength === buffer.length) {
          await supabase
            .from(REPORTS_TABLE)
            .update({ pdf_path: path, legacy_pdf_base64: null, pdf_file_name: fileName })
            .eq("id", row.id);
          return { ok: true, buffer, path, fileName, row, wygenerowanyTeraz: false };
        }
        console.warn(`Pomijam migrację PDF ${row.id}: rozmiar w buckecie nie zgadza się z kolumną.`);
      }
      return { ok: true, buffer, path: "", fileName, row, wygenerowanyTeraz: false };
    }
  }

  // 3. Raport bez dokumentu — dosłany z kolejki offline. Składamy go teraz.
  const report = rowToDailyReport(row);
  let buffer: Buffer;
  try {
    const [doRenderu, logoDataUrl, fontCss] = await Promise.all([
      mediaAsDataUrls(report),
      loadLogoDataUrl(),
      loadExoFontFaceCss(),
    ]);
    const html =
      report.reportType === "START_SHIFT"
        ? generateStartShiftHtml(doRenderu, fontCss)
        : generateEndShiftHtml(doRenderu, fontCss);

    buffer = await renderHtmlToPdf(html, {
      documentName: `${
        report.reportType === "START_SHIFT" ? "Rozpoczęcie prac" : "Zakończenie prac"
      } — ${report.siteName} — ${report.date}`,
      logoDataUrl,
    });
  } catch (err) {
    console.error(`Nie udało się złożyć PDF dla raportu ${row.id}:`, err);
    if (err instanceof BrowserLaunchError) {
      return { ok: false, status: 503, message: err.message };
    }
    return {
      ok: false,
      status: 500,
      message: "Nie udało się złożyć dokumentu PDF z danych raportu.",
    };
  }

  const path = sciezkaWBuckecie(row);
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, new Uint8Array(buffer), { contentType: "application/pdf", upsert: true });

  if (uploadError) {
    // Dokument jest gotowy — oddajemy go, nawet jeśli archiwizacja nie wyszła.
    // Kolejne wejście spróbuje jeszcze raz; gorzej byłoby zablokować wysyłkę.
    console.error(`Nie udało się zapisać PDF ${path}:`, uploadError.message);
    return { ok: true, buffer, path: "", fileName, row, wygenerowanyTeraz: true };
  }

  await supabase
    .from(REPORTS_TABLE)
    .update({ pdf_path: path, pdf_file_name: fileName })
    .eq("id", row.id);

  return { ok: true, buffer, path, fileName, row, wygenerowanyTeraz: true };
}
