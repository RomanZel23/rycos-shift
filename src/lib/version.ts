/**
 * Wersja aplikacji pokazywana w stopce portalu.
 *
 * Wartość wstrzykuje next.config.ts z package.json przy budowaniu. Numer wpisany
 * w komponencie na sztywno zestarzał się dokładnie tak, jak można było się
 * spodziewać: stopka pokazywała „Wersja 1.3 (Supabase Cloud Sync)" jeszcze przy
 * package.json 1.6.0, razem z nieaktualną nazwą kodową etapu.
 *
 * „dev" zobaczy tylko ktoś, kto uruchomi kod bez builda Next (np. `node --test`).
 */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "dev";
