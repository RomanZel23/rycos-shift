import { DailyReport, TenantSettings } from "@/types";
import { formatPolishTime, formatPolishDateTime } from "./date-utils";

/**
 * Szablon HTML dla Raportu Rozpoczęcia Prac (Start Shift)
 * Odwzorowuje oficjalny papier firmowy z plikami graficznymi /idream.png i /sb-logo.svg
 */
export function generateStartShiftHtml(report: DailyReport, settings?: TenantSettings): string {
  const topicsHtml = (report.discussedTopics || [])
    .map(
      (topic, idx) => `
      <div style="display: flex; align-items: flex-start; gap: 10px; margin-bottom: 8px; background-color: #f8fafc; border-left: 3px solid #0284c7; padding: 8px 12px; border-radius: 0 6px 6px 0;">
        <span style="background-color: #0284c7; color: #ffffff; width: 20px; height: 20px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; flex-shrink: 0; margin-top: 1px;">
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
          ${escapeHtml(att.userName)}
          ${
            att.isForeman
              ? '<span style="display: inline-block; margin-left: 6px; padding: 2px 6px; background-color: #f59e0b; color: #0f172a; font-size: 8px; font-weight: 800; border-radius: 4px;">BRYGADZISTA</span>'
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
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; width: 794px; min-height: 1123px; background-color: #ffffff; color: #0f172a; padding: 36px 44px; box-sizing: border-box; position: relative; display: flex; flex-direction: column; justify-content: space-between;">
      
      <div>
        <!-- 1. OFICJALNY NAGŁÓWEK PAPIERU FIRMOWEGO (idream.png / sb-logo.svg) -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px;">
          
          <!-- Logo Lewe: iDream Business Center (idream.png) -->
          <div style="display: flex; align-items: center;">
            <img src="/idream.png" alt="iDream Business Center" style="height: 38px; max-width: 230px; object-fit: contain; display: block;" />
          </div>

          <!-- Logo Prawe: SolutionsBay (sb-logo.svg) -->
          <div style="display: flex; align-items: center;">
            <img src="/sb-logo.svg" alt="SolutionsBay" style="height: 32px; max-width: 220px; object-fit: contain; display: block;" />
          </div>

        </div>

        <!-- 2. TYTUŁ DOKUMENTU I METADANE -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; background-color: #0f172a; color: #ffffff; padding: 14px 20px; border-radius: 8px; margin-bottom: 18px;">
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
              <span style="font-size: 9px; font-weight: 800; color: #0284c7; background-color: #e0f2fe; padding: 2px 8px; border-radius: 4px; border: 1px solid #bae6fd;">
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
 * Odwzorowuje oficjalny papier firmowy z plikami graficznymi /idream.png i /sb-logo.svg
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
          <span style="position: absolute; top: 6px; left: 6px; background-color: rgba(15, 23, 42, 0.85); color: #ffffff; font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px;">Zdjęcie #${
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
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; width: 794px; min-height: 1123px; background-color: #ffffff; color: #0f172a; padding: 36px 44px; box-sizing: border-box; position: relative; display: flex; flex-direction: column; justify-content: space-between;">
      
      <div>
        <!-- 1. OFICJALNY NAGŁÓWEK PAPIERU FIRMOWEGO (idream.png / sb-logo.svg) -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px;">
          
          <!-- Logo Lewe: iDream Business Center (idream.png) -->
          <div style="display: flex; align-items: center;">
            <img src="/idream.png" alt="iDream Business Center" style="height: 38px; max-width: 230px; object-fit: contain; display: block;" />
          </div>

          <!-- Logo Prawe: SolutionsBay (sb-logo.svg) -->
          <div style="display: flex; align-items: center;">
            <img src="/sb-logo.svg" alt="SolutionsBay" style="height: 32px; max-width: 220px; object-fit: contain; display: block;" />
          </div>

        </div>

        <!-- 2. TYTUŁ DOKUMENTU I METADANE -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; background-color: #0f172a; color: #ffffff; padding: 14px 20px; border-radius: 8px; margin-bottom: 18px;">
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
              <span style="font-size: 9px; font-weight: 800; color: #4f46e5; background-color: #e0e7ff; padding: 2px 8px; border-radius: 4px; border: 1px solid #c7d2fe;">
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
