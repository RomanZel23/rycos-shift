import { getSupabaseClient } from "./supabase";
import { DailyReport, AttendanceRecord, PhotoDocumentationItem } from "@/types";
import { BUCKET_NAME, toAppFileUrl } from "./storage-paths";

export { BUCKET_NAME };

/**
 * Konwertuje string Base64 Data URL na Buffer / Uint8Array
 */
function base64ToUint8Array(base64Data: string): { data: Uint8Array; contentType: string } {
  let cleanBase64 = base64Data;
  let contentType = "application/octet-stream";

  if (base64Data.startsWith("data:")) {
    const parts = base64Data.split(",");
    const match = parts[0].match(/:(.*?);/);
    if (match) {
      contentType = match[1];
    }
    cleanBase64 = parts[1] || "";
  }

  // W środowisku Node.js (serwer)
  if (typeof Buffer !== "undefined") {
    const buffer = Buffer.from(cleanBase64, "base64");
    return { data: new Uint8Array(buffer), contentType };
  }

  // W środowisku przeglądarki (klient)
  const binaryString = atob(cleanBase64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return { data: bytes, contentType };
}

/**
 * Wysyła plik Base64 (zdjęcie, podpis, PDF) do prywatnego bucketu Supabase Storage.
 * Zwraca adres same-origin /api/files?path=... — bucket od Etapu 0 nie jest publiczny,
 * więc pliki serwuje aplikacja, za bramką dostępu.
 */
export async function uploadBase64ToStorage(
  base64Data: string,
  filePath: string,
  forcedContentType?: string
): Promise<string | null> {
  try {
    // Cokolwiek, co nie jest data URL-em, jest już odwołaniem do pliku — nie wysyłaj ponownie
    if (!base64Data.startsWith("data:")) {
      return base64Data;
    }

    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data: binaryData, contentType: detectedType } = base64ToUint8Array(base64Data);
    const contentType = forcedContentType || detectedType;

    const { error } = await supabase.storage.from(BUCKET_NAME).upload(filePath, binaryData, {
      contentType,
      upsert: true,
    });

    if (error) {
      console.warn(`Supabase Storage upload error for ${filePath}:`, error.message);
      return null;
    }

    return toAppFileUrl(filePath);
  } catch (err) {
    console.warn(`Supabase Storage upload exception for ${filePath}:`, err);
    return null;
  }
}

/**
 * Optymalizuje cały obiekt raportu:
 * - Wrzuca plik PDF do bucketu (folder `pdf/`)
 * - Wrzuca zdjęcia fotorelacji do bucketu (folder `photos/`)
 * - Wrzuca podpisy pracowników do bucketu (folder `signatures/`)
 * - Zwraca raport z lekkimi adresami /api/files?path=... zamiast gigantycznych ciągów Base64.
 */
export async function optimizeReportForStorage(report: DailyReport): Promise<DailyReport> {
  const optimized: DailyReport = { ...report };
  const dateStr = (report.date || new Date().toISOString().split("T")[0]).replace(/[^0-9-]/g, "");
  const siteSlug = (report.siteName || "plac").replace(/[^a-zA-Z0-9_-]/g, "_");

  // 1. Upload PDF
  if (optimized.pdfDataUrl && optimized.pdfDataUrl.startsWith("data:")) {
    const pdfPath = `pdf/${dateStr}_${optimized.reportType}_${siteSlug}_${optimized.id}.pdf`;
    const pdfUrl = await uploadBase64ToStorage(optimized.pdfDataUrl, pdfPath, "application/pdf");
    if (pdfUrl) {
      optimized.pdfDataUrl = pdfUrl;
    }
  }

  // 2. Upload podpisów na liście obecności
  if (optimized.attendanceList && optimized.attendanceList.length > 0) {
    const updatedAttendance: AttendanceRecord[] = await Promise.all(
      optimized.attendanceList.map(async (att, idx) => {
        if (att.signatureDataUrl && att.signatureDataUrl.startsWith("data:")) {
          const sigPath = `signatures/${dateStr}_${att.userId}_${idx}.png`;
          const sigUrl = await uploadBase64ToStorage(att.signatureDataUrl, sigPath, "image/png");
          return {
            ...att,
            signatureDataUrl: sigUrl || att.signatureDataUrl,
          };
        }
        return att;
      })
    );
    optimized.attendanceList = updatedAttendance;
  }

  // 3. Upload zdjęć z fotorelacji
  if (optimized.photoDocumentation && optimized.photoDocumentation.length > 0) {
    const updatedPhotos: PhotoDocumentationItem[] = await Promise.all(
      optimized.photoDocumentation.map(async (photo, idx) => {
        if (photo.photoDataUrl && photo.photoDataUrl.startsWith("data:")) {
          const photoPath = `photos/${dateStr}_${optimized.id}_photo_${idx + 1}.jpg`;
          const photoUrl = await uploadBase64ToStorage(photo.photoDataUrl, photoPath, "image/jpeg");
          return {
            ...photo,
            photoDataUrl: photoUrl || photo.photoDataUrl,
          };
        }
        return photo;
      })
    );
    optimized.photoDocumentation = updatedPhotos;
  }

  return optimized;
}
