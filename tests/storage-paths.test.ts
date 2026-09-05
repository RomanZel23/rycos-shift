import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUCKET_NAME,
  isAllowedStoragePath,
  storagePathFromRef,
  pathFromAppFileUrl,
  normalizeStoredFileRef,
  toAppFileUrl,
} from "@/lib/storage-paths";

/**
 * Regresja z Etapu 2b: endpoint ponownej wysyłki nie znajdował PDF-a żadnego
 * istniejącego raportu, bo obsługiwał wyłącznie formę /api/files?path=, a baza
 * trzymała publiczne adresy CDN i base64.
 */

const CDN = `https://xyz.supabase.co/storage/v1/object/public/${BUCKET_NAME}/`;
const SIGNED = `https://xyz.supabase.co/storage/v1/object/sign/${BUCKET_NAME}/`;

test("goła ścieżka w buckecie przechodzi bez zmian", () => {
  assert.equal(storagePathFromRef("pdf/20260903_END_SHIFT.pdf"), "pdf/20260903_END_SHIFT.pdf");
  assert.equal(storagePathFromRef("photos/abc-1.jpg"), "photos/abc-1.jpg");
  assert.equal(storagePathFromRef("signatures/att-9.png"), "signatures/att-9.png");
});

test("publiczny adres CDN zostaje sprowadzony do ścieżki", () => {
  assert.equal(storagePathFromRef(`${CDN}pdf/raport.pdf`), "pdf/raport.pdf");
});

test("podpisany adres z parametrami gubi query", () => {
  assert.equal(storagePathFromRef(`${SIGNED}photos/x.jpg?token=abc.def`), "photos/x.jpg");
});

test("adres /api/files jest rozpakowywany", () => {
  assert.equal(storagePathFromRef("/api/files?path=pdf%2Fraport.pdf"), "pdf/raport.pdf");
  assert.equal(pathFromAppFileUrl("/api/files?path=pdf%2Fraport.pdf"), "pdf/raport.pdf");
});

test("data URL nie ma ścieżki w buckecie", () => {
  assert.equal(storagePathFromRef("data:application/pdf;base64,JVBERi0="), null);
});

test("puste i nieprawidłowe wartości dają null", () => {
  for (const value of ["", null, undefined, "   ", "https://obcy.pl/plik.pdf"]) {
    assert.equal(storagePathFromRef(value as string | null), null, String(value));
  }
});

test("wyjście poza dozwolone katalogi jest odrzucane", () => {
  assert.equal(isAllowedStoragePath("pdf/../../etc/passwd"), false);
  assert.equal(isAllowedStoragePath("../pdf/raport.pdf"), false);
  assert.equal(isAllowedStoragePath("pdf//raport.pdf"), false);
  assert.equal(isAllowedStoragePath("secrets/klucz.txt"), false);
  assert.equal(isAllowedStoragePath("pdf/raport.pdf"), true);
  assert.equal(storagePathFromRef(`${CDN}../../secrets/klucz.txt`), null);
});

test("nazwa pliku ze spacją lub polskim znakiem nie jest ścieżką w buckecie", () => {
  assert.equal(isAllowedStoragePath("pdf/raport końcowy.pdf"), false);
});

test("toAppFileUrl i pathFromAppFileUrl są wzajemnie odwrotne", () => {
  const path = "pdf/20260903_END_SHIFT_Poznan.pdf";
  assert.equal(pathFromAppFileUrl(toAppFileUrl(path)), path);
});

test("normalizeStoredFileRef zostawia data URL i adresy aplikacji", () => {
  assert.equal(normalizeStoredFileRef("data:image/png;base64,iVBOR"), "data:image/png;base64,iVBOR");
  assert.equal(normalizeStoredFileRef("/api/files?path=pdf%2Fa.pdf"), "/api/files?path=pdf%2Fa.pdf");
  assert.equal(normalizeStoredFileRef(`${CDN}pdf/a.pdf`), "/api/files?path=pdf%2Fa.pdf");
  assert.equal(normalizeStoredFileRef(null), null);
  assert.equal(normalizeStoredFileRef(undefined), undefined);
});
