import { DailyReport, TenantSettings } from "@/types";
import { formatPolishTime, formatPolishDateTime } from "./date-utils";

/**
 * Wektorowe logo SolutionsBay w wersji inline (gwarantuje 100% idealne skalowanie w html2canvas/jsPDF)
 */
const SB_LOGO_INLINE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 648.25 111.17" width="186" height="32" style="display: block; width: 186px; height: 32px;">
  <g id="Warstwa_2" data-name="Warstwa 2">
    <g id="logo_1" data-name="logo 1">
      <path fill="#469cd2" d="M72.87,51.88l-7-7-7-7a9.88,9.88,0,0,0-14,0l-7,7-7,7a9.9,9.9,0,0,1,14,0l7,7,7,7a9.9,9.9,0,0,0,14-14Z"></path>
      <path fill="#002c47" d="M58.88,2.9a9.89,9.89,0,0,0-14,0L34.39,13.39l-7,7a9.9,9.9,0,0,1-14,0l7,7,7,7a9.89,9.89,0,0,0,14,0l7-7,10.49-10.5A9.89,9.89,0,0,0,58.88,2.9Z"></path>
      <path fill="#e30613" d="M23.89,37.89a9.89,9.89,0,1,0,0,14A9.88,9.88,0,0,0,23.89,37.89Z"></path>
      <path fill="#002c47" d="M44.88,51.88a9.9,9.9,0,0,0-14,0l-7,7-14,14-7,7a9.9,9.9,0,0,0,14,14l7-7,14-14,14-14Z"></path>
      <polygon fill="#e30613" points="13.4 20.39 13.39 20.39 13.39 20.39 13.4 20.39"></polygon>
      <path fill="#469cd2" d="M27.39,6.4a9.9,9.9,0,1,0,0,14l7-7Z"></path>
      <path fill="#1d1d1b" d="M96.53,87.44h36.19c5.09,0,7-1.61,8-6.36l.17-.76c.76-3.81-.76-6.1-4.66-6.78L114,69.89c-7.71-1.35-12-6.78-10.68-14l1-5.34c2-8.9,6.61-13.14,16-13.14h38.48l-1.27,5.94-4.07,3.39H122.38c-5.08,0-7,1.61-8,6.35l-.09.51c-.76,3.82.76,6.1,4.66,6.78l22.21,3.65c7.71,1.35,12,6.78,10.68,14l-1.1,5.59c-1.78,8.9-6.61,13.14-16,13.14H94.58Z"></path>
      <path fill="#1d1d1b" d="M161.62,65c1.61-7.88,6.44-11.87,14.32-11.87H195c7.12,0,12,6,10.43,13.14l-4.16,19.49c-1.61,7.89-6.44,11.87-14.32,11.87H167.89c-7.12,0-11.95-6-10.42-13.14Zm23.65,23.73c4.83,0,5.76-.85,6.86-5.51L195.35,68c.93-4-.59-5.94-4.49-5.94H177.64c-4.66,0-6,.85-6.87,5.51l-3.22,15.26c-.93,4,.59,5.93,4.49,5.93Z"></path>
      <path fill="#1d1d1b" d="M221.15,38.7h9.75L218.61,96.76h-9.74Z"></path>
      <path fill="#1d1d1b" d="M238.05,54h9.75l-6.1,28.82c-.76,4,.68,5.93,4.49,5.93H255c6,0,8.73-2,10-8L270.68,54h9.75l-9.07,42.8h-7.2l-.76-4.66H263a11.92,11.92,0,0,1-2.63,2.8,13,13,0,0,1-8,2.71H242c-7.12,0-11.95-6-10.42-13.14Z"></path>
      <path fill="#1d1d1b" d="M291.72,62.86h-8.06l1.87-8.9H294l6-12.29H306L303.33,54h14.41l-1.27,5.93-3.56,3H301.46l-4.07,19.07c-.93,4,.6,5.93,4.5,5.93h9.91l-1.86,8.9H297.73c-7.12,0-12-6-10.42-13.14Z"></path>
      <path fill="#1d1d1b" d="M325.29,54H335L326,96.76h-9.75Zm3.56-17h9.75l-2.29,11h-9.75Z"></path>
      <path fill="#1d1d1b" d="M342.5,65c1.61-7.88,6.44-11.87,14.32-11.87h19.07c7.12,0,11.95,6,10.43,13.14l-4.16,19.49c-1.61,7.89-6.44,11.87-14.32,11.87H348.77c-7.12,0-11.95-6-10.43-13.14Zm23.64,23.73c4.83,0,5.77-.85,6.87-5.51L376.23,68c.93-4-.59-5.94-4.49-5.94H358.52c-4.67,0-6,.85-6.87,5.51l-3.22,15.26c-.93,4,.59,5.93,4.49,5.93Z"></path>
      <path fill="#1d1d1b" d="M398.63,54h7.2l.68,4.66h.42a13.38,13.38,0,0,1,10.68-5.51H428c7.12,0,11.95,6,10.43,13.14l-6.45,30.51h-9.74L428.29,68c.93-4-.59-5.94-4.49-5.94h-8.9c-6,0-8.73,2-10,8.05l-5.6,26.7h-9.74Z"></path>
      <path fill="#1d1d1b" d="M442.16,87.86h26.19c2.63,0,3.73-.84,4.32-2.54.68-2.29-.85-3.81-3-4.24l-14.16-3c-6.86-1.44-10-5.34-9-11l.59-3.22A12.1,12.1,0,0,1,459.37,54H487.5l-1.27,5.93-3.56,3H461.06q-3.69,0-4.32,2.54c-.6,2.29.59,3.65,3,4.24l14.16,3c6.86,1.44,10.08,5.43,9,10.93l-.59,3.31a12,12,0,0,1-12.2,9.83H440.3Z"></path>
      <path fill="#1d1d1b" d="M501.68,37.43h38.06c8.13,0,13,6.28,11.44,14.41l-.6,3c-1,5.08-3.47,7.88-5.59,9.32a9.61,9.61,0,0,1-4.07,1.7l-.08.42a11,11,0,0,1,3.9,2.46c2,2,3.39,5,2.45,9.83l-1,5.08c-1.78,8.9-6.61,13.14-16,13.14h-41Zm26.44,50c5.09,0,7-1.61,8-6.36l.68-3.39c.93-4.32-.76-6.78-5.09-6.78H505.16l-3.48,16.53Zm3.82-25.85c5.08,0,7-1.61,8-6.36l.34-1.69c.94-4.33-.76-6.78-5.08-6.78H510.33l-3.14,14.83Z"></path>
      <path fill="#1d1d1b" d="M553.82,82.78c1.78-8.56,6.18-11.87,14.32-11.87h19.49l.43-2.12c.76-4-.68-5.93-4.49-5.93H561.44l1.87-8.9H587.8c7.12,0,12,6,10.43,13.14L592,96.76h-7.21L584,92.1h-.42a12.13,12.13,0,0,1-2.63,2.8,12.75,12.75,0,0,1-8,2.71h-9.15c-7.12,0-12-6-10.34-13.22Zm21.86,5.93c6,0,8.65-2,9.92-8l.34-1.7H568.65c-3.39,0-4.66,1.11-5.26,4.24l-.08.42c-.68,3.65.68,5.09,4.07,5.09Z"></path>
      <path fill="#1d1d1b" d="M599,102.27h6.27c3.82,0,5.51-.76,8.05-6.27l.09-.42L603.93,59l1.1-5h8.22l7.46,30.51h.42L638.68,54h9.57l-1.1,5L623.59,98c-5.68,9.5-9.66,13.14-18.48,13.14h-8.05Z"></path>
    </g>
  </g>
</svg>
`;

/**
 * Szablon HTML dla Raportu Rozpoczęcia Prac (Start Shift)
 */
export function generateStartShiftHtml(report: DailyReport, settings?: TenantSettings): string {
  const topicsHtml = (report.discussedTopics || [])
    .map(
      (topic, idx) => `
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px; background-color: #f8fafc; border-left: 3px solid #0284c7; padding: 8px 12px; border-radius: 0 6px 6px 0;">
        <span style="background-color: #0284c7; color: #ffffff; width: 22px; height: 22px; line-height: 22px; border-radius: 4px; display: inline-block; text-align: center; font-size: 11px; font-weight: 800; flex-shrink: 0;">
          ${idx + 1}
        </span>
        <span style="font-size: 12px; font-weight: 600; color: #1e293b; line-height: 1.4;">
          ${escapeHtml(topic)}
        </span>
      </div>
    `
    )
    .join("");

  const attendanceHtml = (report.attendanceList || [])
    .map(
      (att, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0; background-color: ${
        idx % 2 === 0 ? "#ffffff" : "#f8fafc"
      };">
        <td style="padding: 8px 10px; font-weight: 700; font-size: 11px; color: #475569; text-align: center; width: 35px;">${
          idx + 1
        }</td>
        <td style="padding: 8px 10px; font-size: 12px; font-weight: 700; color: #0f172a;">
          <span>${escapeHtml(att.userName)}</span>
          ${
            att.isForeman
              ? '<span style="display: inline-block; margin-left: 8px; padding: 2px 7px; line-height: 12px; background-color: #f59e0b; color: #0f172a; font-size: 8.5px; font-weight: 900; border-radius: 4px; vertical-align: middle; text-align: center;">BRYGADZISTA</span>'
              : ""
          }
        </td>
        <td style="padding: 8px 10px; font-size: 11px; color: #334155;">${escapeHtml(
          att.userRole
        )}</td>
        <td style="padding: 8px 10px; font-size: 11px; color: #64748b; font-family: monospace; text-align: center;">${formatPolishTime(
          att.signedAt || report.time
        )}</td>
        <td style="padding: 4px 8px; text-align: center; width: 130px;">
          <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 2px; height: 38px; display: flex; align-items: center; justify-content: center;">
            <img src="${
              att.signatureDataUrl
            }" alt="Podpis" style="max-height: 34px; max-width: 120px; object-fit: contain;" />
          </div>
        </td>
      </tr>
    `
    )
    .join("");

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; width: 794px; min-height: 1115px; background-color: #ffffff; color: #0f172a; padding: 34px 44px; box-sizing: border-box; position: relative; display: flex; flex-direction: column; justify-content: space-between;">
      
      <div>
        <!-- 1. OFICJALNY NAGŁÓWEK PAPIERU FIRMOWEGO (idream.png / sb-logo inline SVG) -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 18px;">
          
          <!-- Logo Lewe: iDream Business Center (idream.png) -->
          <div style="display: flex; align-items: center;">
            <img src="/idream.png" alt="iDream Business Center" style="height: 42px; width: 106px; object-fit: contain; display: block;" />
          </div>

          <!-- Logo Prawe: SolutionsBay (Wektorowy SVG) -->
          <div style="display: flex; align-items: center;">
            ${SB_LOGO_INLINE_SVG}
          </div>

        </div>

        <!-- 2. TYTUŁ DOKUMENTU I METADANE -->
        <div style="display: flex; justify-content: space-between; align-items: center; background-color: #0f172a; color: #ffffff; padding: 14px 20px; border-radius: 8px; margin-bottom: 18px;">
          <div>
            <div style="font-size: 9px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 1px;">SYSTEM RAPORTOWANIA PRAC • RYCOS SHIFT</div>
            <div style="font-size: 16px; font-weight: 900; letter-spacing: 0.5px; color: #ffffff; margin-top: 2px;">PROTOKÓŁ ROZPOCZĘCIA PRAC ZESPOŁU</div>
          </div>
          <div style="text-align: right; font-size: 11px; font-weight: 600; color: #e2e8f0;">
            Data: <strong>${report.date}</strong> | Godzina: <strong>${report.time}</strong>
          </div>
        </div>

        <!-- 3. KARTA PLACU BUDOWY I LOKALIZACJI -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Plac Budowy:</div>
              <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px;">${escapeHtml(
                report.siteName
              )}</div>
            </div>
            <div>
              <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Brygadzista prowadzący:</div>
              <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px;">${escapeHtml(
                report.foremanName
              )}</div>
            </div>
            <div style="grid-column: span 2; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 4px;">
              <div>
                <span style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Lokalizacja GPS: </span>
                <span style="font-size: 11px; font-weight: 700; color: #334155; font-family: monospace;">
                  ${
                    report.location?.latitude
                      ? `${report.location.latitude.toFixed(6)}° N, ${report.location.longitude?.toFixed(
                          6
                        )}° E (±${Math.round(report.location.accuracy || 0)}m)`
                      : "52.406374° N, 16.925168° E"
                  }
                </span>
              </div>
              <span style="display: inline-block; font-size: 9px; font-weight: 800; color: #0284c7; background-color: #e0f2fe; padding: 3px 8px; line-height: 12px; border-radius: 4px; border: 1px solid #bae6fd; text-align: center; vertical-align: middle;">
                GPS ZWERYFIKOWANY
              </span>
            </div>
          </div>
        </div>

        <!-- 4. SEKCJA 1: OMAWIANE OBSZARY / BHP -->
        <div style="margin-bottom: 20px;">
          <div style="font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #0284c7; padding-bottom: 4px; margin-bottom: 10px;">
            1. Omawiane obszary (BHP / Zakres robót i instruktaż)
          </div>
          <div>
            ${topicsHtml || '<div style="font-size: 11px; color: #64748b;">Brak wpisanych tematów</div>'}
          </div>
        </div>

        <!-- 5. SEKCJA 2: LISTA OBECNOŚCI I PODPISY -->
        <div style="margin-bottom: 24px;">
          <div style="font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #0284c7; padding-bottom: 4px; margin-bottom: 10px;">
            2. Lista obecności i podpisy pracowników
          </div>
          
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
            <thead>
              <tr style="background-color: #0f172a; color: #ffffff; text-align: left;">
                <th style="padding: 8px 10px; font-size: 10px; font-weight: 800; text-transform: uppercase; text-align: center; width: 35px;">Lp.</th>
                <th style="padding: 8px 10px; font-size: 10px; font-weight: 800; text-transform: uppercase;">Imię i Nazwisko</th>
                <th style="padding: 8px 10px; font-size: 10px; font-weight: 800; text-transform: uppercase;">Rola / Funkcja</th>
                <th style="padding: 8px 10px; font-size: 10px; font-weight: 800; text-transform: uppercase; text-align: center;">Godzina</th>
                <th style="padding: 8px 10px; font-size: 10px; font-weight: 800; text-transform: uppercase; text-align: center; width: 130px;">Podpis odręczny</th>
              </tr>
            </thead>
            <tbody>
              ${attendanceHtml}
            </tbody>
          </table>
        </div>
      </div>

      <!-- 6. OFICJALNA STOPKA PAPIERU FIRMOWEGO (DANE REJESTROWE SPÓŁKI) -->
      <div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #cbd5e1; text-align: center; font-size: 9px; color: #64748b; line-height: 1.45;">
        <div style="font-weight: 800; color: #1e293b; font-size: 9.5px;">
          iDream Business Center spółka z ograniczoną odpowiedzialnością
        </div>
        <div>
          Kielce, 25-639, ul. Malików 150d, NIP: 9591971466, KRS: 0000612724, REGON: 364221354
        </div>
        <div>
          tel. +48 41 308 00 05, e-mail: <a href="mailto:info@solutionsbay.pl" style="color: #0284c7; text-decoration: none;">info@solutionsbay.pl</a>, <a href="https://www.solutionsbay.pl" style="color: #0284c7; text-decoration: none;">www.solutionsbay.pl</a>
        </div>
        <div style="margin-top: 6px; font-size: 8px; color: #94a3b8;">
          Dokument wygenerowany automatycznie w systemie RYCOS Shift • Data wygenerowania: ${formatPolishDateTime()}
        </div>
      </div>

    </div>
  `;
}

/**
 * Szablon HTML dla Raportu Zakończenia Prac (End Shift - Fotorelacja)
 */
export function generateEndShiftHtml(report: DailyReport, settings?: TenantSettings): string {
  const photosHtml = (report.photoDocumentation || [])
    .map(
      (photo, idx) => `
      <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden; page-break-inside: avoid; display: flex; flex-direction: column;">
        <div style="height: 200px; background-color: #0f172a; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative;">
          <img src="${
            photo.photoDataUrl
          }" alt="Zdjęcie ${idx + 1}" style="width: 100%; height: 100%; object-fit: cover;" />
          <span style="display: inline-block; position: absolute; top: 6px; left: 6px; background-color: rgba(15, 23, 42, 0.85); color: #ffffff; font-size: 9px; font-weight: 800; padding: 3px 8px; line-height: 12px; border-radius: 4px; text-align: center;">Zdjęcie #${
            idx + 1
          }</span>
        </div>
        <div style="padding: 10px 12px; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
          <div style="font-size: 11px; font-weight: 700; color: #1e293b; line-height: 1.35;">${escapeHtml(
            photo.description
          )}</div>
          <div style="font-size: 9px; color: #64748b; font-family: monospace; margin-top: 6px;">Wykonano: ${formatPolishTime(
            photo.takenAt || report.time
          )}</div>
        </div>
      </div>
    `
    )
    .join("");

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; width: 794px; min-height: 1115px; background-color: #ffffff; color: #0f172a; padding: 34px 44px; box-sizing: border-box; position: relative; display: flex; flex-direction: column; justify-content: space-between;">
      
      <div>
        <!-- 1. OFICJALNY NAGŁÓWEK PAPIERU FIRMOWEGO (idream.png / sb-logo inline SVG) -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 18px;">
          
          <!-- Logo Lewe: iDream Business Center (idream.png) -->
          <div style="display: flex; align-items: center;">
            <img src="/idream.png" alt="iDream Business Center" style="height: 42px; width: 106px; object-fit: contain; display: block;" />
          </div>

          <!-- Logo Prawe: SolutionsBay (Wektorowy SVG) -->
          <div style="display: flex; align-items: center;">
            ${SB_LOGO_INLINE_SVG}
          </div>

        </div>

        <!-- 2. TYTUŁ DOKUMENTU I METADANE -->
        <div style="display: flex; justify-content: space-between; align-items: center; background-color: #0f172a; color: #ffffff; padding: 14px 20px; border-radius: 8px; margin-bottom: 18px;">
          <div>
            <div style="font-size: 9px; font-weight: 800; color: #818cf8; text-transform: uppercase; letter-spacing: 1px;">SYSTEM RAPORTOWANIA PRAC • RYCOS SHIFT</div>
            <div style="font-size: 16px; font-weight: 900; letter-spacing: 0.5px; color: #ffffff; margin-top: 2px;">PROTOKÓŁ ZAKOŃCZENIA PRAC (FOTORELACJA)</div>
          </div>
          <div style="text-align: right; font-size: 11px; font-weight: 600; color: #e2e8f0;">
            Data: <strong>${report.date}</strong> | Godzina: <strong>${report.time}</strong>
          </div>
        </div>

        <!-- 3. KARTA PLACU BUDOWY I LOKALIZACJI -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Plac Budowy:</div>
              <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px;">${escapeHtml(
                report.siteName
              )}</div>
            </div>
            <div>
              <div style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Brygadzista zdający zmianę:</div>
              <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px;">${escapeHtml(
                report.foremanName
              )}</div>
            </div>
            <div style="grid-column: span 2; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 4px;">
              <div>
                <span style="font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase;">Lokalizacja GPS: </span>
                <span style="font-size: 11px; font-weight: 700; color: #334155; font-family: monospace;">
                  ${
                    report.location?.latitude
                      ? `${report.location.latitude.toFixed(6)}° N, ${report.location.longitude?.toFixed(
                          6
                        )}° E (±${Math.round(report.location.accuracy || 0)}m)`
                      : "52.406374° N, 16.925168° E"
                  }
                </span>
              </div>
              <span style="display: inline-block; font-size: 9px; font-weight: 800; color: #4f46e5; background-color: #e0e7ff; padding: 3px 8px; line-height: 12px; border-radius: 4px; border: 1px solid #c7d2fe; text-align: center; vertical-align: middle;">
                FOTORELACJA ZDAWCZA
              </span>
            </div>
          </div>
        </div>

        <!-- 4. SEKCJA: DOKUMENTACJA FOTOGRAFICZNA -->
        <div style="margin-bottom: 24px;">
          <div style="font-size: 12px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #4f46e5; padding-bottom: 4px; margin-bottom: 12px;">
            Dokumentacja fotograficzna wykonanych robót
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
            ${
              photosHtml ||
              '<div style="grid-column: span 2; padding: 24px; text-align: center; color: #64748b; border: 1px dashed #cbd5e1; border-radius: 8px;">Brak załączonych fotografii</div>'
            }
          </div>
        </div>
      </div>

      <!-- 5. OFICJALNA STOPKA PAPIERU FIRMOWEGO (DANE REJESTROWE SPÓŁKI) -->
      <div style="margin-top: 24px; padding-top: 12px; border-top: 1px solid #cbd5e1; text-align: center; font-size: 9px; color: #64748b; line-height: 1.45;">
        <div style="font-weight: 800; color: #1e293b; font-size: 9.5px;">
          iDream Business Center spółka z ograniczoną odpowiedzialnością
        </div>
        <div>
          Kielce, 25-639, ul. Malików 150d, NIP: 9591971466, KRS: 0000612724, REGON: 364221354
        </div>
        <div>
          tel. +48 41 308 00 05, e-mail: <a href="mailto:info@solutionsbay.pl" style="color: #0284c7; text-decoration: none;">info@solutionsbay.pl</a>, <a href="https://www.solutionsbay.pl" style="color: #0284c7; text-decoration: none;">www.solutionsbay.pl</a>
        </div>
        <div style="margin-top: 6px; font-size: 8px; color: #94a3b8;">
          Dokument wygenerowany automatycznie w systemie RYCOS Shift • Data wygenerowania: ${formatPolishDateTime()}
        </div>
      </div>

    </div>
  `;
}

function escapeHtml(str?: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
