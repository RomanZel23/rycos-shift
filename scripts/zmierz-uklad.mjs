/**
 * Pomiar układu strony względem papieru firmowego.
 *
 * Do czego służy: HEADER_BOX_TOP_MM, FOOTER_BOX_TOP_MM i FOOTER_TEXT_DROP_MM
 * w src/lib/pdf-renderer.ts są WARTOŚCIAMI ZMIERZONYMI, nie wyliczonymi.
 * Chromium wsuwa pudełka nagłówka i stopki o kilka milimetrów od krawędzi
 * arkusza i nigdzie tego nie dokumentuje. Po zmianie marginesów strony albo
 * po większej aktualizacji Chromium trzeba je przemierzyć — tym skryptem.
 *
 * Uruchomienie:
 *   CHROMIUM_PATH=/usr/bin/chromium node scripts/zmierz-uklad.mjs
 *
 * Skrypt renderuje pustą dwustronicową kartkę z paskami kontrolnymi na
 * krawędziach obu pudełek i zapisuje ją jako /tmp/uklad.pdf. Pozycje pasków
 * odczytaj dowolnym narzędziem czytającym PDF, np.:
 *   python3 -c "import pdfplumber;p=pdfplumber.open('/tmp/uklad.pdf').pages[0];
 *   [print(round(r['top']*25.4/72,2), round(r['bottom']*25.4/72,2)) for r in p.rects]"
 *
 * Górna krawędź pierwszego czerwonego paska = HEADER_BOX_TOP_MM.
 * Górna krawędź pierwszego niebieskiego paska = FOOTER_BOX_TOP_MM.
 */
import puppeteer from "puppeteer-core";
import { writeFile } from "node:fs/promises";

const MARGINESY = "28mm 22.4mm 26mm 21.5mm"; // musi zgadzać się z PAGE_MARGIN_MM

const pasek = (kolor, gdzie) =>
  `<div style="position:absolute;${gdzie};width:100%;height:0.5mm;background:${kolor};
     -webkit-print-color-adjust:exact;print-color-adjust:exact;"></div>`;

const szablon = (kolor) =>
  `<div style="position:relative;width:100%;height:100%;margin:0;padding:0;">
     ${pasek(kolor, "top:0")}${pasek(kolor, "bottom:0")}
   </div>`;

const browser = await puppeteer.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
});

const page = await browser.newPage();
await page.setContent(`<html><head><style>
  @page { size: A4; margin: ${MARGINESY}; }
  body { margin: 0; font-family: 'Liberation Sans', sans-serif; }
  .p { page-break-after: always; height: 100mm; }
</style></head><body><div class="p">strona 1</div><div>strona 2</div></body></html>`);

const pdf = await page.pdf({
  format: "A4",
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: true,
  headerTemplate: szablon("#ff0000"),
  footerTemplate: szablon("#0000ff"),
});

await writeFile("/tmp/uklad.pdf", pdf);
await browser.close();
console.log("Zapisano /tmp/uklad.pdf — zmierz pozycje pasków (czerwony = nagłówek, niebieski = stopka).");
