import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { APP_VERSION } from "@/lib/version";

const czytaj = (sciezka: string): string =>
  readFileSync(new URL(`../${sciezka}`, import.meta.url), "utf8");

test("poza buildem Next wersja ma wartość zastępczą", () => {
  // W `node --test` nie ma podstawienia zmiennych z next.config.ts.
  assert.equal(APP_VERSION, "dev");
});

test("package.json trzyma wersję w formacie semver", () => {
  const pkg = JSON.parse(czytaj("package.json")) as { version?: string };
  assert.match(pkg.version ?? "", /^\d+\.\d+\.\d+$/);
});

test("next.config.ts wystawia wersję z package.json do bundla klienta", () => {
  const cfg = czytaj("next.config.ts");
  assert.match(cfg, /NEXT_PUBLIC_APP_VERSION/);
  assert.match(cfg, /package\.json/);
});

/**
 * Regresja z uwagi klienta #016: stopka portalu pokazywała „Wersja 1.3
 * (Supabase Cloud Sync)", podczas gdy package.json miał już 1.6.0. Numer był
 * wpisany w komponencie na sztywno, więc rozjeżdżał się przy każdym wydaniu,
 * a nazwa kodowa etapu została w produkcji na stałe.
 */
test("stopka portalu nie ma wpisanego na sztywno numeru wersji", () => {
  const strona = czytaj("src/app/page.tsx");
  assert.ok(strona.includes("Wersja {APP_VERSION}"), "stopka bierze numer ze stałej");
  assert.doesNotMatch(strona, /Wersja\s+\d/, "numer wersji wpisany na sztywno");
});
