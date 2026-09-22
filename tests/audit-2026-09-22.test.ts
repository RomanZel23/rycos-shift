import { test } from "node:test";
import assert from "node:assert/strict";
import { fieldSubmittedAt } from "@/lib/report-mapper";
import { isAllowedStoragePath, signatureStoragePath } from "@/lib/storage-paths";
import { clientIpFromHeaders } from "@/lib/client-ip";

/**
 * Regresje z przeglądu logiki z 22 września 2026.
 */

test("podpisy dwóch raportów z tego samego dnia nie dzielą ścieżki w buckecie", () => {
  const a = signatureStoragePath("2026-09-22", "rep-start-aaa", "usr-1", 0);
  const b = signatureStoragePath("2026-09-22", "rep-start-bbb", "usr-1", 0);
  assert.notEqual(a, b);
  assert.ok(isAllowedStoragePath(a), a);
  assert.ok(isAllowedStoragePath(b), b);
});

test("ścieżka podpisu przechodzi walidator nawet przy dziwnym id pracownika", () => {
  const p = signatureStoragePath("2026-09-22", "rep-start-1", "usr/../x y", 3);
  assert.ok(isAllowedStoragePath(p), p);
  assert.ok(!p.includes(".."));
});

test("sent_at bierze czas złożenia z urządzenia, a nie z chwili dosłania", () => {
  const now = Date.parse("2026-09-22T18:00:00Z");
  assert.equal(fieldSubmittedAt("2026-09-22T06:45:00.000Z", now), "2026-09-22T06:45:00.000Z");
});

test("sent_at odrzuca daty z przyszłości i śmieci", () => {
  const now = Date.parse("2026-09-22T18:00:00Z");
  assert.equal(fieldSubmittedAt("2026-09-23T18:00:00Z", now), new Date(now).toISOString());
  assert.equal(fieldSubmittedAt("wczoraj", now), new Date(now).toISOString());
  assert.equal(fieldSubmittedAt(undefined, now), new Date(now).toISOString());
});


function h(map: Record<string, string>) {
  return { get: (n: string) => map[n.toLowerCase()] ?? null };
}

test("limiter bierze adres dopisany przez Traefika, a nie podany przez klienta", () => {
  assert.equal(clientIpFromHeaders(h({ "x-forwarded-for": "1.2.3.4, 83.10.20.30" })), "83.10.20.30");
  assert.equal(clientIpFromHeaders(h({ "x-forwarded-for": "83.10.20.30" })), "83.10.20.30");
  assert.equal(clientIpFromHeaders(h({ "x-real-ip": "83.10.20.30" })), "83.10.20.30");
  assert.equal(clientIpFromHeaders(h({})), "unknown");
});
