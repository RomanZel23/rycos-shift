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
 * Ścieżka w buckecie z DOWOLNEJ historycznej formy odwołania.
 *
 * W bazie leżą trzy pokolenia wartości:
 *   1. publiczny URL CDN  (raporty z 2026-09-02 i późniejsze),
 *   2. /api/files?path=…  (raporty tworzone od Etapu 0),
 *   3. data:…base64       (najstarsze raporty — plik siedzi w kolumnie, nie w buckecie;
 *                          dla nich funkcja zwraca null i trzeba użyć samego base64).
 *
 * pathFromAppFileUrl obsługuje tylko formę 2, więc kod czytający prosto z bazy
 * musi używać tej funkcji, inaczej nie znajdzie plików starszych raportów.
 */
export function storagePathFromRef(value?: string | null): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  if (value.startsWith("data:")) return null;

  const fromApp = pathFromAppFileUrl(value);
  if (fromApp) return fromApp;

  for (const marker of [PUBLIC_URL_MARKER, SIGNED_URL_MARKER]) {
    const idx = value.indexOf(marker);
    if (idx >= 0) {
      const path = value.slice(idx + marker.length).split("?")[0];
      if (isAllowedStoragePath(path)) return path;
    }
  }

  return isAllowedStoragePath(value) ? value : null;
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
