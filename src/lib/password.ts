import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import type { ScryptOptions } from "crypto";
import { promisify } from "util";

// promisify gubi przeciążenie z opcjami, stąd jawny typ.
const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions
) => Promise<Buffer>;

/**
 * Hashowanie haseł i PIN-ów pracowników.
 *
 * Świadomie na wbudowanym scrypt (RFC 7914, akceptowany przez OWASP) zamiast
 * argon2id: argon2 z npm wymaga kompilacji natywnej, co na node:alpine bywa
 * kruche, a każda nowa zależność wymusza przebudowę lockfile'a — Dockerfile
 * instaluje z --frozen-lockfile. Tutaj nie dokładamy ani jednej paczki.
 *
 * Parametry: N=2^16, r=8, p=1, 32-bajtowy klucz. Ok. 200 ms na hash przy ~64 MB
 * pamięci. Logowania są rzadkie, a limiter prób w /api/auth/login ogranicza
 * jednoczesne wywołania.
 */
const SCRYPT_N = 65536;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const MAXMEM = 160 * 1024 * 1024;

const PREFIX = "scrypt";

export async function hashSecret(plain: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = (await scrypt(plain.normalize("NFKC"), salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: MAXMEM,
  }));

  return [
    PREFIX,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

/**
 * Weryfikacja w stałym czasie. Zwraca false zamiast rzucać, żeby wywołujący
 * nie musiał rozróżniać „zły format w bazie" od „złe hasło" — dla atakującego
 * oba przypadki mają wyglądać tak samo.
 */
export async function verifySecret(
  plain: string,
  stored?: string | null
): Promise<boolean> {
  if (!stored || typeof stored !== "string") return false;

  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== PREFIX) return false;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4], "base64");
    expected = Buffer.from(parts[5], "base64");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  try {
    const derived = (await scrypt(plain.normalize("NFKC"), salt, expected.length, {
      N,
      r,
      p,
      maxmem: MAXMEM,
    }));
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/**
 * Kosztowna weryfikacja „na pusto". Wywoływana, gdy login nie istnieje albo
 * konto nie ma ustawionego hasła — bez tego czas odpowiedzi zdradzałby, które
 * loginy są prawdziwe.
 */
export async function burnVerificationTime(): Promise<void> {
  await verifySecret(
    "dummy",
    `${PREFIX}$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${Buffer.alloc(SALT_LENGTH).toString(
      "base64"
    )}$${Buffer.alloc(KEY_LENGTH).toString("base64")}`
  );
}

/** Minimalne wymagania dla haseł nadawanych przez administratora. */
export function validatePassword(value: string): string | null {
  if (value.length < 10) return "Hasło musi mieć co najmniej 10 znaków.";
  if (value.length > 200) return "Hasło jest za długie.";
  if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value))
    return "Hasło musi zawierać litery i cyfry.";
  return null;
}

/** PIN do trybu szybkiego wyboru pracownika. */
export function validatePin(value: string): string | null {
  if (!/^\d{4,8}$/.test(value)) return "PIN musi mieć od 4 do 8 cyfr.";
  if (/^(\d)\1+$/.test(value)) return "PIN nie może składać się z jednej powtórzonej cyfry.";
  if ("0123456789".includes(value) || "9876543210".includes(value))
    return "PIN nie może być ciągiem kolejnych cyfr.";
  return null;
}
