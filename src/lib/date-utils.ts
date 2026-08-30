/**
 * Narzędzia daty i czasu ze ścisłą obsługą polskiej strefy czasowej (Europe/Warsaw)
 * Rozwiązuje problem przesunięć UTC na serwerach Vercel i urządzeniach mobilnych.
 */

export const POLAND_TIMEZONE = "Europe/Warsaw";

/**
 * Zwraca bieżącą datę w polskiej strefie czasowej w formacie YYYY-MM-DD
 */
export function getPolishCurrentDate(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: POLAND_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(date); // np. "2026-08-30"
  } catch {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
}

/**
 * Zwraca bieżący czas w polskiej strefie czasowej w formacie HH:mm (24h)
 */
export function getPolishCurrentTime(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat("pl-PL", {
      timeZone: POLAND_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return formatter.format(date); // np. "09:35"
  } catch {
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  }
}

/**
 * Formatuje timestamp ISO lub godzinę do lokalnego polskiego czasu HH:mm
 */
export function formatPolishTime(isoOrTime?: string): string {
  if (!isoOrTime) return getPolishCurrentTime();

  // Jeśli string ma już prosty format "09:35" lub "9:35"
  if (/^\d{1,2}:\d{2}$/.test(isoOrTime)) {
    const [h, m] = isoOrTime.split(":");
    return `${h.padStart(2, "0")}:${m}`;
  }

  try {
    const d = new Date(isoOrTime);
    if (isNaN(d.getTime())) return isoOrTime;

    return new Intl.DateTimeFormat("pl-PL", {
      timeZone: POLAND_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return isoOrTime;
  }
}

/**
 * Formatuje pełny timestamp do formatu "DD.MM.YYYY, HH:mm:ss" w strefie polskiej
 */
export function formatPolishDateTime(isoOrDate?: string | Date): string {
  const d = isoOrDate ? (typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate) : new Date();
  try {
    if (isNaN(d.getTime())) return String(isoOrDate);
    return new Intl.DateTimeFormat("pl-PL", {
      timeZone: POLAND_TIMEZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return d.toLocaleString("pl-PL");
  }
}
