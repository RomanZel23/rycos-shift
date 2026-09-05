import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizePdfFileName } from "./pdf-generator";

/**
 * Etap 2 — wysyłka raportów w całości po stronie serwera.
 *
 * Kluczowa zmiana względem poprzedniej wersji: ani lista odbiorców, ani adres
 * nadawcy, ani klucz Resend nie pochodzą już z żądania. Wcześniej klient mógł
 * podstawić dowolne `recipients` i dowolny `apiKey`, co czyniło z endpointu
 * relay pocztowy działający na zweryfikowanej domenie firmy.
 */

export type ReportTypeName = "START_SHIFT" | "END_SHIFT";

export interface EmailConfig {
  from: string;
  recipients: string[];
  apiKey: string;
}

export interface ReportEmailFacts {
  reportType: ReportTypeName;
  siteName: string;
  foremanName: string;
  date: string;
  time: string;
  fileName: string;
}

const DEFAULT_FROM = "raporty@shift.rycos.eu";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Escapowanie do treści HTML. Wcześniej nazwy placów i brygadzistów szły surowo. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Usuwa znaki, którymi dałoby się wstrzyknąć dodatkowe nagłówki MIME. */
function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/**
 * Ustala konfigurację wysyłki wyłącznie ze źródeł serwerowych:
 * tabela tenant_settings, a w drugiej kolejności zmienne środowiskowe.
 */
export async function resolveEmailConfig(
  supabase: SupabaseClient | null,
  reportType: ReportTypeName
): Promise<EmailConfig> {
  let from = "";
  let recipients: string[] = [];

  if (supabase) {
    try {
      const { data } = await supabase
        .from("tenant_settings")
        .select("resend_from_email, start_shift_email_recipients, end_shift_email_recipients")
        .limit(1)
        .maybeSingle();

      if (data) {
        if (typeof data.resend_from_email === "string") from = data.resend_from_email.trim();
        const list =
          reportType === "START_SHIFT"
            ? data.start_shift_email_recipients
            : data.end_shift_email_recipients;
        if (Array.isArray(list)) recipients = list;
      }
    } catch (err) {
      console.warn("Nie udało się odczytać tenant_settings:", err);
    }
  }

  if (!from) from = (process.env.RESEND_FROM_EMAIL || "").trim();
  if (!from || !EMAIL_PATTERN.test(from)) from = DEFAULT_FROM;

  const cleanRecipients = recipients
    .filter((r): r is string => typeof r === "string")
    .map((r) => r.trim())
    .filter((r) => EMAIL_PATTERN.test(r));

  return {
    from,
    recipients: Array.from(new Set(cleanRecipients)),
    apiKey: (process.env.RESEND_API_KEY || "").trim(),
  };
}

export function reportTypeLabel(reportType: ReportTypeName): string {
  return reportType === "START_SHIFT"
    ? "Rozpoczęcie prac zespołu"
    : "Zakończenie prac zespołu (Fotorelacja)";
}

export function buildReportEmail(facts: ReportEmailFacts) {
  const typeName = reportTypeLabel(facts.reportType);
  const attachmentName = sanitizePdfFileName(
    facts.fileName || `Raport_${facts.reportType}_${facts.date}.pdf`
  );
  const subject = sanitizeHeaderValue(
    `[RYCOS Shift] ${typeName} - ${facts.siteName} (${facts.date})`
  );

  const text = `
SB TECHNOLOGY | RYCOS Shift
Oficjalny Raport Dzienny Prac Budowlanych

Typ dokumentu: ${typeName}
Plac Budowy: ${facts.siteName}
Brygadzista: ${facts.foremanName}
Data i godzina: ${facts.date} | ${facts.time}

W załączniku znajduje się oficjalny dokument raportu dziennego w formacie PDF: ${attachmentName}
Zawiera:
- Listę obecności pracowników oraz ich odręczne podpisy cyfrowe
- Tematykę instruktażu BHP i zakres robót
- Dokumentację fotograficzną wykonanych prac
- Zweryfikowane koordynaty GPS placu budowy

---
Wiadomość wygenerowana automatycznie przez system RYCOS Shift dla iDream Business Center / SolutionsBay Sp. z o.o.
Prosimy nie odpowiadać bezpośrednio na ten adres e-mail.
  `.trim();

  const html = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pl">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(subject)}</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  </style>
</head>
<body style="margin: 0; padding: 24px 10px; background-color: #f1f5f9;">
  <center>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
      <tr>
        <td style="background-color: #0f172a; padding: 24px 28px; text-align: left;">
          <div style="font-size: 10px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 4px;">
            SYSTEM RAPORTOWANIA PRAC &bull; RYCOS SHIFT
          </div>
          <div style="font-size: 20px; font-weight: 900; color: #ffffff; letter-spacing: 0.5px;">
            iDream / SolutionsBay
          </div>
          <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">
            ${escapeHtml(typeName)}
          </div>
        </td>
      </tr>

      <tr>
        <td style="padding: 28px; color: #1e293b;">
          <h2 style="margin: 0 0 16px 0; font-size: 17px; font-weight: 800; color: #0f172a;">
            Podsumowanie raportu z budowy
          </h2>

          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
            <tr>
              <td style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #64748b; width: 130px; border-bottom: 1px solid #e2e8f0;">
                Plac Budowy:
              </td>
              <td style="padding: 10px 14px; font-size: 13px; font-weight: 800; color: #0f172a; border-bottom: 1px solid #e2e8f0;">
                ${escapeHtml(facts.siteName)}
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #64748b; border-bottom: 1px solid #e2e8f0;">
                Brygadzista:
              </td>
              <td style="padding: 10px 14px; font-size: 13px; font-weight: 800; color: #0f172a; border-bottom: 1px solid #e2e8f0;">
                ${escapeHtml(facts.foremanName)}
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #64748b;">
                Data i godzina:
              </td>
              <td style="padding: 10px 14px; font-size: 13px; font-weight: 800; color: #0f172a;">
                ${escapeHtml(facts.date)} &bull; ${escapeHtml(facts.time)}
              </td>
            </tr>
          </table>

          <p style="font-size: 13px; line-height: 1.6; color: #334155; margin: 0 0 18px 0;">
            W załączniku przesłano oficjalny dokument protokołu dziennego w formacie <strong>PDF</strong>.
            Raport zawiera zweryfikowane koordynaty GPS, listę obecności z odręcznymi podpisami pracowników
            oraz kompletną fotorelację.
          </p>

          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; border-left: 4px solid #0284c7; border-radius: 0 6px 6px 0; margin-bottom: 10px;">
            <tr>
              <td style="padding: 12px 16px; font-size: 12px; color: #334155;">
                Załączony plik PDF: <strong>${escapeHtml(attachmentName)}</strong><br/>
                Status: Wygenerowano automatycznie i podpisano w terenie.
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <tr>
        <td style="background-color: #f8fafc; padding: 18px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; line-height: 1.5;">
          <strong>iDream Business Center &bull; SolutionsBay Sp. z o.o.</strong><br/>
          Wiadomość wygenerowana automatycznie przez system RYCOS Shift.<br/>
          Prosimy nie odpowiadać na tę wiadomość e-mail.
        </td>
      </tr>
    </table>
  </center>
</body>
</html>
  `.trim();

  return { subject, text, html, attachmentName };
}

export interface SendOutcome {
  ok: boolean;
  /** Kod do rozróżnienia przyczyny po stronie UI. */
  code: "SENT" | "NO_API_KEY" | "NO_RECIPIENTS" | "PROVIDER_ERROR";
  message: string;
  recipients: string[];
}

/**
 * Wysyła raport. Zwraca uczciwy wynik — brak klucza API to porażka, a nie
 * „symulowana wysyłka", jak było wcześniej.
 */
export async function sendReportEmail(
  config: EmailConfig,
  facts: ReportEmailFacts,
  pdf: Buffer
): Promise<SendOutcome> {
  if (config.recipients.length === 0) {
    return {
      ok: false,
      code: "NO_RECIPIENTS",
      message:
        "Raport zapisano, ale nie wysłano: brak listy odbiorców w Ustawieniach.",
      recipients: [],
    };
  }

  if (!config.apiKey) {
    return {
      ok: false,
      code: "NO_API_KEY",
      message:
        "Raport zapisano, ale nie wysłano: serwer nie ma skonfigurowanego klucza RESEND_API_KEY.",
      recipients: config.recipients,
    };
  }

  const { subject, text, html, attachmentName } = buildReportEmail(facts);

  try {
    const resend = new Resend(config.apiKey);
    const { error } = await resend.emails.send({
      from: `RYCOS Shift <${config.from}>`,
      to: config.recipients,
      subject,
      text,
      html,
      attachments: [{ filename: attachmentName, content: pdf }],
    });

    if (error) {
      return {
        ok: false,
        code: "PROVIDER_ERROR",
        message: `Raport zapisano, ale wysyłka nie powiodła się: ${error.message}`,
        recipients: config.recipients,
      };
    }

    return {
      ok: true,
      code: "SENT",
      message: `Raport wysłany do: ${config.recipients.join(", ")}`,
      recipients: config.recipients,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "nieznany błąd";
    return {
      ok: false,
      code: "PROVIDER_ERROR",
      message: `Raport zapisano, ale wysyłka nie powiodła się: ${message}`,
      recipients: config.recipients,
    };
  }
}
