export const BUCKET_NAME = "rycos-reports";

/** Fragment publicznego URL-a Supabase Storage sprzed przełączenia bucketu na prywatny. */
const PUBLIC_URL_MARKER = `/storage/v1/object/public/${BUCKET_NAME}/`;
const SIGNED_URL_MARKER = `/storage/v1/object/sign/${BUCKET_NAME}/`;

/** Dozwolone ścieżki w buckecie: pdf/, photos/, signatures/ + bezpieczna nazwa pliku. */
const ALLOWED_PATH = /^(pdf|photos|signatures)\/[A-Za-z0-9._-]{1,200}$/;

export function isAllowedStoragePath(path: string): boolean {
  if (!path || path.includes("..") || path.includes("//")) return false;
  return ALLOWED_PATH.test(path);
}

/** Adres, pod którym aplikacja serwuje plik z prywatnego bucketu (same-origin). */
export function toAppFileUrl(path: string): string {
  return `/api/files?path=${encodeURIComponent(path)}`;
}

/** Wyciąga ścieżkę w buckecie z adresu /api/files?path=... */
export function pathFromAppFileUrl(value?: string | null): string | null {
  if (!value || !value.startsWith("/api/files")) return null;
  const query = value.slice(value.indexOf("?") + 1);
  const path = new URLSearchParams(query).get("path");
  return path && isAllowedStoragePath(path) ? path : null;
}

/**
 * Sprowadza dowolną historyczną formę odwołania do pliku (publiczny URL CDN,
 * podpisany URL, gołą ścieżkę) do adresu same-origin /api/files.
 * Data URL-e i obce adresy zostawia bez zmian.
 */
export function normalizeStoredFileRef<T extends string | undefined | null>(value: T): T {
  if (typeof value !== "string" || value.length === 0) return value;
  if (value.startsWith("data:")) return value;
  if (value.startsWith("/api/files")) return value;

  for (const marker of [PUBLIC_URL_MARKER, SIGNED_URL_MARKER]) {
    const idx = value.indexOf(marker);
    if (idx >= 0) {
      const path = value.slice(idx + marker.length).split("?")[0];
      if (isAllowedStoragePath(path)) return toAppFileUrl(path) as T;
    }
  }

  if (isAllowedStoragePath(value)) return toAppFileUrl(value) as T;

  return value;
}
