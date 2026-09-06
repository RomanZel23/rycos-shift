import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Browser } from "puppeteer-core";
import puppeteer from "puppeteer-core";
import { COMPANY, LETTERHEAD, companyRegistryLine, fullLogoSvg } from "./brand";

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

/**
 * Nagłówek i stopka odwzorowują papier firmowy (docs/logo/company_layout.pdf).
 *
 * Rysuje je Chromium w marginesach strony, więc powtarzają się na KAŻDEJ
 * stronie — tak jak na papierze. Ten dokument nie widzi CSS strony i nie
 * pobierze żadnego pliku, dlatego style są wpisane wprost, a obrazy muszą
 * przyjść jako data URL.
 *
 * Pozycje są liczone od lewej górnej krawędzi arkusza, bo pudełko nagłówka
 * i stopki obejmuje całą szerokość papieru razem z marginesami. Współrzędne
 * pochodzą z pomiaru wzorca — patrz LETTERHEAD w src/lib/brand.ts.
 */

/**
 * Chromium NIE umieszcza pudełka nagłówka i stopki przy samej krawędzi arkusza
 * — wsuwa je o stały dystans (ok. 5,2 mm). Bez tej poprawki loga wychodziły
 * o te 5 mm za nisko, a stopka o 5 mm za wysoko względem wzorca.
 *
 * Wartości zmierzone dla A4 i marginesów z PAGE_MARGIN_MM przez wstawienie
 * pasków kontrolnych na krawędziach obu pudełek i odczytanie ich pozycji
 * z gotowego PDF-a (scripts/zmierz-uklad.mjs). Zmiana marginesów strony albo
 * większa aktualizacja Chromium może je przesunąć — wtedy trzeba przemierzyć.
 */
const HEADER_BOX_TOP_MM = 5.29;
const FOOTER_BOX_TOP_MM = 265.64;

/**
 * Odległość od górnej krawędzi wiersza tekstu do dolnej krawędzi liter,
 * dla kroju stopki przy line-height ustawionym na skok wierszy ze wzorca.
 * Też zmierzona, nie wyliczona z metryk — te różnią się między wersjami kroju.
 */
const FOOTER_TEXT_DROP_MM = 3.2;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function headerTemplate(logoDataUrl?: string): string {
  const { idream, solutionsBay } = LETTERHEAD;
  const gora = (yMm: number) => (yMm - HEADER_BOX_TOP_MM).toFixed(3);
  return `
    <div style="position:relative; width:100%; height:100%; margin:0; padding:0;
                -webkit-print-color-adjust:exact; print-color-adjust:exact;">
      ${
        logoDataUrl
          ? `<img src="${logoDataUrl}" alt="" style="position:absolute;
               left:${idream.xMm}mm; top:${gora(idream.yMm)}mm;
               width:${idream.widthMm}mm; height:${idream.heightMm}mm;">`
          : ""
      }
      <div style="position:absolute; left:${solutionsBay.xMm}mm; top:${gora(solutionsBay.yMm)}mm;
                  width:${solutionsBay.widthMm}mm; line-height:0;">
        ${fullLogoSvg("light", 'style="width:100%;height:auto;display:block;"')}
      </div>
    </div>
  `;
}

function footerTemplate(): string {
  const { footerLeftMm, footerBaselinesMm, footerFontPt, footerAccentFontPt } = LETTERHEAD;
  const [l1, l2, l3] = footerBaselinesMm;
  const skok = (footerBaselinesMm[2] - footerBaselinesMm[0]) / 2; // 3,645 mm ze wzorca

  /**
   * Wiersz stopki ustawiany przez DOLNĄ krawędź liter. Sztywny line-height jest
   * tu istotny: bez niego większa czerwona litera „B" w pierwszym wierszu
   * rozpychałaby jego pudełko i psuła odstęp względem wzorca.
   */
  const linia = (dolMm: number, tresc: string) => `
    <div style="position:absolute; left:${footerLeftMm}mm;
                top:${(dolMm - FOOTER_BOX_TOP_MM - FOOTER_TEXT_DROP_MM).toFixed(3)}mm;
                font-size:${footerFontPt}pt; line-height:${skok.toFixed(3)}mm;
                white-space:nowrap; color:${LETTERHEAD.footerColor};">${tresc}</div>`;

  const link = (tekst: string) =>
    `<span style="color:${LETTERHEAD.footerLinkColor}; text-decoration:underline;">${esc(tekst)}</span>`;

  // Numeracja stron — jedyny element, którego wzorzec nie ma. Trzymamy ją
  // po prawej, w linii ostatniego wiersza stopki, wyrównaną do prawej
  // krawędzi logo SolutionsBay, żeby nie rozbijała układu papieru.
  //
  // Nazwy dokumentu tu NIE ma celowo: przy dłuższej nazwie placu budowy
  // nachodziła na trzecią linię stopki, a wzorzec i tak jej nie przewiduje.
  const prawyMarginesMm =
    LETTERHEAD.pageWidthMm - (LETTERHEAD.solutionsBay.xMm + LETTERHEAD.solutionsBay.widthMm);

  return `
    <div style="position:relative; width:100%; height:100%; margin:0; padding:0;
                font-family:'Liberation Sans Narrow','Arial Narrow',Arial,sans-serif;
                -webkit-print-color-adjust:exact; print-color-adjust:exact;">
      ${linia(
        l1,
        `iDream <span style="font-size:${footerAccentFontPt}pt; line-height:0; color:${LETTERHEAD.footerAccentColor};">B</span>usiness Center spółka z ograniczoną odpowiedzialnością`
      )}
      ${linia(l2, esc(companyRegistryLine()))}
      ${linia(
        l3,
        `tel. ${esc(COMPANY.phone)}, e-mail: ${link(COMPANY.email)}, ${link(COMPANY.www)}`
      )}
      <div style="position:absolute; right:${prawyMarginesMm.toFixed(2)}mm;
                  top:${(l3 - FOOTER_BOX_TOP_MM - FOOTER_TEXT_DROP_MM).toFixed(3)}mm;
                  font-size:${footerFontPt}pt; line-height:${skok.toFixed(3)}mm;
                  white-space:nowrap; color:${LETTERHEAD.footerColor};">
        Strona <span class="pageNumber"></span> z <span class="totalPages"></span>
      </div>
    </div>
  `;
}

export interface RenderOptions {
  /**
   * Nazwa dokumentu w metadanych PDF-a. Do stopki nie trafia — wzorzec papieru
   * firmowego jej nie przewiduje, a przy dłuższej nazwie placu nachodziła na
   * dane rejestrowe.
   */
  documentName: string;
  /** Logo iDream jako data URL — nagłówek nie ma dostępu do sieci ani plików. */
  logoDataUrl?: string;
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
      headerTemplate: headerTemplate(options.logoDataUrl),
      footerTemplate: footerTemplate(),
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
