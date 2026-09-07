import { test } from "node:test";
import assert from "node:assert/strict";
import { wykryjPlatforme, wskazowkaLokalizacji } from "@/lib/platform";

const IPAD_NOWY =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
const IPAD_STARY = "Mozilla/5.0 (iPad; CPU OS 12_2 like Mac OS X) AppleWebKit/605.1.15 Version/12.1 Safari/604.1";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Version/17.4 Mobile/15E148 Safari/604.1";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Mobile Safari/537.36";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36";

/**
 * Zgłoszenie z 7 września 2026: brygadzista pracuje na iPadzie i dostawał
 * instrukcję napisaną pod Chrome na komputerze. Sedno rozpoznania: iPadOS 13+
 * podaje się w User-Agent za Maca, więc bez sprawdzenia ekranu dotykowego iPad
 * wygląda dokładnie jak MacBook.
 */
test("iPad z iPadOS 13+ nie jest brany za MacBooka", () => {
  assert.equal(wykryjPlatforme({ userAgent: IPAD_NOWY, maxTouchPoints: 5 }), "ios-safari");
  assert.equal(wykryjPlatforme({ userAgent: MAC, maxTouchPoints: 0 }), "komputer");
  // Mac bez informacji o dotyku również ma zostać komputerem.
  assert.equal(wykryjPlatforme({ userAgent: MAC }), "komputer");
});

test("starsze iPady, iPhone, Android i Windows trafiają tam, gdzie trzeba", () => {
  assert.equal(wykryjPlatforme({ userAgent: IPAD_STARY }), "ios-safari");
  assert.equal(wykryjPlatforme({ userAgent: IPHONE, maxTouchPoints: 5 }), "ios-safari");
  assert.equal(wykryjPlatforme({ userAgent: ANDROID, maxTouchPoints: 5 }), "android");
  assert.equal(wykryjPlatforme({ userAgent: WINDOWS }), "komputer");
});

test("aplikacja z ekranu głównego to osobny przypadek, nie Safari", () => {
  // Uprawnienie nadane wcześniej w Safari nie dotyczy aplikacji dodanej do
  // ekranu głównego — ma własny wpis w Usługach lokalizacji.
  assert.equal(
    wykryjPlatforme({ userAgent: IPAD_NOWY, maxTouchPoints: 5, standalone: true }),
    "ios-aplikacja"
  );
  assert.notEqual(
    wskazowkaLokalizacji("ios-aplikacja"),
    wskazowkaLokalizacji("ios-safari")
  );
});

test("każda platforma dostaje wskazówkę prowadzącą we właściwe miejsce", () => {
  assert.match(wskazowkaLokalizacji("ios-safari"), /AA|Ustawieniach iPada/);
  assert.match(wskazowkaLokalizacji("ios-aplikacja"), /Ustawienia iPada/);
  assert.match(wskazowkaLokalizacji("android"), /Uprawnienia/);
  assert.match(wskazowkaLokalizacji("komputer"), /ikonę po lewej stronie adresu/);

  // Żadna wskazówka nie może mówić o kłódce — w Chrome na Macu są tam suwaki,
  // w Safari literki AA. To już raz wprowadziło ludzi w błąd.
  for (const p of ["ios-safari", "ios-aplikacja", "android", "komputer"] as const) {
    assert.doesNotMatch(wskazowkaLokalizacji(p), /kłódk/i, p);
    assert.ok(wskazowkaLokalizacji(p).length > 40, p);
  }
});
