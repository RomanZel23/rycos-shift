import fs from "fs/promises";
import path from "path";
import { getSupabaseClient } from "./supabase";
import { BUCKET_NAME, storagePathFromRef } from "./storage-paths";
import type { DailyReport } from "@/types";

/**
 * Etap 3 — przygotowanie obrazów do renderowania PDF na serwerze.
 *
 * Chromium renderujący dokument ma wyłączony JavaScript i zablokowaną sieć
 * (patrz pdf-renderer.ts), więc nie pobierze niczego z bucketu ani spod
 * /api/files. Wszystkie obrazy muszą trafić do HTML-a jako data URL.
 * To celowe: render nie zależy od dostępności bucketu, nie potrzebuje
 * ciasteczka sesji i nie da się z niego zrobić narzędzia do odpytywania
 * zasobów wewnętrznych.
 */

let logoCache: string | null | undefined;

/** Logo z katalogu public/, wczytywane raz na proces. */
export async function loadLogoDataUrl(): Promise<string | undefined> {
  if (logoCache !== undefined) return logoCache ?? undefined;
  try {
    const file = await fs.readFile(path.join(process.cwd(), "public", "idream-logo.png"));
    logoCache = `data:image/png;base64,${file.toString("base64")}`;
  } catch {
    logoCache = null;
  }
  return logoCache ?? undefined;
}

function contentTypeFor(storagePath: string): string {
  const ext = storagePath.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

/**
 * Zamienia odwołania do plików (ścieżki w buckecie albo /api/files) na data URL.
 * Wartości, które już są data URL, zostają bez zmian. Czego nie da się pobrać,
 * zostaje puste — dokument wyrenderuje się z pustą ramką zamiast paść.
 */
export async function mediaAsDataUrls(report: DailyReport): Promise<DailyReport> {
  const supabase = getSupabaseClient();

  const resolve = async (ref?: string): Promise<string> => {
    if (!ref) return "";
    if (ref.startsWith("data:")) return ref;

    const storagePath = storagePathFromRef(ref);
    if (!storagePath || !supabase) return "";

    const { data } = await supabase.storage.from(BUCKET_NAME).download(storagePath);
    if (!data) return "";
    const bytes = Buffer.from(await data.arrayBuffer());
    return `data:${contentTypeFor(storagePath)};base64,${bytes.toString("base64")}`;
  };

  const attendanceList = await Promise.all(
    (report.attendanceList || []).map(async (a) => ({
      ...a,
      signatureDataUrl: await resolve(a.signatureDataUrl),
    }))
  );

  const photoDocumentation = await Promise.all(
    (report.photoDocumentation || []).map(async (p) => ({
      ...p,
      photoDataUrl: await resolve(p.photoDataUrl),
    }))
  );

  return { ...report, attendanceList, photoDocumentation };
}

/**
 * Kroje Exo 2 wstawiane wprost do dokumentu jako data URL.
 *
 * Dlaczego nie polegamy na krojach systemowych: fontconfig dopasowuje rodziny
 * po nazwie, a odmiany cięższe niż Bold zgłaszają się jako OSOBNE rodziny
 * („Exo 2 ExtraBold"), więc `font-weight: 800` w CSS cicho spadało do Bold.
 * Wpisanie plików do dokumentu daje pewność, że grubość na wydruku jest ta,
 * o którą prosi szablon, niezależnie od konfiguracji czcionek w obrazie.
 *
 * Wczytujemy tylko te grubości, których faktycznie używają szablony,
 * i trzymamy je w pamięci procesu — plik czytany jest raz.
 */
const GRUBOSCI_PDF: Array<[nazwa: string, waga: number]> = [
  ["Regular", 400],
  ["SemiBold", 600],
  ["Bold", 700],
  ["ExtraBold", 800],
];

let fontCssCache: string | null | undefined;

export async function loadExoFontFaceCss(): Promise<string> {
  if (fontCssCache !== undefined) return fontCssCache ?? "";
  try {
    const bloki = await Promise.all(
      GRUBOSCI_PDF.map(async ([nazwa, waga]) => {
        const plik = await fs.readFile(
          path.join(process.cwd(), "public", "fonts", `Exo2-${nazwa}.ttf`)
        );
        return `@font-face{font-family:'Exo 2';font-style:normal;font-weight:${waga};` +
          `src:url(data:font/ttf;base64,${plik.toString("base64")}) format('truetype');}`;
      })
    );
    fontCssCache = bloki.join("\n");
  } catch (err) {
    // Bez kroju dokument wyjdzie w Liberation Sans — brzydziej, ale wyjdzie.
    console.warn("Nie udało się wczytać krojów Exo 2 do PDF:", err);
    fontCssCache = null;
  }
  return fontCssCache ?? "";
}
