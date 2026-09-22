"use client";

import { readExifDateTaken } from "./exif";

/**
 * Kompresja zdjęcia na urządzeniu: 1024 px szerokości, JPEG 0,7 — te same
 * parametry co w fotorelacji zakończenia prac. Datę wykonania z EXIF czytamy
 * z ORYGINAŁU i tylko dla zdjęć z galerii (przerysowanie na canvasie kasuje
 * metadane, a zdjęcie z aparatu powstało przed chwilą).
 */
export async function compressImageFile(
  file: File,
  source: "aparat" | "galeria"
): Promise<{ dataUrl: string; capturedAt: string | null }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("To nie jest plik ze zdjęciem. Wybierz obraz.");
  }

  let capturedAt: string | null = null;
  if (source === "galeria") {
    try {
      capturedAt = readExifDateTaken(await file.arrayBuffer());
    } catch {
      capturedAt = null;
    }
  }

  const original = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Nie udało się odczytać pliku. Spróbuj ponownie."));
    reader.onload = (e) => resolve(String(e.target?.result || ""));
    reader.readAsDataURL(file);
  });

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onerror = () =>
      reject(
        new Error(
          "Nie udało się otworzyć tego zdjęcia. Jeśli pochodzi z galerii, spróbuj zrobić je aparatem."
        )
      );
    img.onload = () => {
      const MAX_WIDTH = 1024;
      let width = img.width;
      let height = img.height;
      if (width > MAX_WIDTH) {
        height = Math.round((height * MAX_WIDTH) / width);
        width = MAX_WIDTH;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Przeglądarka nie obsługuje przetwarzania zdjęć."));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.src = original;
  });

  return { dataUrl, capturedAt };
}
