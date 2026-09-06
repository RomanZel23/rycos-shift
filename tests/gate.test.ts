import { test } from "node:test";
import assert from "node:assert/strict";
import {
  GATE_MAX_AGE_SECONDS,
  expectedGateToken,
  gateCookieOptions,
  gateFailure,
  verifyAccessCode,
  verifyGateToken,
} from "@/lib/gate";

// Funkcje z gate.ts czytają zmienne środowiskowe przy każdym wywołaniu, więc
// wystarczy ustawić je tutaj — przed pierwszym testem, a po imporcie modułu.
process.env.APP_ACCESS_CODE = "kod-testowy-123";
process.env.GATE_SECRET = "sekret-testowy-do-podpisu-bramki";

test("token z ciasteczka przechodzi weryfikację, podrobiony nie", () => {
  const token = expectedGateToken();
  assert.equal(verifyGateToken(token), true);
  assert.equal(verifyGateToken(`${token}x`), false);
  assert.equal(verifyGateToken(""), false);
  assert.equal(verifyGateToken(null), false);
});

test("kod dostępu porównuje się po wartości, nie po przypadku", () => {
  assert.equal(verifyAccessCode("kod-testowy-123"), true);
  assert.equal(verifyAccessCode("  kod-testowy-123  "), true, "spacje z klawiatury telefonu");
  assert.equal(verifyAccessCode("kod-testowy-124"), false);
  assert.equal(verifyAccessCode(""), false);
});

test("zmiana kodu dostępu unieważnia wszystkie wcześniejsze autoryzacje", () => {
  // Jedyna droga odcięcia zgubionego telefonu — i najczęstszy powód, dla
  // którego ekran kodu wraca komuś, kto go już raz wpisał.
  const stary = expectedGateToken();
  process.env.APP_ACCESS_CODE = "kod-po-rotacji-456";
  try {
    assert.equal(verifyGateToken(stary), false);
    assert.equal(verifyGateToken(expectedGateToken()), true);
  } finally {
    process.env.APP_ACCESS_CODE = "kod-testowy-123";
  }
  assert.equal(verifyGateToken(stary), true, "powrót starego kodu przywraca stare tokeny");
});

test("brak ważnego ciasteczka daje GATE_LOCKED, ważne przepuszcza", () => {
  assert.equal(gateFailure(expectedGateToken()), null);
  const failure = gateFailure("nie-ten-token");
  assert.equal(failure?.code, "GATE_LOCKED");
  assert.equal(failure?.status, 401);
  assert.match(failure?.message ?? "", /przeglądarka/i, "komunikat mówi o przeglądarce, nie o urządzeniu");
});

/**
 * Regresja z uwagi klienta #015: ciasteczko bramki było ustawiane raz i nigdy
 * nieodnawiane, więc ekran kodu wracał po 30 dniach nawet komuś, kto pracował
 * w aplikacji codziennie — mimo obietnicy „kod podajesz raz". Teraz proxy.ts
 * i GET /api/gate przestawiają Max-Age przy każdym żądaniu, a te opcje są
 * wspólnym źródłem prawdy dla obu miejsc. Rozjazd atrybutów (np. inna ścieżka)
 * kasowałby i zakładał ciasteczko na przemian zamiast je przedłużać.
 */
test("opcje ciasteczka bramki dają pełne 30 dni przy każdym odnowieniu", () => {
  const opcje = gateCookieOptions();
  assert.equal(opcje.maxAge, GATE_MAX_AGE_SECONDS);
  assert.equal(opcje.maxAge, 60 * 60 * 24 * 30);
  assert.equal(opcje.httpOnly, true, "JavaScript strony nie może czytać dowodu autoryzacji");
  assert.equal(opcje.path, "/");
  assert.equal(opcje.sameSite, "lax");
});

test("wylogowanie odpina przeglądarkę tylko przez jawne maxAge 0", () => {
  const kasujace = gateCookieOptions(0);
  const zakladajace = gateCookieOptions();
  assert.equal(kasujace.maxAge, 0);
  // Pozostałe atrybuty muszą się zgadzać z tymi przy zakładaniu — inaczej
  // przeglądarka potraktuje to jako inne ciasteczko i starego nie skasuje.
  assert.deepEqual(
    { ...kasujace, maxAge: null },
    { ...zakladajace, maxAge: null }
  );
});

test("odnowienie nie zmienia wartości tokenu", () => {
  // Token jest deterministyczny, więc przedłużenie ważności w jednej karcie
  // nie wywala pozostałych ani zainstalowanej aplikacji PWA.
  assert.equal(expectedGateToken(), expectedGateToken());
});
