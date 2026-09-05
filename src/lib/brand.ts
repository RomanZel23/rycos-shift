/**
 * Etap 4 — jedno źródło prawdy dla identyfikacji wizualnej.
 *
 * Do tej pory logo SolutionsBay było w trzech miejscach narysowane ręcznie
 * jako romb z czterech trójkątów (Header, LoginForm, szablon PDF) i nie miało
 * nic wspólnego z prawdziwym znakiem firmy. Tutaj leżą kształty wzięte wprost
 * z docs/logo/sb_logo_full.svg, a stopka dokumentów — z papieru firmowego
 * docs/logo/company_layout.pdf.
 *
 * Ścieżki są przechowywane z tokenami zamiast kolorów, bo ten sam znak musi
 * działać na białym papierze i na ciemnym tle aplikacji: granat i czerń
 * znikają na granatowym nagłówku portalu.
 */

const MARK_PATHS =
  "<path fill=\"{{blue}}\" d=\"M72.87,51.88l-7-7-7-7a9.88,9.88,0,0,0-14,0l-7,7-7,7a9.9,9.9,0,0,1,14,0l7,7," +
  "7,7a9.9,9.9,0,0,0,14-14Z\"></path><path fill=\"{{ink}}\" d=\"M58.88,2.9a9.89,9.89,0,0,0-14,0L34.39,13.39" +
  "l-7,7a9.9,9.9,0,0,1-14,0l7,7,7,7a9.89,9.89,0,0,0,14,0l7-7,10.49-10.5A9.89,9.89,0,0,0,58.88,2.9Z\"></p" +
  "ath><path fill=\"{{red}}\" d=\"M23.89,37.89a9.89,9.89,0,1,0,0,14A9.88,9.88,0,0,0,23.89,37.89Z\"></path><" +
  "path fill=\"{{ink}}\" d=\"M44.88,51.88a9.9,9.9,0,0,0-14,0l-7,7-14,14-7,7a9.9,9.9,0,0,0,14,14l7-7,14-14," +
  "14-14Z\"></path><polygon fill=\"{{red}}\" points=\"13.4 20.39 13.39 20.39 13.39 20.39 13.4 20.39\"></poly" +
  "gon><path fill=\"{{blue}}\" d=\"M27.39,6.4a9.9,9.9,0,1,0,0,14l7-7Z\"></path>";

const WORDMARK_PATHS =
  "<path fill=\"{{word}}\" d=\"M96.53,87.44h36.19c5.09,0,7-1.61,8-6.36l.17-.76c.76-3.81-.76-6.1-4.66-6.78L" +
  "114,69.89c-7.71-1.35-12-6.78-10.68-14l1-5.34c2-8.9,6.61-13.14,16-13.14h38.48l-1.27,5.94-4.07,3.39H12" +
  "2.38c-5.08,0-7,1.61-8,6.35l-.09.51c-.76,3.82.76,6.1,4.66,6.78l22.21,3.65c7.71,1.35,12,6.78,10.68,14l" +
  "-1.1,5.59c-1.78,8.9-6.61,13.14-16,13.14H94.58Z\"></path><path fill=\"{{word}}\" d=\"M161.62,65c1.61-7.88" +
  ",6.44-11.87,14.32-11.87H195c7.12,0,12,6,10.43,13.14l-4.16,19.49c-1.61,7.89-6.44,11.87-14.32,11.87H16" +
  "7.89c-7.12,0-11.95-6-10.42-13.14Zm23.65,23.73c4.83,0,5.76-.85,6.86-5.51L195.35,68c.93-4-.59-5.94-4.4" +
  "9-5.94H177.64c-4.66,0-6,.85-6.87,5.51l-3.22,15.26c-.93,4,.59,5.93,4.49,5.93Z\"></path><path fill=\"{{w" +
  "ord}}\" d=\"M221.15,38.7h9.75L218.61,96.76h-9.74Z\"></path><path fill=\"{{word}}\" d=\"M238.05,54h9.75l-6." +
  "1,28.82c-.76,4,.68,5.93,4.49,5.93H255c6,0,8.73-2,10-8L270.68,54h9.75l-9.07,42.8h-7.2l-.76-4.66H263a1" +
  "1.92,11.92,0,0,1-2.63,2.8,13,13,0,0,1-8,2.71H242c-7.12,0-11.95-6-10.42-13.14Z\"></path><path fill=\"{{" +
  "word}}\" d=\"M291.72,62.86h-8.06l1.87-8.9H294l6-12.29H306L303.33,54h14.41l-1.27,5.93-3.56,3H301.46l-4." +
  "07,19.07c-.93,4,.6,5.93,4.5,5.93h9.91l-1.86,8.9H297.73c-7.12,0-12-6-10.42-13.14Z\"></path><path fill=" +
  "\"{{word}}\" d=\"M325.29,54H335L326,96.76h-9.75Zm3.56-17h9.75l-2.29,11h-9.75Z\"></path><path fill=\"{{wor" +
  "d}}\" d=\"M342.5,65c1.61-7.88,6.44-11.87,14.32-11.87h19.07c7.12,0,11.95,6,10.43,13.14l-4.16,19.49c-1.6" +
  "1,7.89-6.44,11.87-14.32,11.87H348.77c-7.12,0-11.95-6-10.43-13.14Zm23.64,23.73c4.83,0,5.77-.85,6.87-5" +
  ".51L376.23,68c.93-4-.59-5.94-4.49-5.94H358.52c-4.67,0-6,.85-6.87,5.51l-3.22,15.26c-.93,4,.59,5.93,4." +
  "49,5.93Z\"></path><path fill=\"{{word}}\" d=\"M398.63,54h7.2l.68,4.66h.42a13.38,13.38,0,0,1,10.68-5.51H4" +
  "28c7.12,0,11.95,6,10.43,13.14l-6.45,30.51h-9.74L428.29,68c.93-4-.59-5.94-4.49-5.94h-8.9c-6,0-8.73,2-" +
  "10,8.05l-5.6,26.7h-9.74Z\"></path><path fill=\"{{word}}\" d=\"M442.16,87.86h26.19c2.63,0,3.73-.84,4.32-2" +
  ".54.68-2.29-.85-3.81-3-4.24l-14.16-3c-6.86-1.44-10-5.34-9-11l.59-3.22A12.1,12.1,0,0,1,459.37,54H487." +
  "5l-1.27,5.93-3.56,3H461.06q-3.69,0-4.32,2.54c-.6,2.29.59,3.65,3,4.24l14.16,3c6.86,1.44,10.08,5.43,9," +
  "10.93l-.59,3.31a12,12,0,0,1-12.2,9.83H440.3Z\"></path><path fill=\"{{word}}\" d=\"M501.68,37.43h38.06c8." +
  "13,0,13,6.28,11.44,14.41l-.6,3c-1,5.08-3.47,7.88-5.59,9.32a9.61,9.61,0,0,1-4.07,1.7l-.08.42a11,11,0," +
  "0,1,3.9,2.46c2,2,3.39,5,2.45,9.83l-1,5.08c-1.78,8.9-6.61,13.14-16,13.14h-41Zm26.44,50c5.09,0,7-1.61," +
  "8-6.36l.68-3.39c.93-4.32-.76-6.78-5.09-6.78H505.16l-3.48,16.53Zm3.82-25.85c5.08,0,7-1.61,8-6.36l.34-" +
  "1.69c.94-4.33-.76-6.78-5.08-6.78H510.33l-3.14,14.83Z\"></path><path fill=\"{{word}}\" d=\"M553.82,82.78c" +
  "1.78-8.56,6.18-11.87,14.32-11.87h19.49l.43-2.12c.76-4-.68-5.93-4.49-5.93H561.44l1.87-8.9H587.8c7.12," +
  "0,12,6,10.43,13.14L592,96.76h-7.21L584,92.1h-.42a12.13,12.13,0,0,1-2.63,2.8,12.75,12.75,0,0,1-8,2.71" +
  "h-9.15c-7.12,0-12-6-10.34-13.22Zm21.86,5.93c6,0,8.65-2,9.92-8l.34-1.7H568.65c-3.39,0-4.66,1.11-5.26," +
  "4.24l-.08.42c-.68,3.65.68,5.09,4.07,5.09Z\"></path><path fill=\"{{word}}\" d=\"M599,102.27h6.27c3.82,0,5" +
  ".51-.76,8.05-6.27l.09-.42L603.93,59l1.1-5h8.22l7.46,30.51h.42L638.68,54h9.57l-1.1,5L623.59,98c-5.68," +
  "9.5-9.66,13.14-18.48,13.14h-8.05Z\"></path>";

/** Kolory z oryginalnego pliku logo. */
export const BRAND = {
  blue: "#469cd2",
  ink: "#002c47",
  red: "#e30613",
  word: "#1d1d1b",
} as const;

export type LogoVariant = "light" | "dark";

/** Na ciemnym tle granat i czerń zamieniamy na biel; błękit i czerwień zostają. */
function palette(variant: LogoVariant) {
  return variant === "dark"
    ? { blue: BRAND.blue, ink: "#ffffff", red: BRAND.red, word: "#ffffff" }
    : BRAND;
}

function paint(shapes: string, variant: LogoVariant): string {
  const p = palette(variant);
  return shapes
    .replaceAll("{{blue}}", p.blue)
    .replaceAll("{{ink}}", p.ink)
    .replaceAll("{{red}}", p.red)
    .replaceAll("{{word}}", p.word);
}

/** Proporcje — przydają się przy ustawianiu szerokości w CSS. */
export const MARK_VIEWBOX = "0 0 75.75 96.8";
export const FULL_VIEWBOX = "0 0 648.25 111.17";

/** Sam sygnet (bez napisu). */
export function markSvg(variant: LogoVariant = "light", attrs = ""): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}" role="img" aria-label="SolutionsBay" ${attrs}>${paint(
    MARK_PATHS,
    variant
  )}</svg>`;
}

/** Pełne logo: sygnet + napis „SolutionsBay". */
export function fullLogoSvg(variant: LogoVariant = "light", attrs = ""): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${FULL_VIEWBOX}" role="img" aria-label="SolutionsBay" ${attrs}>${paint(
    MARK_PATHS + WORDMARK_PATHS,
    variant
  )}</svg>`;
}

/**
 * Dane rejestrowe ze stopki papieru firmowego (docs/logo/company_layout.pdf).
 * Trzy linie, dokładnie w tej kolejności i treści co na papierze.
 */
export const COMPANY = {
  legalName: "iDream Business Center spółka z ograniczoną odpowiedzialnością",
  address: "Kielce, 25-639, ul. Malików 150d",
  nip: "9591971466",
  krs: "0000612724",
  regon: "364221354",
  phone: "+48 41 308 00 05",
  email: "info@solutionsbay.pl",
  www: "www.solutionsbay.pl",
} as const;

/** Druga linia stopki. */
export function companyRegistryLine(): string {
  return `${COMPANY.address}, NIP: ${COMPANY.nip}, KRS: ${COMPANY.krs}, REGON: ${COMPANY.regon}`;
}

/** Trzecia linia stopki. */
export function companyContactLine(): string {
  return `tel. ${COMPANY.phone}, e-mail: ${COMPANY.email}, ${COMPANY.www}`;
}
