import { test } from "node:test";
import assert from "node:assert/strict";
import { generateEndShiftHtml } from "@/lib/pdf-html-templates";
import type { DailyReport } from "@/types";

function raportZeZdjeciami(): DailyReport {
  return {
    id: "rep-end-1",
    tenantId: "tenant-sb-tech-poznan",
    reportType: "END_SHIFT",
    date: "2026-09-06",
    time: "16:12",
    siteId: "s1",
    siteName: "Nastawnia PKP Poznań - Piątkowo",
    foremanId: "f1",
    foremanName: "Jan Kowalski",
    location: { latitude: 52.4, longitude: 16.9 },
    photoDocumentation: [
      {
        id: "p1",
        photoDataUrl: "data:image/jpeg;base64,AAAA",
        description: "Wykop pod fundament",
        takenAt: "2026-09-06T14:05:00.000Z",
        source: "aparat",
      },
      {
        id: "p2",
        photoDataUrl: "data:image/jpeg;base64,AAAA",
        description: "Zbrojenie z zeszłego tygodnia",
        takenAt: "2026-09-06T14:06:00.000Z",
        source: "galeria",
        capturedAt: "2026-09-01T07:15:00",
      },
      {
        id: "p3",
        photoDataUrl: "data:image/jpeg;base64,AAAA",
        description: "Zrzut ekranu bez metadanych",
        takenAt: "2026-09-06T14:07:00.000Z",
        source: "galeria",
      },
    ],
    pdfFileName: "raport.pdf",
    sentToEmails: [],
    sentAt: "2026-09-06T14:10:00.000Z",
    status: "SENT",
  };
}

/**
 * Dokument musi mówić prawdę o pochodzeniu zdjęcia. Godzina przy fotografii
 * z galerii to godzina DODANIA do raportu, nie wykonania zdjęcia — bez tego
 * rozróżnienia fotorelacja z budowy sugeruje coś, czego nie potwierdza.
 */
test("PDF rozróżnia zdjęcie z aparatu od zdjęcia z galerii", () => {
  const html = generateEndShiftHtml(raportZeZdjeciami(), "");

  assert.match(html, /Zdjęcie 1 &bull; wykonano/, "aparat: bez zmian wobec dotychczasowych raportów");
  assert.ok(!/Zdjęcie 1[\s\S]{0,200}z galerii/.test(html), "aparat nie dostaje adnotacji o galerii");

  assert.match(html, /Zdjęcie 2 &bull; dodano/, "galeria: godzina opisana jako dodanie");
  assert.match(html, /wykonano 1\.09\.2026, 07:15 wg metadanych pliku/);

  assert.match(html, /Zdjęcie 3 &bull; dodano/);
  assert.match(html, /brak daty wykonania w metadanych pliku/);
});

test("adnotacja jest drobnym drukiem, nie równorzędnym opisem", () => {
  const html = generateEndShiftHtml(raportZeZdjeciami(), "");
  // Styl .origin musi istnieć i być mniejszy niż opis zdjęcia (10,5 px).
  const rozmiar = /\.photo-card \.origin \{[^}]*font-size:\s*([\d.]+)px/.exec(html);
  assert.ok(rozmiar, "brak stylu .origin w dokumencie");
  assert.ok(Number(rozmiar[1]) < 10.5, `adnotacja ${rozmiar[1]}px nie jest mniejsza od opisu`);
});
