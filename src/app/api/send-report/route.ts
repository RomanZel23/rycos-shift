import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      pdfBase64,
      fileName,
      reportType,
      siteName,
      date,
      time,
      recipients,
      apiKey,
      fromEmail,
      foremanName,
    } = body;

    // Pobierz oficjalny adres nadawcy oraz aktualną listę odbiorców z bazy Supabase (nadrzędne źródło prawdy)
    let configuredFromEmail = "";
    let configuredRecipients: string[] = [];
    if (isSupabaseConfigured()) {
      try {
        const supabase = getSupabaseClient();
        if (supabase) {
          const { data: dbSettings } = await supabase
            .from("tenant_settings")
            .select("resend_from_email, start_shift_email_recipients, end_shift_email_recipients")
            .limit(1)
            .maybeSingle();
          if (dbSettings) {
            if (dbSettings.resend_from_email) {
              configuredFromEmail = dbSettings.resend_from_email.trim();
            }
            const dbList =
              reportType === "START_SHIFT"
                ? dbSettings.start_shift_email_recipients
                : dbSettings.end_shift_email_recipients;
            if (Array.isArray(dbList) && dbList.length > 0) {
              configuredRecipients = dbList;
            }
          }
        }
      } catch (dbErr) {
        console.warn("Could not query tenant_settings in send-report:", dbErr);
      }
    }

    const resendApiKey = apiKey || process.env.RESEND_API_KEY;
    
    // Ustal adres nadawcy ze zweryfikowaną w Resend domeną shift.rycos.eu
    let effectiveFromEmail =
      configuredFromEmail ||
      process.env.RESEND_FROM_EMAIL ||
      fromEmail ||
      "raporty@shift.rycos.eu";

    // Zabezpieczenie: jeśli telefon przesłał starą, niezweryfikowaną domenę solutionsbay.pl
    if (effectiveFromEmail.includes("solutionsbay.pl") || !effectiveFromEmail.includes("@")) {
      effectiveFromEmail = "raporty@shift.rycos.eu";
    }

    // Ustalenie odbiorców e-mail:
    // Jeśli przesłano stare/testowe adresy (raporty-start@solutionsbay.pl) lub puste,
    // automatycznie użyj aktualnych odbiorców zapisanych w bazie Supabase
    let effectiveRecipients = Array.isArray(recipients) ? recipients : [];
    const hasLegacyRecipients = effectiveRecipients.some(
      (r) =>
        r.includes("raporty-start@solutionsbay.pl") ||
        r.includes("raporty-koniec@solutionsbay.pl") ||
        r.includes("kierownik.budowy@solutionsbay.pl")
    );

    if ((effectiveRecipients.length === 0 || hasLegacyRecipients) && configuredRecipients.length > 0) {
      effectiveRecipients = configuredRecipients;
    }

    const reportTypeName =
      reportType === "START_SHIFT"
        ? "Rozpoczęcie prac zespołu"
        : "Zakończenie prac zespołu (Fotorelacja)";

    const emailSubject = `[RYCOS Shift] ${reportTypeName} - ${siteName} (${date})`;

    if (!effectiveRecipients || effectiveRecipients.length === 0) {
      return NextResponse.json(
        { success: false, message: "Brak zdefiniowanych odbiorców e-mail" },
        { status: 400 }
      );
    }

    // Jeśli brak klucza API, symulujemy pomyślną wysyłkę z informacją dla użytkownika
    if (!resendApiKey) {
      return NextResponse.json({
        success: true,
        simulated: true,
        message: `Raport wygenerowany pomyślnie. W trybie demo/testowym zasymulowano wysyłkę do: ${effectiveRecipients.join(", ")}. Aby wysyłać realne wiadomości, dodaj klucz Resend API w zakładce Ustawienia lub pliku .env.local.`,
      });
    }

    const resend = new Resend(resendApiKey);

    // Przygotuj załącznik z Base64 lub pobierz z Storage Bucket URL
    let pdfBuffer: Buffer;
    if (typeof pdfBase64 === "string" && (pdfBase64.startsWith("http://") || pdfBase64.startsWith("https://"))) {
      const pdfFetch = await fetch(pdfBase64);
      if (!pdfFetch.ok) {
        throw new Error(`Nie udało się pobrać pliku PDF z chmury Storage: ${pdfFetch.statusText}`);
      }
      const arrayBuf = await pdfFetch.arrayBuffer();
      pdfBuffer = Buffer.from(arrayBuf);
    } else {
      const cleanBase64 = typeof pdfBase64 === "string" && pdfBase64.includes("base64,")
        ? pdfBase64.split("base64,")[1]
        : pdfBase64 || "";
      pdfBuffer = Buffer.from(cleanBase64, "base64");
    }

    // 1. Wersja tekstowa (Plain Text Fallback) - kluczowa dla Outlooka i filtrów antyspamowych
    const textContent = `
SB TECHNOLOGY | RYCOS Shift
Oficjalny Raport Dzienny Prac Budowlanych

Typ dokumentu: ${reportTypeName}
Plac Budowy: ${siteName}
Brygadzista: ${foremanName}
Data i godzina: ${date} | ${time}

W załączniku niniejszej wiadomości znajduje się oficjalny dokument raportu dziennego w formacie PDF: ${fileName}
Zawiera:
- Listę obecności pracowników oraz ich odręczne podpisy cyfrowe
- Tematykę instruktażu BHP i zakres robót
- Dokumentację fotograficzną wykonanych prac
- Zweryfikowane koordynaty GPS placu budowy

---
Wiadomość wygenerowana automatycznie przez system RYCOS Shift dla iDream Business Center / SolutionsBay Sp. z o.o.
Prosimy nie odpowiadać bezpośrednio na ten adres e-mail.
    `.trim();

    // 2. Wersja HTML (Bulletproof Email HTML z pełnym DOCTYPE i tabelami kompatybilnymi z Outlook/Gmail/Apple Mail)
    const htmlContent = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="pl">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${emailSubject}</title>
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
      <!-- NAGŁÓWEK FIRMOWY -->
      <tr>
        <td style="background-color: #0f172a; padding: 24px 28px; text-align: left;">
          <div style="font-size: 10px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 4px;">
            SYSTEM RAPORTOWANIA PRAC • RYCOS SHIFT
          </div>
          <div style="font-size: 20px; font-weight: 900; color: #ffffff; letter-spacing: 0.5px;">
            iDream / SolutionsBay
          </div>
          <div style="font-size: 13px; color: #94a3b8; margin-top: 4px;">
            ${reportTypeName}
          </div>
        </td>
      </tr>

      <!-- TREŚĆ GŁÓWNA -->
      <tr>
        <td style="padding: 28px; color: #1e293b;">
          <h2 style="margin: 0 0 16px 0; font-size: 17px; font-weight: 800; color: #0f172a;">
            Podsumowanie raportu z budowy
          </h2>

          <!-- TABELA DANYCH (KOMPATYBILNA Z OUTLOOKIEM) -->
          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 20px; background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0;">
            <tr>
              <td style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #64748b; width: 130px; border-bottom: 1px solid #e2e8f0;">
                Plac Budowy:
              </td>
              <td style="padding: 10px 14px; font-size: 13px; font-weight: 800; color: #0f172a; border-bottom: 1px solid #e2e8f0;">
                ${siteName}
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #64748b; border-bottom: 1px solid #e2e8f0;">
                Brygadzista:
              </td>
              <td style="padding: 10px 14px; font-size: 13px; font-weight: 800; color: #0f172a; border-bottom: 1px solid #e2e8f0;">
                ${foremanName}
              </td>
            </tr>
            <tr>
              <td style="padding: 10px 14px; font-size: 12px; font-weight: 700; color: #64748b;">
                Data i godzina:
              </td>
              <td style="padding: 10px 14px; font-size: 13px; font-weight: 800; color: #0f172a;">
                ${date} • ${time}
              </td>
            </tr>
          </table>

          <p style="font-size: 13px; line-height: 1.6; color: #334155; margin: 0 0 18px 0;">
            W załączniku wiadomości przesłano oficjalny dokument protokołu dziennego w formacie <strong>PDF</strong>. Raport zawiera zweryfikowane koordynaty GPS, listę obecności z odręcznymi podpisami pracowników oraz kompletną fotorelację.
          </p>

          <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; border-left: 4px solid #0284c7; border-radius: 0 6px 6px 0; margin-bottom: 10px;">
            <tr>
              <td style="padding: 12px 16px; font-size: 12px; color: #334155;">
                📎 Załączony plik PDF: <strong>${fileName}</strong><br/>
                🔒 Status: Wygenerowano automatycznie i podpisano w terenie.
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- STOPKA -->
      <tr>
        <td style="background-color: #f8fafc; padding: 18px 24px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; color: #64748b; line-height: 1.5;">
          <strong>iDream Business Center • SolutionsBay Sp. z o.o.</strong><br/>
          Wiadomość wygenerowana automatycznie przez system RYCOS Shift.<br/>
          Prosimy nie odpowiadać na tę wiadomość e-mail.
        </td>
      </tr>
    </table>
  </center>
</body>
</html>
    `.trim();

    // Wysyłka z równoczesną częścią HTML oraz Text (pełna specyfikacja MIME multipart/alternative)
    const { data, error } = await resend.emails.send({
      from: `RYCOS Shift <${effectiveFromEmail}>`,
      to: effectiveRecipients,
      subject: emailSubject,
      text: textContent,
      html: htmlContent,
      attachments: [
        {
          filename: fileName,
          content: pdfBuffer,
        },
      ],
    });

    if (error) {
      console.error("Resend API error:", error);
      return NextResponse.json(
        {
          success: false,
          message: `Błąd Resend API: ${error.message}`,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: `Raport został pomyślnie wysłany na adresy: ${effectiveRecipients.join(", ")}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Wystąpił nieoczekiwany błąd podczas wysyłki";
    console.error("Email send error:", err);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
