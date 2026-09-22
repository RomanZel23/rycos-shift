/**
 * Rejestr zmian w projekcie — logika wspólna dla serwera i klienta.
 *
 * Czyste funkcje bez dostępu do bazy, żeby dało się je testować
 * i używać po obu stronach.
 */
import type {
  ChangeDecision,
  ChangeDecisionValue,
  ChangePhoto,
  ChangeStatus,
  ProjectChange,
} from "@/types";

export const CHANGE_LINK_TTL_DAYS = 14;
/** Limit na jedno zdjęcie po kompresji na urządzeniu (1024 px, JPEG 0,7 to ~150–400 kB). */
export const CHANGE_PHOTO_MAX_BYTES = 4 * 1024 * 1024;
export const CHANGE_SIGNATURE_MAX_BYTES = 600 * 1024;
export const CHANGE_NAME_MAX = 200;
export const CHANGE_DESCRIPTION_MAX = 5000;
export const CHANGE_COMMENT_MAX = 2000;

export type ChangeSectionKey = "jest" | "powinno";

/** Kto może zakładać i edytować karty zmian. */
export function canInitiateChanges(user: { isForeman?: boolean; isAdmin?: boolean }): boolean {
  return Boolean(user.isForeman || user.isAdmin);
}

/**
 * Akceptujący, który nie jest ani brygadzistą, ani administratorem — widzi
 * wyłącznie zakładkę „Zmiany w projekcie". Raporty dzienne go nie dotyczą.
 */
export function isAcceptorOnly(user: {
  isForeman?: boolean;
  isAdmin?: boolean;
  canAcceptChanges?: boolean;
}): boolean {
  return Boolean(user.canAcceptChanges) && !canInitiateChanges(user);
}

/** "ZM/2026/0007" */
export function formatChangeNumber(year: number, seq: number): string {
  return `ZM/${year}/${String(seq).padStart(4, "0")}`;
}

/**
 * Status zbiorczy z decyzji BIEŻĄCEJ wersji.
 *
 *   - akceptacja i odrzucenie jednocześnie      -> DISPUTED (Sporna)
 *   - ktoś jeszcze nie zdecydował               -> PENDING (Oczekuje)
 *   - wszyscy zaakceptowali                     -> ACCEPTED
 *   - wszyscy odrzucili                         -> REJECTED
 *
 * Znaczenie statusu interpretują ludzie — system go tylko liczy.
 */
export function aggregateChangeStatus(
  decisions: Array<{ decision: ChangeDecisionValue }>
): { status: ChangeStatus; complete: boolean } {
  const active = decisions.filter((d) => d.decision !== "SUPERSEDED");
  const accepted = active.filter((d) => d.decision === "ACCEPTED").length;
  const rejected = active.filter((d) => d.decision === "REJECTED").length;
  const pending = active.filter((d) => d.decision === "PENDING").length;
  const complete = active.length > 0 && pending === 0;

  if (accepted > 0 && rejected > 0) return { status: "DISPUTED", complete };
  if (pending > 0 || active.length === 0) return { status: "PENDING", complete };
  if (accepted > 0) return { status: "ACCEPTED", complete };
  return { status: "REJECTED", complete };
}

export function changeStatusLabel(status: ChangeStatus): string {
  switch (status) {
    case "ACCEPTED":
      return "Zaakceptowana";
    case "REJECTED":
      return "Odrzucona";
    case "DISPUTED":
      return "Sporna";
    default:
      return "Oczekuje";
  }
}

export function decisionLabel(decision: ChangeDecisionValue): string {
  switch (decision) {
    case "ACCEPTED":
      return "Akceptuję";
    case "REJECTED":
      return "Odrzucam";
    case "SUPERSEDED":
      return "Nieaktualna (karta zmieniona)";
    default:
      return "Oczekuje na decyzję";
  }
}

/** Autor może edytować, dopóki nikt nie zaakceptował (punkt 10 specyfikacji). */
export function canEditChange(
  change: Pick<ProjectChange, "authorId" | "lockedAt">,
  userId: string
): boolean {
  return change.authorId === userId && !change.lockedAt;
}

/** Decyzja zalogowanego akceptującego czekająca na podpis — albo null. */
export function pendingDecisionFor(
  change: Pick<ProjectChange, "decisions">,
  userId: string
): ChangeDecision | null {
  return change.decisions.find((d) => d.acceptorId === userId && d.decision === "PENDING") || null;
}

// ---------------------------------------------------------------------------
// Ścieżki w buckecie
// ---------------------------------------------------------------------------

function part(value: string, fallback: string): string {
  const clean = String(value || "").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 60);
  return clean || fallback;
}

/** Prefiks wszystkich zdjęć danej karty — serwer odrzuca ścieżki spoza niego. */
export function changePhotoPrefix(changeId: string): string {
  return `photos/chg_${part(changeId, "karta")}_`;
}

export function changePhotoPath(
  changeId: string,
  section: ChangeSectionKey,
  photoId: string
): string {
  return `${changePhotoPrefix(changeId)}${section}_${part(photoId, "foto")}.jpg`;
}

export function changeSignaturePath(changeId: string, version: number, userId: string): string {
  return `signatures/chg_${part(changeId, "karta")}_v${version}_${part(userId, "osoba")}.png`;
}

export function changePdfPath(changeId: string, version: number): string {
  return `pdf/chg_${part(changeId, "karta")}_v${version}.pdf`;
}

/** "ZM/2026/0007" + nazwa -> "ZM_2026_0007_Przesuniecie_sciany.pdf" (sanityzacja po stronie wołającego). */
export function changePdfFileName(number: string, name: string): string {
  return `${number.replace(/\//g, "_")}_${name}`;
}

// ---------------------------------------------------------------------------
// Walidacja treści karty
// ---------------------------------------------------------------------------

export interface ChangeContentInput {
  name: string;
  siteId: string;
  current: { description: string; photos: ChangePhoto[] };
  target: { description: string; photos: ChangePhoto[] };
}

/** Pierwszy problem z treścią karty albo null. Wspólne dla formularza i API. */
export function validateChangeContent(input: ChangeContentInput): string | null {
  if (!input.siteId) return "Wybierz plac budowy.";
  const name = (input.name || "").trim();
  if (!name) return "Podaj nazwę zmiany.";
  if (name.length > CHANGE_NAME_MAX) return `Nazwa może mieć najwyżej ${CHANGE_NAME_MAX} znaków.`;

  const sekcje: Array<[string, { description: string; photos: ChangePhoto[] }]> = [
    ["Jest", input.current],
    ["Powinno być", input.target],
  ];
  for (const [label, sekcja] of sekcje) {
    const opis = (sekcja?.description || "").trim();
    const zdjecia = sekcja?.photos || [];
    if (!opis && zdjecia.length === 0) {
      return `Sekcja „${label}” jest pusta — dodaj opis albo zdjęcie.`;
    }
    if (opis.length > CHANGE_DESCRIPTION_MAX) {
      return `Opis w sekcji „${label}” może mieć najwyżej ${CHANGE_DESCRIPTION_MAX} znaków.`;
    }
  }
  return null;
}
