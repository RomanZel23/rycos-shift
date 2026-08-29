import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

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

    const resendApiKey = apiKey || process.env.RESEND_API_KEY;
    const effectiveFromEmail = fromEmail || process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

    const reportTypeName =
      reportType === "START_SHIFT"
        ? "Rozpoczęcie prac zespołu"
        : "Zakończenie prac zespołu";

    const emailSubject = `[RYCOS Shift] ${reportTypeName} - ${siteName} (${date})`;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
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
        message: `Raport wygenerowany pomyślnie. W trybie demo/testowym zasymulowano wysyłkę do: ${recipients.join(", ")}. Aby wysyłać realne wiadomości, dodaj klucz Resend API w zakładce Ustawienia lub pliku .env.local.`,
      });
    }

    const resend = new Resend(resendApiKey);

    // Przygotuj załącznik z Base64
    const cleanBase64 = pdfBase64.includes("base64,")
      ? pdfBase64.split("base64,")[1]
      : pdfBase64;
    const pdfBuffer = Buffer.from(cleanBase64, "base64");

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #0f172a; padding: 20px; color: #ffffff;">
          <h2 style="margin: 0; font-size: 20px; color: #ffffff;">SB TECHNOLOGY | RYCOS Shift</h2>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8;">Raport dzienny prac budowlanych</p>
        </div>
        <div style="padding: 24px; background-color: #ffffff;">
          <h3 style="margin-top: 0; color: #0f172a; font-size: 18px;">${reportTypeName}</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; width: 140px;"><strong>Plac Budowy:</strong></td>
              <td style="padding: 8px 0; color: #0f172a;">${siteName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;"><strong>Brygadzista:</strong></td>
              <td style="padding: 8px 0; color: #0f172a;">${foremanName}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;"><strong>Data i godzina:</strong></td>
              <td style="padding: 8px 0; color: #0f172a;">${date} ${time}</td>
            </tr>
          </table>
          <p style="font-size: 14px; color: #334155; line-height: 1.5;">
            W załączniku znajduje się oficjalny dokument raportu dziennego w formacie PDF (zawierający listy obecności, podpisy odręczne, dokumentację fotograficzną oraz koordynaty GPS).
          </p>
          <div style="margin-top: 24px; padding: 12px; background-color: #f8fafc; border-radius: 6px; font-size: 12px; color: #64748b;">
            Plik: <strong>${fileName}</strong><br />
            Status: Wygenerowano i podpisano cyfrowo w terenie.
          </div>
        </div>
        <div style="background-color: #f1f5f9; padding: 12px 24px; font-size: 11px; color: #64748b; text-align: center;">
          Wiadomość wygenerowana automatycznie przez system RYCOS Shift dla SolutionsBay. Prosimy nie odpowiadać bezpośrednio na tę wiadomość.
        </div>
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: `RYCOS Shift <${effectiveFromEmail}>`,
      to: recipients,
      subject: emailSubject,
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
      message: `Raport został pomyślnie wysłany na adresy: ${recipients.join(", ")}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Wystąpił nieoczekiwany błąd podczas wysyłki";
    console.error("Email send error:", err);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
