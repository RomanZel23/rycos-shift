import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

/**
 * Katalog roboczy Chromium. MUSI być zapisywalny dla użytkownika, na którym
 * chodzi kontener (w obrazie: `nextjs`, uid 1001).
 *
 * Awaria z 2026-09-05, po przebudowie obrazu:
 *
 *   Failed to launch the browser process:
 *   chrome_crashpad_handler: --database is required
 *
 * Chromium przy starcie odpala osobny proces `chrome_crashpad_handler`
 * i przekazuje mu `--database` wyliczone z katalogu na zrzuty awaryjne.
 * Gdy tego katalogu nie da się ustalić ani utworzyć — bo HOME wskazuje
 * miejsce, w którym użytkownik nie ma prawa zapisu — argument wychodzi pusty,
 * handler kończy się błędem, a razem z nim cała przeglądarka. Nie zależy to
 * od treści dokumentu: albo Chromium wstaje, albo nie wstaje w ogóle.
 *
 * Dlatego katalog wskazujemy jawnie i sam crash reporter wyłączamy — nie ma
 * komu czytać zrzutów awaryjnych z tego kontenera, a jedyne, co robią, to
 * przewracają renderowanie raportów.
 *
 * `apt-get install chromium` w Dockerfile nie jest przypięty do wersji, więc
 * każda przebudowa obrazu może przynieść nowszego Chromiuma o innych wymaganiach.
 * Jawny katalog i wyłączony crashpad zdejmują tę zależność.
 */
const CHROMIUM_WORK_DIR =
  process.env.CHROMIUM_WORK_DIR || join(tmpdir(), "rycos-chromium");

function ensureWorkDir(): string {
  try {
    mkdirSync(CHROMIUM_WORK_DIR, { recursive: true });
    return CHROMIUM_WORK_DIR;
  } catch (err) {
    console.warn(
      `Nie udało się utworzyć ${CHROMIUM_WORK_DIR}, używam ${tmpdir()}:`,
      err
    );
    return tmpdir();
  }
}

let browserPromise: Promise<Browser> | null = null;

/**
 * Jedna instancja przeglądarki na proces. Start Chromium to kilkaset
 * milisekund — nie chcemy tego płacić przy każdym raporcie. Jeśli instancja
 * padnie, następne wywołanie podniesie ją od nowa.
 */
async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const workDir = ensureWorkDir();

    browserPromise = puppeteer
      .launch({
        executablePath: CHROMIUM_PATH,
        headless: true,
        // HOME bywa w kontenerze ustawiony na katalog bez prawa zapisu.
        // Chromium wylicza z niego domyślne ścieżki profilu i zrzutów
        // awaryjnych, więc podstawiamy własny, na pewno zapisywalny katalog.
        env: { ...process.env, HOME: workDir, XDG_CONFIG_HOME: workDir, XDG_CACHE_HOME: workDir },
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--font-render-hinting=none",
          // Profil i zrzuty w jawnie wskazanym miejscu — patrz komentarz
          // przy CHROMIUM_WORK_DIR.
          `--user-data-dir=${join(workDir, "profile")}`,
          `--crash-dumps-dir=${join(workDir, "crashes")}`,
          "--disable-crash-reporter",
          "--disable-breakpad",
          "--no-crash-upload",
          // Kontener nie ma sesji graficznej ani nikogo, kto kliknie „OK".
          "--noerrdialogs",
          "--disable-extensions",
          "--disable-background-networking",
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
        // Pełna treść (setki znaków stderr Chromium) idzie do logów kontenera.
        // Do brygadzisty w terenie ma trafić zdanie, nie zrzut stosu.
        console.error("Chromium launch failed:", err);
        throw new BrowserLaunchError(
          err instanceof Error ? err.message : String(err)
        );
      });
  }
  return browserPromise;
}

/**
 * Awaria przeglądarki na serwerze, nie problem z danymi raportu. Rozróżnienie
 * ma znaczenie: przy tym błędzie ponawianie z telefonu nic nie da, bo winna
 * jest instalacja Chromium w kontenerze.
 */
export class BrowserLaunchError extends Error {
  readonly detail: string;
  constructor(detail: string) {
    super(
      "Serwer nie mógł uruchomić generatora PDF. To awaria po stronie serwera, " +
        "nie problem z Twoim raportem — zgłoś to administratorowi."
    );
    this.name = "BrowserLaunchError";
    this.detail = detail;
  }
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
