import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDateTaken, readExifDateTaken } from "@/lib/exif";

/**
 * Buduje najmniejszy sensowny JPEG z segmentem EXIF: SOI, APP1 z blokiem TIFF,
 * w nim IFD0 ze wskaźnikiem na IFD EXIF, a tam jeden tag z datą.
 * Prawdziwych zdjęć nie trzymamy w repozytorium — ważą, a i tak sprawdzałyby
 * dokładnie te same bajty.
 */
function jpegZData(data: string, opcje: { bigEndian?: boolean; tag?: number } = {}): ArrayBuffer {
  const bigEndian = opcje.bigEndian ?? false;
  const tag = opcje.tag ?? 0x9003; // DateTimeOriginal
  const tekst = `${data}\0`;
  const dlugoscTekstu = tekst.length;

  const tiff = new DataView(new ArrayBuffer(44 + dlugoscTekstu));
  const le = !bigEndian;
  tiff.setUint16(0, bigEndian ? 0x4d4d : 0x4949);
  tiff.setUint16(2, 42, le);
  tiff.setUint32(4, 8, le); // IFD0 zaraz za nagłówkiem

  tiff.setUint16(8, 1, le); // jeden wpis w IFD0
  tiff.setUint16(10, 0x8769, le); // wskaźnik na IFD EXIF
  tiff.setUint16(12, 4, le); // typ LONG
  tiff.setUint32(14, 1, le);
  tiff.setUint32(18, 26, le); // adres IFD EXIF względem początku TIFF
  tiff.setUint32(22, 0, le); // brak IFD1

  tiff.setUint16(26, 1, le); // jeden wpis w IFD EXIF
  tiff.setUint16(28, tag, le);
  tiff.setUint16(30, 2, le); // typ ASCII
  tiff.setUint32(32, dlugoscTekstu, le);
  tiff.setUint32(36, 44, le); // adres tekstu
  tiff.setUint32(40, 0, le);
  for (let i = 0; i < dlugoscTekstu; i += 1) tiff.setUint8(44 + i, tekst.charCodeAt(i));

  const tiffBajty = new Uint8Array(tiff.buffer);
  const naglowek = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
  const dlugoscSegmentu = 2 + naglowek.length + tiffBajty.length;

  const plik = new Uint8Array(4 + dlugoscSegmentu + 2);
  plik[0] = 0xff; plik[1] = 0xd8;             // SOI
  plik[2] = 0xff; plik[3] = 0xe1;             // APP1
  plik[4] = (dlugoscSegmentu >> 8) & 0xff;
  plik[5] = dlugoscSegmentu & 0xff;
  plik.set(naglowek, 6);
  plik.set(tiffBajty, 6 + naglowek.length);
  plik[plik.length - 2] = 0xff; plik[plik.length - 1] = 0xda; // SOS

  return plik.buffer;
}

test("data wykonania czyta się z EXIF-u, w obu kolejnościach bajtów", () => {
  // Aparaty Canona zapisują little-endian, Nikony big-endian. Obie muszą działać.
  assert.equal(readExifDateTaken(jpegZData("2026:09:05 14:32:07")), "2026-09-05T14:32:07");
  assert.equal(
    readExifDateTaken(jpegZData("2026:09:05 14:32:07", { bigEndian: true })),
    "2026-09-05T14:32:07"
  );
});

test("gdy brak DateTimeOriginal, wystarczy DateTimeDigitized albo DateTime", () => {
  assert.equal(readExifDateTaken(jpegZData("2025:12:24 08:00:00", { tag: 0x9004 })), "2025-12-24T08:00:00");
  assert.equal(readExifDateTaken(jpegZData("2025:12:24 08:00:00", { tag: 0x0132 })), "2025-12-24T08:00:00");
});

/**
 * Brak daty jest bezpieczny, data zmyślona nie: pod zdjęciem w raporcie
 * z budowy fałszywy termin jest gorszy niż jego brak.
 */
test("plik bez EXIF-u, obcięty albo z bzdurną datą nie zwraca niczego", () => {
  assert.equal(readExifDateTaken(new Uint8Array([0xff, 0xd8, 0xff, 0xda]).buffer), null, "JPEG bez APP1");
  assert.equal(readExifDateTaken(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer), null, "PNG");
  assert.equal(readExifDateTaken(new Uint8Array(0).buffer), null, "pusty plik");
  assert.equal(readExifDateTaken(jpegZData("1970:01:01 00:00:00")), null, "aparat z rozładowaną baterią");
  assert.equal(readExifDateTaken(jpegZData("nie jest to data....")), null, "śmieci w polu");

  const obciety = jpegZData("2026:09:05 14:32:07").slice(0, 20);
  assert.equal(readExifDateTaken(obciety), null, "plik urwany w połowie");
});

test("data pokazywana pod opisem jest w polskim zapisie", () => {
  assert.equal(formatDateTaken("2026-09-05T14:32:07"), "5.09.2026, 14:32");
  assert.equal(formatDateTaken(null), null);
  assert.equal(formatDateTaken("bzdura"), null);
});
