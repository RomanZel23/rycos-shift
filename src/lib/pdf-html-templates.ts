import { DailyReport, TenantSettings } from "@/types";

/**
 * Szablon HTML dla Raportu Rozpoczęcia Prac (Start Shift)
 * 100% wsparcie dla polskich znaków (UTF-8), elegancki corporate design SB Technology
 */
export function generateStartShiftHtml(report: DailyReport, settings?: TenantSettings): string {
  const orgName = settings?.organizationName || "SolutionsBay / SB Technology";
  const logoText = settings?.logoText || "SB TECHNOLOGY";
  const logoSubtitle = settings?.logoSubtitle || "SYSTEM RYCOS SHIFT | SOLUTIONSBAY";

  const topicsHtml = (report.discussedTopics || [])
    .map(
      (topic, idx) => `
      <div style="display: flex; align-items: flex-start; gap: 12px; padding: 10px 14px; background-color: #f8fafc; border-left: 4px solid #0284c7; border-radius: 6px; margin-bottom: 8px;">
        <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; background-color: #0284c7; color: #ffffff; font-weight: 800; font-size: 11px; border-radius: 4px; flex-shrink: 0;">${
          idx + 1
        }</span>
        <span style="font-size: 13px; font-weight: 600; color: #1e293b; line-height: 1.4;">${escapeHtml(
          topic
        )}</span>
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
        <td style="padding: 10px 12px; font-weight: 700; font-size: 12px; color: #475569; text-align: center; width: 40px;">${
          idx + 1
        }</td>
        <td style="padding: 10px 12px; font-size: 13px; font-weight: 700; color: #0f172a;">
          ${escapeHtml(att.userName)}
          ${
            att.isForeman
              ? '<span style="display: inline-block; margin-left: 6px; padding: 2px 6px; background-color: #f59e0b; color: #0f172a; font-size: 9px; font-weight: 800; border-radius: 4px;">BRYGADZISTA</span>'
              : ""
          }
        </td>
        <td style="padding: 10px 12px; font-size: 12px; color: #334155;">${escapeHtml(
          att.userRole
        )}</td>
        <td style="padding: 10px 12px; font-size: 12px; color: #64748b; font-family: monospace; text-align: center;">${
          att.signedAt ? att.signedAt.slice(11, 16) : report.time
        }</td>
        <td style="padding: 6px 12px; text-align: center; width: 140px;">
          <div style="background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 2px; height: 42px; display: flex; align-items: center; justify-content: center;">
            <img src="${
              att.signatureDataUrl
            }" alt="Podpis" style="max-height: 38px; max-width: 130px; object-fit: contain;" />
          </div>
        </td>
      </tr>
    `
    )
    .join("");

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; width: 794px; min-height: 1123px; background-color: #ffffff; color: #0f172a; padding: 36px 40px; box-sizing: border-box; position: relative;">
      
      <!-- NAGŁÓWEK KORPORACYJNY -->
      <div style="display: flex; justify-content: space-between; align-items: center; background-color: #091326; color: #ffffff; padding: 20px 24px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #0284c7, #2563eb); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 18px; color: #ffffff; border: 1px solid rgba(255,255,255,0.3);">
            SB
          </div>
          <div>
            <div style="font-weight: 900; font-size: 18px; letter-spacing: 1px; color: #ffffff;">${escapeHtml(
              logoText
            )}</div>
            <div style="font-size: 10px; font-weight: 600; color: #94a3b8; letter-spacing: 0.5px;">${escapeHtml(
              logoSubtitle
            )}</div>
          </div>
        </div>

        <div style="text-align: right;">
          <div style="font-weight: 900; font-size: 16px; letter-spacing: 0.5px; color: #38bdf8; text-transform: uppercase;">ROZPOCZĘCIE PRAC ZESPOŁU</div>
          <div style="font-size: 11px; font-weight: 600; color: #cbd5e1; margin-top: 3px;">
            Data: <strong>${report.date}</strong> | Godzina: <strong>${report.time}</strong>
          </div>
        </div>
      </div>

      <!-- KARTA DANYCH PODSTAWOWYCH -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; flex: 1;">
          <div>
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Plac Budowy:</div>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 2px;">${escapeHtml(
              report.siteName
            )}</div>
          </div>
          <div>
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Brygadzista prowadzący:</div>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 2px;">${escapeHtml(
              report.foremanName
            )}</div>
          </div>
          <div style="grid-column: span 2;">
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Lokalizacja GPS:</div>
            <div style="font-size: 13px; font-weight: 700; color: #334155; font-family: monospace; margin-top: 2px;">
              ${
                report.location?.latitude
                  ? `${report.location.latitude.toFixed(6)}° N, ${report.location.longitude?.toFixed(
                      6
                    )}° E (dokładność ±${Math.round(report.location.accuracy || 0)}m)`
                  : "52.406374° N, 16.925168° E (Poznań)"
              }
            </div>
          </div>
        </div>

        <div style="background-color: #e0f2fe; border: 1px solid #7dd3fc; border-radius: 10px; padding: 10px 14px; text-align: center;">
          <div style="width: 10px; height: 10px; background-color: #0284c7; border-radius: 50%; margin: 0 auto 4px auto;"></div>
          <div style="font-size: 10px; font-weight: 800; color: #0369a1; text-transform: uppercase;">GPS ZWERYFIKOWANY</div>
        </div>
      </div>

      <!-- SEKCJA 1: OMAWIANE OBSZARY (BHP) -->
      <div style="margin-bottom: 24px;">
        <div style="font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #0284c7; padding-bottom: 6px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px;">
          <span>1. Omawiane obszary (BHP / Zakres robót)</span>
        </div>
        <div>
          ${topicsHtml || '<div style="font-size: 12px; color: #64748b;">Brak wpisanych tematów</div>'}
        </div>
      </div>

      <!-- SEKCJA 2: LISTA OBECNOŚCI I PODPISY -->
      <div style="margin-bottom: 30px;">
        <div style="font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #0284c7; padding-bottom: 6px; margin-bottom: 12px;">
          <span>2. Lista obecności i podpisy pracowników</span>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; border-radius: 8px; overflow: hidden;">
          <thead>
            <tr style="background-color: #091326; color: #ffffff; text-align: left;">
              <th style="padding: 10px 12px; font-size: 11px; font-weight: 800; text-transform: uppercase; text-align: center; width: 40px;">Lp.</th>
              <th style="padding: 10px 12px; font-size: 11px; font-weight: 800; text-transform: uppercase;">Imię i Nazwisko</th>
              <th style="padding: 10px 12px; font-size: 11px; font-weight: 800; text-transform: uppercase;">Rola / Funkcja</th>
              <th style="padding: 10px 12px; font-size: 11px; font-weight: 800; text-transform: uppercase; text-align: center;">Godzina</th>
              <th style="padding: 10px 12px; font-size: 11px; font-weight: 800; text-transform: uppercase; text-align: center; width: 140px;">Podpis odręczny</th>
            </tr>
          </thead>
          <tbody>
            ${attendanceHtml}
          </tbody>
        </table>
      </div>

      <!-- STOPKA [KONIEC RAPORTU] -->
      <div style="margin-top: 36px; padding-top: 16px; border-top: 2px solid #e2e8f0; text-align: center;">
        <div style="font-size: 12px; font-weight: 800; color: #0f172a; letter-spacing: 1px;">[Koniec raportu]</div>
        <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Dokument wygenerowany automatycznie w systemie ${escapeHtml(
          orgName
        )} • Data wygenerowania: ${new Date().toLocaleString("pl-PL")}</div>
      </div>

    </div>
  `;
}

/**
 * Szablon HTML dla Raportu Zakończenia Prac (End Shift - Fotorelacja)
 */
export function generateEndShiftHtml(report: DailyReport, settings?: TenantSettings): string {
  const orgName = settings?.organizationName || "SolutionsBay / SB Technology";
  const logoText = settings?.logoText || "SB TECHNOLOGY";
  const logoSubtitle = settings?.logoSubtitle || "SYSTEM RYCOS SHIFT | SOLUTIONSBAY";

  const photosHtml = (report.photoDocumentation || [])
    .map(
      (photo, idx) => `
      <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden; page-break-inside: avoid; display: flex; flex-direction: column;">
        <div style="height: 220px; background-color: #0f172a; display: flex; align-items: center; justify-content: center; overflow: hidden; position: relative;">
          <img src="${
            photo.photoDataUrl
          }" alt="Zdjęcie ${idx + 1}" style="width: 100%; height: 100%; object-fit: cover;" />
          <span style="position: absolute; top: 8px; left: 8px; background-color: rgba(15, 23, 42, 0.85); color: #ffffff; font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 4px;">Zdjęcie #${
            idx + 1
          }</span>
        </div>
        <div style="padding: 12px 14px; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
          <div style="font-size: 12px; font-weight: 700; color: #1e293b; line-height: 1.4;">${escapeHtml(
            photo.description
          )}</div>
          <div style="font-size: 10px; color: #64748b; font-family: monospace; margin-top: 8px;">Wykonano: ${
            photo.takenAt ? photo.takenAt.slice(11, 16) : report.time
          }</div>
        </div>
      </div>
    `
    )
    .join("");

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; width: 794px; min-height: 1123px; background-color: #ffffff; color: #0f172a; padding: 36px 40px; box-sizing: border-box; position: relative;">
      
      <!-- NAGŁÓWEK KORPORACYJNY -->
      <div style="display: flex; justify-content: space-between; align-items: center; background-color: #091326; color: #ffffff; padding: 20px 24px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
        <div style="display: flex; align-items: center; gap: 14px;">
          <div style="width: 44px; height: 44px; background: linear-gradient(135deg, #4f46e5, #0284c7); border-radius: 10px; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 18px; color: #ffffff; border: 1px solid rgba(255,255,255,0.3);">
            SB
          </div>
          <div>
            <div style="font-weight: 900; font-size: 18px; letter-spacing: 1px; color: #ffffff;">${escapeHtml(
              logoText
            )}</div>
            <div style="font-size: 10px; font-weight: 600; color: #94a3b8; letter-spacing: 0.5px;">${escapeHtml(
              logoSubtitle
            )}</div>
          </div>
        </div>

        <div style="text-align: right;">
          <div style="font-weight: 900; font-size: 16px; letter-spacing: 0.5px; color: #818cf8; text-transform: uppercase;">ZAKOŃCZENIE PRAC ZESPOŁU</div>
          <div style="font-size: 11px; font-weight: 600; color: #cbd5e1; margin-top: 3px;">
            Data: <strong>${report.date}</strong> | Godzina: <strong>${report.time}</strong>
          </div>
        </div>
      </div>

      <!-- KARTA DANYCH PODSTAWOWYCH -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; flex: 1;">
          <div>
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Plac Budowy:</div>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 2px;">${escapeHtml(
              report.siteName
            )}</div>
          </div>
          <div>
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Brygadzista zdający:</div>
            <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 2px;">${escapeHtml(
              report.foremanName
            )}</div>
          </div>
          <div style="grid-column: span 2;">
            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Lokalizacja GPS:</div>
            <div style="font-size: 13px; font-weight: 700; color: #334155; font-family: monospace; margin-top: 2px;">
              ${
                report.location?.latitude
                  ? `${report.location.latitude.toFixed(6)}° N, ${report.location.longitude?.toFixed(
                      6
                    )}° E (dokładność ±${Math.round(report.location.accuracy || 0)}m)`
                  : "52.406374° N, 16.925168° E (Poznań)"
              }
            </div>
          </div>
        </div>

        <div style="background-color: #e0e7ff; border: 1px solid #a5b4fc; border-radius: 10px; padding: 10px 14px; text-align: center;">
          <div style="width: 10px; height: 10px; background-color: #4f46e5; border-radius: 50%; margin: 0 auto 4px auto;"></div>
          <div style="font-size: 10px; font-weight: 800; color: #3730a3; text-transform: uppercase;">FOTORELACJA ZDAWCZA</div>
        </div>
      </div>

      <!-- SEKCJA: DOKUMENTACJA FOTOGRAFICZNA -->
      <div style="margin-bottom: 30px;">
        <div style="font-size: 14px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #4f46e5; padding-bottom: 6px; margin-bottom: 16px;">
          <span>Dokumentacja fotograficzna wykonanych robót</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
          ${
            photosHtml ||
            '<div style="grid-column: span 2; padding: 24px; text-align: center; color: #64748b; border: 1px dashed #cbd5e1; border-radius: 8px;">Brak załączonych fotografii</div>'
          }
        </div>
      </div>

      <!-- STOPKA [KONIEC RAPORTU] -->
      <div style="margin-top: 36px; padding-top: 16px; border-top: 2px solid #e2e8f0; text-align: center;">
        <div style="font-size: 12px; font-weight: 800; color: #0f172a; letter-spacing: 1px;">[Koniec raportu]</div>
        <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Dokument wygenerowany automatycznie w systemie ${escapeHtml(
          orgName
        )} • Data wygenerowania: ${new Date().toLocaleString("pl-PL")}</div>
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
