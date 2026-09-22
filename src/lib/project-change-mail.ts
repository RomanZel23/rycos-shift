import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChangeDecision, ProjectChange } from "@/types";
import { BUCKET_NAME } from "./storage-paths";
import { escapeHtml, resolveEmailConfig } from "./email";
import { generateProjectChangeHtml } from "./pdf-html-templates";
import { renderHtmlToPdf } from "./pdf-renderer";
import { loadExoFontFaceCss, loadLogoDataUrl } from "./pdf-assets";
import { sanitizePdfFileName } from "./pdf-generator";
import { changePdfFileName, changeStatusLabel, decisionLabel } from "./project-change";
import {
  CHANGE_DECISIONS_TABLE,
  appBaseUrl,
  changeLinkUrl,
  generateLinkToken,
} from "./project-change-server";

/**
 * Rejestr zmian — dokument PDF karty i wiadomości e-mail.
 */

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

async function downloadAsDataUrl(
  supabase: SupabaseClient,
  path: string | undefined,
  contentType: string
): Promise<string> {
  if (!path) return "";
  const { data } = await supabase.storage.from(BUCKET_NAME).download(path);
  if (!data) return "";
  const bytes = Buffer.from(await data.arrayBuffer());
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}

/** Ścieżka w buckecie z adresu /api/files?path=… */
function pathFromUrl(url?: string): string | undefined {
  if (!url) return undefined;
  const i = url.indexOf("?");
  if (i < 0) return undefined;
  return new URLSearchParams(url.slice(i + 1)).get("path") || undefined;
}

/** Aktualny stan karty jako PDF — treść, decyzje, podpisy, historia wersji. */
export async function renderChangePdf(
  supabase: SupabaseClient,
  change: ProjectChange
): Promise<{ buffer: Buffer; fileName: string }> {
  const photos = [...change.current.photos, ...change.target.photos];
  const photoEntries = await Promise.all(
    photos.map(async (p) => [p.id, await downloadAsDataUrl(supabase, p.path, "image/jpeg")] as const)
  );
  const decisions = [...change.decisions, ...change.history];
  const sigEntries = await Promise.all(
    decisions.map(
      async (d) =>
        [d.id, await downloadAsDataUrl(supabase, pathFromUrl(d.signatureUrl), "image/png")] as const
    )
  );

  const [logoDataUrl, fontCss] = await Promise.all([loadLogoDataUrl(), loadExoFontFaceCss()]);
  const html = generateProjectChangeHtml(
    {
      change,
      photoData: Object.fromEntries(photoEntries),
      signatureData: Object.fromEntries(sigEntries),
      statusLabel: changeStatusLabel(change.status),
      decisionLabel,
    },
    fontCss
  );

  const buffer = await renderHtmlToPdf(html, {
    documentName: `Karta zmiany ${change.number} — ${change.name}`,
    logoDataUrl,
  });
  return { buffer, fileName: sanitizePdfFileName(changePdfFileName(change.number, change.name)) };
}

// ---------------------------------------------------------------------------
// E-mail
// ---------------------------------------------------------------------------

export interface MailOutcome {
  ok: boolean;
  message: string;
}

async function send(
  supabase: SupabaseClient,
  to: string[],
  subject: string,
  html: string,
  text: string,
  attachment?: { fileName: string; content: Buffer }
): Promise<MailOutcome> {
  const recipients = Array.from(new Set(to.filter(Boolean)));
  if (recipients.length === 0) return { ok: false, message: "Brak adresata." };

  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) return { ok: false, message: "Serwer nie ma skonfigurowanego klucza RESEND_API_KEY." };

  // Nadawca z Ustawień (ten sam co przy raportach).
  const { from } = await resolveEmailConfig(supabase, "START_SHIFT");

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: `RYCOS Shift <${from}>`,
      to: recipients,
      subject: subject.replace(/[\r\n]+/g, " ").trim(),
      html,
      text,
      ...(attachment
        ? { attachments: [{ filename: attachment.fileName, content: attachment.content }] }
        : {}),
    });
    if (error) return { ok: false, message: error.message };
    return { ok: true, message: `Wysłano do: ${recipients.join(", ")}` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "nieznany błąd" };
  }
}

function layout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="pl"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>${escapeHtml(
    title
  )}</title></head>
<body style="margin:0;padding:24px 10px;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<center>
<table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width:600px;background-color:#ffffff;border-radius:12px;border:1px solid #e2e8f0;">
<tr><td style="background-color:#0f172a;padding:22px 26px;">
  <div style="font-size:10px;font-weight:800;color:#38bdf8;text-transform:uppercase;letter-spacing:1.5px;">RYCOS Shift &bull; Rejestr zmian w projekcie</div>
  <div style="font-size:19px;font-weight:900;color:#ffffff;margin-top:4px;">${escapeHtml(title)}</div>
</td></tr>
<tr><td style="padding:26px;color:#1e293b;font-size:14px;line-height:1.55;">${bodyHtml}</td></tr>
<tr><td style="background-color:#f8fafc;padding:16px 24px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#64748b;">
  <strong>iDream Business Center &bull; SolutionsBay Sp. z o.o.</strong><br/>Wiadomość wygenerowana automatycznie przez system RYCOS Shift. Prosimy nie odpowiadać.
</td></tr>
</table>
</center>
</body></html>`;
}

function summaryTable(change: ProjectChange): string {
  const row = (k: string, v: string) =>
    `<tr><td style="padding:8px 12px;font-size:12px;font-weight:700;color:#64748b;width:130px;border-bottom:1px solid #e2e8f0;">${k}</td><td style="padding:8px 12px;font-size:13px;font-weight:700;color:#0f172a;border-bottom:1px solid #e2e8f0;">${v}</td></tr>`;
  return `<table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:14px 0;">
    ${row("Numer", escapeHtml(`${change.number} (wersja ${change.version})`))}
    ${row("Nazwa", escapeHtml(change.name))}
    ${row("Plac budowy", escapeHtml(change.siteName))}
    ${row("Zgłaszający", escapeHtml(change.authorName))}
    ${row(
      "Konieczne KNA",
      change.knaRequired
        ? '<span style="color:#b91c1c;">TAK — rewizja całego projektu od początku</span>'
        : "nie"
    )}
  </table>`;
}

function button(url: string, label: string): string {
  return `<p style="margin:22px 0;text-align:center;"><a href="${escapeHtml(
    url
  )}" style="display:inline-block;background-color:#059669;color:#ffffff;font-weight:800;font-size:15px;text-decoration:none;padding:14px 26px;border-radius:10px;">${escapeHtml(
    label
  )}</a></p>`;
}

/** Zaproszenie do decyzji — osobne dla każdego akceptującego (imienny link). */
export async function sendChangeInvitation(
  supabase: SupabaseClient,
  change: ProjectChange,
  acceptor: { name: string; email: string },
  linkUrl: string,
  pdf: { fileName: string; buffer: Buffer } | null
): Promise<MailOutcome> {
  const nowa = change.version > 1;
  const title = nowa ? "Zmieniona karta zmiany do akceptacji" : "Nowa zmiana w projekcie do akceptacji";
  const body = `
    <p>Dzień dobry ${escapeHtml(acceptor.name)},</p>
    <p>${
      nowa
        ? "autor zmienił treść karty. Wcześniejsze decyzje dotyczyły poprzedniej wersji i straciły ważność — prosimy o decyzję w sprawie <strong>aktualnej</strong> wersji."
        : "w systemie RYCOS Shift zgłoszono zmianę w projekcie, która wymaga Twojej decyzji."
    }</p>
    ${summaryTable(change)}
    <p>Otwórz kartę, sprawdź sekcje „Jest” i „Powinno być”, a następnie wybierz <strong>Akceptuję</strong> albo <strong>Odrzucam</strong> i potwierdź decyzję podpisem.</p>
    ${button(linkUrl, "Otwórz kartę zmiany")}
    <p style="font-size:12px;color:#64748b;">Przy pierwszym wejściu aplikacja poprosi o Twój PIN (nadaje go administrator). Link jest imienny i ważny 14 dni — nie przekazuj go dalej. Później możesz logować się do aplikacji bezpośrednio.</p>
    ${pdf ? '<p style="font-size:12px;color:#64748b;">W załączniku karta w formacie PDF.</p>' : ""}`;
  const text = `${title}

${change.number} (wersja ${change.version}) — ${change.name}
Plac budowy: ${change.siteName}
Zgłaszający: ${change.authorName}
Konieczne KNA: ${change.knaRequired ? "TAK — rewizja całego projektu od początku" : "nie"}

Otwórz kartę i podejmij decyzję: ${linkUrl}
Przy pierwszym wejściu aplikacja poprosi o Twój PIN. Link jest imienny i ważny 14 dni.`;

  return send(
    supabase,
    [acceptor.email],
    `[RYCOS Shift] ${change.number} — ${change.name} — do akceptacji`,
    layout(title, body),
    text,
    pdf ? { fileName: pdf.fileName, content: pdf.buffer } : undefined
  );
}

/** Informacja o oddanej decyzji — do autora i pozostałych akceptujących. */
export async function sendDecisionNotice(
  supabase: SupabaseClient,
  change: ProjectChange,
  decision: ChangeDecision,
  to: string[]
): Promise<MailOutcome> {
  const title = `${decision.acceptorName}: ${decisionLabel(decision.decision)}`;
  const body = `
    <p>W karcie zmiany <strong>${escapeHtml(change.number)}</strong> oddano decyzję.</p>
    ${summaryTable(change)}
    <p><strong>${escapeHtml(decision.acceptorName)}</strong> — ${escapeHtml(
      decisionLabel(decision.decision)
    )}${decision.comment ? `<br/><em>„${escapeHtml(decision.comment)}”</em>` : ""}</p>
    <p>Status karty: <strong>${escapeHtml(changeStatusLabel(change.status))}</strong> (${
      change.decisions.filter((d) => d.decision === "PENDING").length
    } oczekujących decyzji).</p>
    ${button(`${appBaseUrl()}/?zmiana=${encodeURIComponent(change.id)}`, "Zobacz kartę")}`;
  const text = `${title}
${change.number} — ${change.name}
${decision.comment ? `Komentarz: ${decision.comment}\n` : ""}Status karty: ${changeStatusLabel(change.status)}`;

  return send(
    supabase,
    to,
    `[RYCOS Shift] ${change.number} — ${decisionLabel(decision.decision)} (${decision.acceptorName})`,
    layout(title, body),
    text
  );
}

/** Komplet decyzji — PDF z podpisami do listy odbiorców z Ustawień. */
export async function sendChangeFinal(
  supabase: SupabaseClient,
  change: ProjectChange,
  to: string[],
  pdf: { fileName: string; buffer: Buffer }
): Promise<MailOutcome> {
  const title = `Karta zmiany ${change.number}: ${changeStatusLabel(change.status)}`;
  const body = `
    <p>Wszyscy akceptujący podjęli decyzję w sprawie karty zmiany.</p>
    ${summaryTable(change)}
    <p>Status karty: <strong>${escapeHtml(changeStatusLabel(change.status))}</strong></p>
    <p>W załączniku karta z decyzjami i podpisami w formacie PDF.</p>`;
  const text = `${title}
${change.number} — ${change.name}
Plac budowy: ${change.siteName}
W załączniku karta z decyzjami i podpisami.`;
  return send(
    supabase,
    to,
    `[RYCOS Shift] ${change.number} — ${change.name} — ${changeStatusLabel(change.status)}`,
    layout(title, body),
    text,
    { fileName: pdf.fileName, content: pdf.buffer }
  );
}

/**
 * Nowy imienny link dla akceptującego + mail z zaproszeniem.
 * Poprzedni link tej osoby przestaje działać (w bazie jest tylko skrót
 * ostatniego tokenu). Wynik wysyłki trafia do wiersza decyzji.
 */
export async function issueInvitation(
  supabase: SupabaseClient,
  change: ProjectChange,
  decisionRow: { id: string; acceptor_name: string; acceptor_email: string },
  pdf: { fileName: string; buffer: Buffer } | null
): Promise<MailOutcome> {
  const { token, hash, expiresAt } = generateLinkToken();
  const { error } = await supabase
    .from(CHANGE_DECISIONS_TABLE)
    .update({ token_hash: hash, token_expires_at: expiresAt })
    .eq("id", decisionRow.id);
  if (error) return { ok: false, message: `Nie udało się utworzyć linku: ${error.message}` };

  const outcome = await sendChangeInvitation(
    supabase,
    change,
    { name: decisionRow.acceptor_name, email: decisionRow.acceptor_email },
    changeLinkUrl(token),
    pdf
  );

  await supabase
    .from(CHANGE_DECISIONS_TABLE)
    .update(
      outcome.ok
        ? { email_sent_at: new Date().toISOString(), email_error: null }
        : { email_error: outcome.message }
    )
    .eq("id", decisionRow.id);

  return outcome;
}
