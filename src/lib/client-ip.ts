/**
 * Adres IP klienta dla limiterów prób (/api/gate, /api/auth/login).
 *
 * Przed aplikacją stoi wyłącznie Traefik z Coolify — jeden zaufany hop.
 * Traefik DOPISUJE adres, z którym faktycznie rozmawiał, na KOŃCU nagłówka
 * X-Forwarded-For. Wszystko, co stoi przed nim, mógł wpisać sam klient.
 *
 * Wcześniej brany był pierwszy wpis, więc wystarczyło wysyłać przy każdej
 * próbie inny, zmyślony X-Forwarded-For, żeby limiter widział za każdym razem
 * „nowe urządzenie" i nigdy nie zadziałał.
 *
 * Gdyby kiedyś przed Traefikiem stanął kolejny proxy (np. Cloudflare), trzeba
 * podnieść TRUSTED_PROXY_HOPS — inaczej wszyscy użytkownicy dzieliliby jeden
 * licznik, bo ostatnim wpisem byłby adres tego proxy.
 */
const TRUSTED_PROXY_HOPS = 1;

export function clientIpFromHeaders(headers: {
  get(name: string): string | null;
}): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const wpisy = fwd
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const wpis = wpisy[wpisy.length - TRUSTED_PROXY_HOPS];
    if (wpis) return wpis;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}
