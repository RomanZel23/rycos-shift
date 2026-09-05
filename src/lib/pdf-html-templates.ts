import type { DailyReport, TenantSettings } from "@/types";
import { formatPolishTime } from "./date-utils";

/**
 * Etap 3 — szablony dokumentu dla renderowania po stronie serwera.
 *
 * Poprzednia wersja składała strony ręcznie: sztywne kontenery 794×1123 px,
 * `overflow: hidden` i wysokości policzone pod jeden krój pisma, a html2canvas
 * zamieniał każdą stronę w rastrowy obrazek. Skutki były dwa i oba poważne:
 * lista obecności powyżej dziewięciu osób po cichu znikała z dokumentu,
 * a układ rozjeżdżał się między maszynami, bo tekst rysowany był według metryk
 * czcionek konkretnego urządzenia.
 *
 * Teraz dokument jest zwykłym, płynącym HTML-em, a strony łamie Chromium przez
 * CSS paged media:
 *   - nic nie ginie — treść przechodzi na kolejną stronę,
 *   - nagłówek tabeli obecności powtarza się na każdej stronie (thead),
 *   - wiersze i karty zdjęć nie pękają w połowie (break-inside: avoid),
 *   - numeracja stron pochodzi z footerTemplate renderera,
 *   - tekst jest tekstem: przeszukiwalnym i zaznaczalnym, a plik wielokrotnie
 *     mniejszy niż raster.
 *
 * WAŻNE: kroje pisma są przypięte do tych zainstalowanych w obrazie Dockera
 * (Liberation, DejaVu). Świadomie nie używamy -apple-system ani innych krojów
 * systemu użytkownika — to ich metryki psuły poprzedni układ.
 */

import { COMPANY, fullLogoSvg } from "./brand";

const FONT_STACK = "'Liberation Sans', 'DejaVu Sans', Arial, Helvetica, sans-serif";
const FONT_MONO = "'DejaVu Sans Mono', 'Liberation Mono', monospace";


export function escapeHtml(str?: string): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function baseStyles(): string {
  return `
    @page {
      size: A4;
      /* Dolny margines mieści trzylinijkową stopkę z danymi rejestrowymi
         (jak na papierze firmowym) plus numerację stron. */
      margin: 12mm 11mm 22mm 11mm;
    }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      padding: 0;
      font-family: ${FONT_STACK};
      font-size: 11px;
      line-height: 1.45;
      color: #0f172a;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .letterhead {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .letterhead img { height: 40px; width: auto; display: block; }
    /* Proporcja znaku to 648:111, więc 150px szerokości daje ok. 26px wysokości. */
    .letterhead .sb-logo { width: 150px; }
    .letterhead .sb-logo svg { width: 100%; height: auto; display: block; }

    .title-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: #0f172a;
      color: #ffffff;
      padding: 12px 16px;
      border-radius: 7px;
      margin-bottom: 14px;
    }
    .title-bar .kicker {
      font-size: 8px;
      font-weight: 800;
      color: #38bdf8;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .title-bar .title { font-size: 15px; font-weight: 800; margin-top: 2px; }
    .title-bar .stamp { text-align: right; font-size: 10px; color: #cbd5e1; }
    .title-bar .stamp strong { display: block; font-size: 13px; color: #ffffff; }

    .meta {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
      margin-bottom: 16px;
    }
    .meta .cell {
      background-color: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px 10px;
    }
    .meta .label {
      font-size: 8px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.7px;
      color: #64748b;
    }
    .meta .value { font-size: 11.5px; font-weight: 700; margin-top: 2px; }
    .meta .value.mono { font-family: ${FONT_MONO}; font-size: 10px; font-weight: 400; }

    h2.section {
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      border-bottom: 2px solid #0284c7;
      padding-bottom: 4px;
      margin: 18px 0 10px;
      /* Nagłówek sekcji nigdy nie zostaje sam na dole strony. */
      break-after: avoid;
      page-break-after: avoid;
    }

    ul.topics { list-style: none; margin: 0; padding: 0; }
    ul.topics li {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      background-color: #f8fafc;
      border-left: 3px solid #0284c7;
      border-radius: 0 5px 5px 0;
      padding: 7px 10px;
      margin-bottom: 6px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    ul.topics .num {
      flex: 0 0 auto;
      width: 16px; height: 16px;
      background-color: #0284c7;
      color: #ffffff;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 800;
      text-align: center;
      line-height: 16px;
    }
    ul.topics .txt { font-size: 11px; font-weight: 600; color: #1e293b; }

    table.attendance {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #cbd5e1;
    }
    /* Powtarzanie nagłówka na każdej stronie — robi to przeglądarka sama. */
    table.attendance thead { display: table-header-group; }
    table.attendance tr {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    table.attendance th {
      background-color: #0f172a;
      color: #ffffff;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 7px 8px;
      text-align: left;
      border-right: 1px solid #1e293b;
    }
    table.attendance td {
      padding: 6px 8px;
      border-top: 1px solid #e2e8f0;
      border-right: 1px solid #e2e8f0;
      font-size: 10.5px;
      vertical-align: middle;
    }
    table.attendance tbody tr:nth-child(even) td { background-color: #f8fafc; }
    table.attendance .idx { width: 26px; text-align: center; font-weight: 700; color: #475569; }
    table.attendance .role { color: #334155; }
    table.attendance .hour { width: 52px; text-align: center; font-family: ${FONT_MONO}; font-size: 9.5px; color: #475569; }
    table.attendance .sig { width: 132px; padding: 3px 6px; }
    table.attendance .sig img {
      display: block;
      max-height: 30px;
      max-width: 120px;
      margin: 0 auto;
      object-fit: contain;
    }
    .badge-foreman {
      display: inline-block;
      background-color: #f59e0b;
      color: #0f172a;
      font-size: 7.5px;
      font-weight: 800;
      letter-spacing: 0.4px;
      padding: 1px 5px;
      border-radius: 3px;
      margin-left: 6px;
      vertical-align: middle;
    }

    .photo-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .photo-card {
      border: 1px solid #cbd5e1;
      border-radius: 7px;
      overflow: hidden;
      background-color: #ffffff;
      /* Karta nie pęka między stronami — cała trafia na następną. */
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .photo-card .frame {
      height: 170px;
      background-color: #0f172a;
      overflow: hidden;
    }
    .photo-card .frame img {
      width: 100%;
      height: 170px;
      object-fit: cover;
      display: block;
    }
    .photo-card .caption { padding: 7px 10px 8px; }
    .photo-card .desc {
      font-size: 10.5px;
      font-weight: 700;
      color: #1e293b;
      line-height: 1.35;
      /* Bez sztywnej wysokości — dłuższy opis zajmie trzeci wiersz i powiększy
         kartę. Nic się nie utnie, bo nic nie jest przycinane. */
    }
    .photo-card .when {
      font-family: ${FONT_MONO};
      font-size: 8.5px;
      color: #64748b;
      margin-top: 5px;
    }

    .closing {
      margin-top: 18px;
      padding-top: 10px;
      border-top: 1px dashed #cbd5e1;
      font-size: 9.5px;
      color: #64748b;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .closing .formula { font-weight: 800; color: #0f172a; letter-spacing: 0.5px; }
  `;
}

/**
 * Nagłówek odwzorowuje papier firmowy (docs/logo/company_layout.pdf):
 * iDream Business Center z lewej, SolutionsBay z prawej. Oba znaki są
 * prawdziwe — logo SolutionsBay wstawiamy jako SVG wprost z src/lib/brand.ts,
 * więc jest wektorowe i nie zależy od pobrania pliku (Chromium renderujący
 * dokument ma zablokowaną sieć).
 */
function renderLetterhead(logoDataUrl?: string): string {
  return `
    <div class="letterhead">
      ${
        logoDataUrl
          ? `<img src="${escapeHtml(logoDataUrl)}" alt="iDream Business Center" />`
          : `<span style="font-size:17px;font-weight:800;color:#002c47;">iDream Business Center</span>`
      }
      <div class="sb-logo">${fullLogoSvg("light")}</div>
    </div>
  `;
}

function renderTitleBar(report: DailyReport, typeName: string): string {
  return `
    <div class="title-bar">
      <div>
        <div class="kicker">System raportowania prac &bull; RYCOS Shift</div>
        <div class="title">${escapeHtml(typeName)}</div>
      </div>
      <div class="stamp">
        <strong>${escapeHtml(report.date)}</strong>
        godz. ${escapeHtml(report.time)}
      </div>
    </div>
  `;
}

function renderMeta(report: DailyReport): string {
  const lat = report.location?.latitude;
  const lng = report.location?.longitude;
  const acc = report.location?.accuracy;
  const gps =
    typeof lat === "number" && typeof lng === "number"
      ? `${lat.toFixed(6)}, ${lng.toFixed(6)}${acc ? ` (±${Math.round(acc)} m)` : ""}`
      : "Brak odczytu GPS";

  return `
    <div class="meta">
      <div class="cell">
        <div class="label">Plac budowy</div>
        <div class="value">${escapeHtml(report.siteName)}</div>
      </div>
      <div class="cell">
        <div class="label">Brygadzista</div>
        <div class="value">${escapeHtml(report.foremanName)}</div>
      </div>
      <div class="cell">
        <div class="label">Lokalizacja GPS</div>
        <div class="value mono">${escapeHtml(gps)}</div>
      </div>
    </div>
  `;
}

function renderClosing(settings?: TenantSettings): string {
  const org = settings?.organizationName || COMPANY.legalName;
  return `
    <div class="closing">
      <div class="formula">[Koniec raportu]</div>
      <div style="margin-top: 4px;">
        ${escapeHtml(org)} &bull; dokument wygenerowany automatycznie przez system RYCOS Shift.
      </div>
    </div>
  `;
}

function documentShell(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <style>${baseStyles()}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

export interface TemplateAssets {
  /** Logo iDream jako data URL — Chromium renderuje bez dostępu do sieci. */
  logoDataUrl?: string;
}

/** Raport rozpoczęcia prac — odprawa BHP i lista obecności z podpisami. */
export function generateStartShiftHtml(
  report: DailyReport,
  settings?: TenantSettings,
  assets?: TemplateAssets
): string {
  const topics = report.discussedTopics || [];
  const attendance = report.attendanceList || [];

  const topicsHtml = topics.length
    ? `<ul class="topics">${topics
        .map(
          (t, i) => `
        <li>
          <span class="num">${i + 1}</span>
          <span class="txt">${escapeHtml(t)}</span>
        </li>`
        )
        .join("")}</ul>`
    : `<div style="font-size:11px;color:#64748b;">Nie odnotowano omawianych obszarów.</div>`;

  const rowsHtml = attendance.length
    ? attendance
        .map(
          (a, i) => `
      <tr>
        <td class="idx">${i + 1}</td>
        <td>
          <strong>${escapeHtml(a.userName)}</strong>
          ${a.isForeman ? '<span class="badge-foreman">BRYGADZISTA</span>' : ""}
        </td>
        <td class="role">${escapeHtml(a.userRole)}</td>
        <td class="hour">${escapeHtml(formatPolishTime(a.signedAt || report.time))}</td>
        <td class="sig">
          ${a.signatureDataUrl ? `<img src="${escapeHtml(a.signatureDataUrl)}" alt="Podpis" />` : ""}
        </td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="5" style="text-align:center;color:#64748b;padding:14px;">Brak wpisów na liście obecności.</td></tr>`;

  return documentShell(`
    ${renderLetterhead(assets?.logoDataUrl)}
    ${renderTitleBar(report, "Rozpoczęcie prac zespołu")}
    ${renderMeta(report)}

    <h2 class="section">1. Omawiane obszary (BHP / zakres robót i instruktaż)</h2>
    ${topicsHtml}

    <h2 class="section">2. Lista obecności i podpisy pracowników</h2>
    <table class="attendance">
      <thead>
        <tr>
          <th class="idx">Lp.</th>
          <th>Imię i nazwisko</th>
          <th>Rola / funkcja</th>
          <th class="hour">Godzina</th>
          <th class="sig">Podpis odręczny</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>

    ${renderClosing(settings)}
  `);
}

/** Raport zakończenia prac — dokumentacja fotograficzna. */
export function generateEndShiftHtml(
  report: DailyReport,
  settings?: TenantSettings,
  assets?: TemplateAssets
): string {
  const photos = report.photoDocumentation || [];

  const cardsHtml = photos.length
    ? `<div class="photo-grid">${photos
        .map(
          (p, i) => `
        <div class="photo-card">
          <div class="frame">
            ${p.photoDataUrl ? `<img src="${escapeHtml(p.photoDataUrl)}" alt="Fotografia ${i + 1}" />` : ""}
          </div>
          <div class="caption">
            <div class="desc">${escapeHtml(
              p.description || "Dokumentacja stanu robót na placu budowy."
            )}</div>
            <div class="when">Zdjęcie ${i + 1} &bull; wykonano ${escapeHtml(
              formatPolishTime(p.takenAt || report.time)
            )}</div>
          </div>
        </div>`
        )
        .join("")}</div>`
    : `<div style="font-size:11px;color:#64748b;">Brak dokumentacji fotograficznej.</div>`;

  return documentShell(`
    ${renderLetterhead(assets?.logoDataUrl)}
    ${renderTitleBar(report, "Zakończenie prac zespołu — fotorelacja")}
    ${renderMeta(report)}

    <h2 class="section">Dokumentacja fotograficzna wykonanych robót</h2>
    ${cardsHtml}

    ${renderClosing(settings)}
  `);
}
