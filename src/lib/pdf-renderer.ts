import type { Browser } from "puppeteer-core";
import puppeteer from "puppeteer-core";

/**
 * Etap 3 — renderowanie PDF po stronie serwera przez Chromium.
 *
 * Zastępuje html2canvas + jsPDF na telefonie. Powody w skrócie:
 *   - html2canvas nie łamie stron, więc lista obecności powyżej dziewięciu
 *     osób znikała z dokumentu bez śladu,
 *   - rysował tekst według metryk czcionek konkretnego urządzenia, przez co
 *     układ rozjeżdżał się między maszynami,
 *   - produkował raster: bez wyszukiwania tekstu, kilkanaście razy cięższy,
 *     a całą robotę wykonywał telefon w terenie na łączu LTE.
 *
 * Chromium na serwerze łamie strony natywnie, ma stały zestaw krojów i oddaje
 * PDF z prawdziwym tekstem.
 */

const CHROMIUM_PATH =
  process.env.CHROMIUM_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || "/usr/bin/chromium";

/** Twardy limit na renderowanie jednego dokumentu. */
const RENDER_TIMEOUT_MS = 45_000;

let browserPromise: Promise<Browser> | null = null;

/**
 * Jedna instancja przeglądarki na proces. Start Chromium to kilkaset
 * milisekund — nie chcemy tego płacić przy każdym raporcie. Jeśli instancja
 * padnie, następne wywołanie podniesie ją od nowa.
 */
async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        executablePath: CHROMIUM_PATH,
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--font-render-hinting=none",
        ],
      })
      .then((browser) => {
        browser.on("disconnected", () => {
          browserPromise = null;
        });
        return browser;
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

function footerTemplate(reportName: string): string {
  return `
    <div style="width:100%; padding:0 11mm; font-family: 'Liberation Sans', Arial, sans-serif;
                font-size:7pt; color:#64748b; display:flex; justify-content:space-between;">
      <span>${reportName}</span>
      <span>Strona <span class="pageNumber"></span> z <span class="totalPages"></span></span>
    </div>
  `;
}

export interface RenderOptions {
  /** Trafia do stopki na każdej stronie — ułatwia identyfikację wydruku. */
  documentName: string;
}

/**
 * HTML -> PDF. Dokument renderowany jest w izolacji: bez dostępu do sieci
 * i bez JavaScriptu. Wszystkie obrazy muszą być wcześniej wstawione jako
 * data URL — dzięki temu render nie zależy od dostępności bucketu ani od
 * ciasteczek sesji, i nie da się z niego zrobić narzędzia do odpytywania
 * zasobów wewnętrznych.
 */
export async function renderHtmlToPdf(
  html: string,
  options: RenderOptions
): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setJavaScriptEnabled(false);

    // Blokada wszystkiego, co nie jest samym dokumentem lub obrazem data:.
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const url = req.url();
      if (url.startsWith("data:") || url === "about:blank") {
        req.continue();
        return;
      }
      if (req.isNavigationRequest() && req.frame() === page.mainFrame()) {
        req.continue();
        return;
      }
      req.abort();
    });

    await page.setContent(html, {
      waitUntil: "load",
      timeout: RENDER_TIMEOUT_MS,
    });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: footerTemplate(options.documentName),
      timeout: RENDER_TIMEOUT_MS,
    });

    return Buffer.from(pdf);
  } finally {
    await page.close().catch(() => {});
  }
}

/** Zamknięcie przeglądarki — przydatne w testach i przy wyłączaniu procesu. */
export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const browser = await browserPromise.catch(() => null);
  browserPromise = null;
  await browser?.close().catch(() => {});
}
