import { createHash, randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ChangeDecision,
  ChangeDecisionValue,
  ChangePhoto,
  ChangeStatus,
  ProjectChange,
} from "@/types";
import { BUCKET_NAME, toAppFileUrl } from "./storage-paths";
import { CHANGE_LINK_TTL_DAYS } from "./project-change";
import type { AuthUser } from "./auth";

/**
 * Rejestr zmian — dostęp do bazy i pomocnicy po stronie serwera.
 * Logika czysta (statusy, ścieżki, walidacja) jest w ./project-change.ts.
 */

export const CHANGES_TABLE = "project_changes";
export const CHANGE_VERSIONS_TABLE = "project_change_versions";
export const CHANGE_DECISIONS_TABLE = "project_change_decisions";

export interface ChangeRow {
  id: string;
  tenant_id: string;
  number_year: number;
  number_seq: number;
  number: string;
  site_id: string | null;
  site_name: string;
  location: ProjectChange["location"] | null;
  name: string;
  current_description: string;
  current_photos: ChangePhoto[] | null;
  target_description: string;
  target_photos: ChangePhoto[] | null;
  kna_required: boolean;
  status: ChangeStatus;
  version: number;
  author_id: string;
  author_name: string;
  pdf_path: string | null;
  created_at: string;
  submitted_at: string;
  version_sent_at: string;
  locked_at: string | null;
  completed_at: string | null;
  final_email_sent_at: string | null;
  updated_at: string;
}

export interface DecisionRow {
  id: string;
  change_id: string;
  version: number;
  acceptor_id: string;
  acceptor_name: string;
  acceptor_email: string;
  decision: ChangeDecisionValue;
  comment: string | null;
  signature_path: string | null;
  decided_at: string | null;
  token_hash: string | null;
  token_expires_at: string | null;
  email_sent_at: string | null;
  email_error: string | null;
  created_at: string;
}

/** Zdjęcie w bazie ma wyłącznie ścieżkę — adres dla przeglądarki powstaje przy odczycie. */
function photosFromRow(list: ChangePhoto[] | null): ChangePhoto[] {
  return (list || []).map((p) => ({
    id: p.id,
    path: p.path,
    takenAt: p.takenAt || "",
    ...(p.source ? { source: p.source } : {}),
    ...(p.capturedAt ? { capturedAt: p.capturedAt } : {}),
  }));
}

export function decisionRowToApp(row: DecisionRow): ChangeDecision {
  return {
    id: row.id,
    version: row.version,
    acceptorId: row.acceptor_id,
    acceptorName: row.acceptor_name,
    decision: row.decision,
    ...(row.comment ? { comment: row.comment } : {}),
    ...(row.signature_path ? { signatureUrl: toAppFileUrl(row.signature_path) } : {}),
    ...(row.decided_at ? { decidedAt: row.decided_at } : {}),
    ...(row.email_sent_at ? { emailSentAt: row.email_sent_at } : {}),
    ...(row.email_error ? { emailError: row.email_error } : {}),
  };
}

export function changeRowToApp(row: ChangeRow, decisions: DecisionRow[]): ProjectChange {
  const own = decisions.filter((d) => d.change_id === row.id);
  const byName = (a: DecisionRow, b: DecisionRow) =>
    a.acceptor_name.localeCompare(b.acceptor_name, "pl");
  return {
    id: row.id,
    number: row.number,
    siteId: row.site_id || "",
    siteName: row.site_name,
    location: row.location || { latitude: null, longitude: null },
    name: row.name,
    current: { description: row.current_description || "", photos: photosFromRow(row.current_photos) },
    target: { description: row.target_description || "", photos: photosFromRow(row.target_photos) },
    knaRequired: Boolean(row.kna_required),
    status: row.status,
    version: row.version,
    authorId: row.author_id,
    authorName: row.author_name,
    submittedAt: row.submitted_at,
    versionSentAt: row.version_sent_at,
    ...(row.locked_at ? { lockedAt: row.locked_at } : {}),
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    decisions: own
      .filter((d) => d.version === row.version)
      .sort(byName)
      .map(decisionRowToApp),
    // Historia: tylko oddane decyzje ze starszych wersji — oczekujące, które
    // wygasły przy edycji, nic nie mówią.
    history: own
      .filter((d) => d.version < row.version && d.decision !== "SUPERSEDED")
      .sort((a, b) => b.version - a.version || byName(a, b))
      .map(decisionRowToApp),
  };
}

export async function loadChange(
  supabase: SupabaseClient,
  id: string
): Promise<{ row: ChangeRow; decisions: DecisionRow[] } | null> {
  const { data: row } = await supabase.from(CHANGES_TABLE).select("*").eq("id", id).maybeSingle();
  if (!row) return null;
  const { data: decisions } = await supabase
    .from(CHANGE_DECISIONS_TABLE)
    .select("*")
    .eq("change_id", id);
  return { row: row as ChangeRow, decisions: (decisions || []) as DecisionRow[] };
}

/**
 * Karty widoczne dla użytkownika. Brygadzista i administrator widzą wszystkie
 * (to rejestr całego zespołu). Akceptujący bez tych uprawnień widzi tylko karty,
 * do których był kiedykolwiek zaproszony.
 */
export async function listChangesForUser(
  supabase: SupabaseClient,
  user: Pick<AuthUser, "id" | "isForeman" | "isAdmin">
): Promise<ProjectChange[]> {
  let ids: string[] | null = null;

  if (!user.isForeman && !user.isAdmin) {
    const { data: mine } = await supabase
      .from(CHANGE_DECISIONS_TABLE)
      .select("change_id")
      .eq("acceptor_id", user.id);
    ids = Array.from(new Set((mine || []).map((m: { change_id: string }) => m.change_id)));
    if (ids.length === 0) return [];
  }

  let query = supabase.from(CHANGES_TABLE).select("*").order("submitted_at", { ascending: false });
  if (ids) query = query.in("id", ids);
  const { data: rows, error } = await query;
  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) return [];

  const { data: decisions } = await supabase
    .from(CHANGE_DECISIONS_TABLE)
    .select("*")
    .in(
      "change_id",
      rows.map((r: ChangeRow) => r.id)
    );

  return (rows as ChangeRow[]).map((r) => changeRowToApp(r, (decisions || []) as DecisionRow[]));
}

// ---------------------------------------------------------------------------
// Linki z maila
// ---------------------------------------------------------------------------

/** Losowy token do linku (43 znaki base64url). W bazie ląduje tylko jego skrót. */
export function generateLinkToken(): { token: string; hash: string; expiresAt: string } {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + CHANGE_LINK_TTL_DAYS * 24 * 3600 * 1000).toISOString();
  return { token, hash: hashLinkToken(token), expiresAt };
}

export function hashLinkToken(token: string): string {
  return createHash("sha256").update(`rycos-change-link-v1:${token}`).digest("hex");
}

/**
 * Adres aplikacji do linków w mailach. Za Traefikiem nagłówek Host bywa
 * wewnętrzny, więc bierzemy go z konfiguracji, a nie z żądania.
 */
export function appBaseUrl(): string {
  const fromEnv = (process.env.APP_BASE_URL || "").trim().replace(/\/+$/, "");
  return fromEnv || "https://shift.rycos.eu";
}

export function changeLinkUrl(token: string): string {
  return `${appBaseUrl()}/zmiana/${encodeURIComponent(token)}`;
}

// ---------------------------------------------------------------------------
// Pliki
// ---------------------------------------------------------------------------

/** Data URL obrazu -> bajty, z kontrolą typu i rozmiaru. */
export function decodeImageDataUrl(
  dataUrl: unknown,
  allowed: string[],
  maxBytes: number
): { bytes: Uint8Array; contentType: string } | { error: string } {
  if (typeof dataUrl !== "string") return { error: "Brak pliku." };
  const match = /^data:([a-z/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!match) return { error: "Nieprawidłowy format pliku." };
  const contentType = match[1].toLowerCase();
  if (!allowed.includes(contentType)) return { error: "Niedozwolony typ pliku." };
  const bytes = new Uint8Array(Buffer.from(match[2], "base64"));
  if (bytes.byteLength === 0) return { error: "Pusty plik." };
  if (bytes.byteLength > maxBytes) return { error: "Plik jest za duży." };
  return { bytes, contentType };
}

export async function uploadToBucket(
  supabase: SupabaseClient,
  path: string,
  bytes: Uint8Array,
  contentType: string
): Promise<string | null> {
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(path, bytes, { contentType, upsert: true });
  return error ? error.message : null;
}

/** Aktywni akceptujący (kompetencja + adres) — z bazy, nie z żądania. */
export async function loadAcceptors(
  supabase: SupabaseClient
): Promise<Array<{ id: string; name: string; email: string }>> {
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("can_accept_changes", true)
    .order("last_name", { ascending: true });
  return (data || [])
    .filter((u: { email?: string | null }) => typeof u.email === "string" && u.email)
    .map((u: { id: string; first_name: string; last_name: string; email: string }) => ({
      id: u.id,
      name: `${u.first_name} ${u.last_name}`.trim(),
      email: u.email,
    }));
}

export async function loadUserEmail(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase.from("users").select("*").eq("id", userId).maybeSingle();
  const email = (data as { email?: string | null } | null)?.email;
  return typeof email === "string" && email ? email : null;
}

/** Czy użytkownik może oglądać kartę: brygadzista/admin zawsze, akceptujący — gdy był zaproszony. */
export function canViewChange(
  user: Pick<AuthUser, "id" | "isForeman" | "isAdmin">,
  decisions: DecisionRow[]
): boolean {
  if (user.isForeman || user.isAdmin) return true;
  return decisions.some((d) => d.acceptor_id === user.id);
}

/** Karta w kształcie aplikacji po przeładowaniu z bazy. */
export async function reloadChangeApp(
  supabase: SupabaseClient,
  id: string
): Promise<ProjectChange | null> {
  const loaded = await loadChange(supabase, id);
  return loaded ? changeRowToApp(loaded.row, loaded.decisions) : null;
}
