import type { NextConfig } from "next";

/**
 * Etap 4 — nagłówki bezpieczeństwa.
 *
 * Aplikacja jest PWA na telefonach w terenie i zawiera podpisy oraz zdjęcia
 * z placu budowy, więc domyślne nagłówki Next są za luźne.
 *
 * Uwagi do CSP:
 * - 'unsafe-inline' w script-src jest wymagane przez Next dla skryptu
 *   bootstrapującego hydratację. Bez nonce'a nie da się tego zdjąć, a nonce
 *   wymusiłby renderowanie dynamiczne każdej strony.
 * - 'unsafe-eval' celowo NIE ma — nic go nie potrzebuje w buildzie produkcyjnym.
 * - blob: i data: w img-src, bo zdjęcia z aparatu i podpisy z canvasu żyją
 *   jako data URL, zanim trafią na serwer.
 * - connect-src ma Supabase, bo klient odpytuje storage i PostgREST bezpośrednio.
 * - frame-ancestors 'none' zastępuje X-Frame-Options i blokuje clickjacking na
 *   ekranie podpisu — to jedyne miejsce, gdzie da się coś podpisać nieświadomie.
 */

const SUPABASE_ORIGIN = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  `img-src 'self' data: blob:${SUPABASE_ORIGIN ? ` ${SUPABASE_ORIGIN}` : ""}`,
  `connect-src 'self'${SUPABASE_ORIGIN ? ` ${SUPABASE_ORIGIN}` : ""}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  // Aparat i lokalizacja są potrzebne, mikrofon tylko do dyktowania opisu.
  // Reszta uprawnień wyłączona, żeby zagnieżdżony skrypt nie miał do nich drogi.
  {
    key: "Permissions-Policy",
    value: "camera=(self), geolocation=(self), microphone=(self), payment=(), usb=(), interest-cohort=()",
  },
  // HSTS ma sens, bo Coolify terminuje TLS i aplikacja chodzi wyłącznie po https.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
