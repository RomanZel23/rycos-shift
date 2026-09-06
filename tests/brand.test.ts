import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COMPANY,
  companyContactLine,
  companyRegistryLine,
  fullLogoSvg,
  markSvg,
  BRAND,
} from "@/lib/brand";

/**
 * Stopka dokumentów niesie dane rejestrowe firmy. Literówka w NIP-ie albo KRS-ie
 * rozejdzie się mailem po wszystkich raportach, zanim ktokolwiek zauważy, więc
 * te trzy linie porównujemy znak w znak z papierem firmowym
 * (docs/logo/company_layout.pdf).
 */

test("stopka zgadza się z papierem firmowym co do znaku", () => {
  assert.equal(
    COMPANY.legalName,
    "iDream Business Center spółka z ograniczoną odpowiedzialnością"
  );
  assert.equal(
    companyRegistryLine(),
    "Kielce, 25-639, ul. Malików 150d, NIP: 9591971466, KRS: 0000612724, REGON: 364221354"
  );
  assert.equal(
    companyContactLine(),
    "tel. +48 41 308 00 05, e-mail: info@solutionsbay.pl, www.solutionsbay.pl"
  );
});

test("numery rejestrowe mają właściwą długość", () => {
  assert.match(COMPANY.nip, /^\d{10}$/);
  assert.match(COMPANY.krs, /^\d{10}$/);
  assert.match(COMPANY.regon, /^\d{9}$/);
});

test("sygnet to poprawny SVG w kolorach z pliku logo", () => {
  const svg = markSvg("light");
  assert.match(svg, /^<svg /);
  assert.match(svg, /<\/svg>$/);
  assert.ok(svg.includes(BRAND.blue) && svg.includes(BRAND.ink) && svg.includes(BRAND.red));
  // Sam sygnet nie zawiera napisu „SolutionsBay".
  assert.ok(!svg.includes(BRAND.word));
});

test("pełne logo dokłada napis do sygnetu", () => {
  const znak = markSvg("light");
  const pelne = fullLogoSvg("light");
  assert.ok(pelne.length > znak.length);
  assert.ok(pelne.includes(BRAND.word));
});

test("wariant na ciemne tło zamienia granat i czerń na biel", () => {
  const ciemny = fullLogoSvg("dark");
  // Granat i czerń znikały na granatowym nagłówku portalu.
  assert.ok(!ciemny.includes(BRAND.ink), "granat nie powinien zostać");
  assert.ok(!ciemny.includes(BRAND.word), "czerń nie powinna zostać");
  assert.ok(ciemny.includes("#ffffff"));
  // Błękit i czerwień czytają się na ciemnym tle i zostają bez zmian.
  assert.ok(ciemny.includes(BRAND.blue) && ciemny.includes(BRAND.red));
});

test("żaden token koloru nie zostaje niepodstawiony", () => {
  for (const svg of [markSvg("light"), markSvg("dark"), fullLogoSvg("light"), fullLogoSvg("dark")]) {
    assert.ok(!svg.includes("{{"), "został nieprzetworzony token w SVG");
  }
});
