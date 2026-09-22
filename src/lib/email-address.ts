/**
 * Walidacja adresów e-mail wpisywanych w panelu administratora.
 * Ten sam wzorzec co przy odbiorcach raportów w src/lib/email.ts.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidEmail(value: string): boolean {
  return value.length <= 254 && EMAIL_PATTERN.test(value);
}
