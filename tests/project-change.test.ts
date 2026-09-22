import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aggregateChangeStatus,
  canEditChange,
  changePhotoPath,
  changePhotoPrefix,
  changeSignaturePath,
  changePdfPath,
  formatChangeNumber,
  isAcceptorOnly,
  canInitiateChanges,
  validateChangeContent,
} from "@/lib/project-change";
import { isAllowedStoragePath } from "@/lib/storage-paths";

const d = (decision: "PENDING" | "ACCEPTED" | "REJECTED" | "SUPERSEDED") => ({ decision });

test("status zbiorczy: oczekuje, dopóki ktoś nie zdecydował", () => {
  assert.deepEqual(aggregateChangeStatus([d("PENDING"), d("PENDING")]), {
    status: "PENDING",
    complete: false,
  });
  assert.deepEqual(aggregateChangeStatus([d("ACCEPTED"), d("PENDING")]), {
    status: "PENDING",
    complete: false,
  });
});

test("status zbiorczy: komplet zgodnych decyzji", () => {
  assert.deepEqual(aggregateChangeStatus([d("ACCEPTED"), d("ACCEPTED")]), {
    status: "ACCEPTED",
    complete: true,
  });
  assert.deepEqual(aggregateChangeStatus([d("REJECTED")]), { status: "REJECTED", complete: true });
});

test("status zbiorczy: sporna od pierwszej sprzecznej decyzji", () => {
  assert.equal(aggregateChangeStatus([d("ACCEPTED"), d("REJECTED"), d("PENDING")]).status, "DISPUTED");
  assert.deepEqual(aggregateChangeStatus([d("ACCEPTED"), d("REJECTED")]), {
    status: "DISPUTED",
    complete: true,
  });
});

test("status zbiorczy pomija decyzje nieaktualne", () => {
  assert.deepEqual(aggregateChangeStatus([d("SUPERSEDED"), d("ACCEPTED")]), {
    status: "ACCEPTED",
    complete: true,
  });
  assert.deepEqual(aggregateChangeStatus([]), { status: "PENDING", complete: false });
});

test("numer karty ZM/RRRR/NNNN", () => {
  assert.equal(formatChangeNumber(2026, 7), "ZM/2026/0007");
  assert.equal(formatChangeNumber(2026, 12345), "ZM/2026/12345");
});

test("edycja tylko przez autora i tylko przed pierwszą akceptacją", () => {
  assert.ok(canEditChange({ authorId: "a", lockedAt: undefined }, "a"));
  assert.ok(!canEditChange({ authorId: "a", lockedAt: "2026-09-22T10:00:00Z" }, "a"));
  assert.ok(!canEditChange({ authorId: "a", lockedAt: undefined }, "b"));
});

test("role: akceptujący bez uprawnień brygadzisty widzi tylko zmiany", () => {
  assert.ok(isAcceptorOnly({ canAcceptChanges: true }));
  assert.ok(!isAcceptorOnly({ canAcceptChanges: true, isForeman: true }));
  assert.ok(!isAcceptorOnly({ canAcceptChanges: false }));
  assert.ok(canInitiateChanges({ isAdmin: true }));
  assert.ok(!canInitiateChanges({ canAcceptChanges: true } as never));
});

test("ścieżki karty przechodzą walidator bucketu i trzymają się prefiksu", () => {
  const p = changePhotoPath("chg-1234", "jest", "photo-ab/cd");
  assert.ok(p.startsWith(changePhotoPrefix("chg-1234")));
  assert.ok(isAllowedStoragePath(p), p);
  assert.ok(isAllowedStoragePath(changeSignaturePath("chg-1234", 2, "usr-1")));
  assert.ok(isAllowedStoragePath(changePdfPath("chg-1234", 2)));
  // Zdjęcie innej karty nie ma tego samego prefiksu
  assert.ok(!changePhotoPath("chg-9999", "jest", "x").startsWith(changePhotoPrefix("chg-1234")));
});

test("walidacja treści: nazwa, plac i niepuste sekcje", () => {
  const ok = {
    name: "Przesunięcie ściany",
    siteId: "site-1",
    current: { description: "jest tak", photos: [] },
    target: { description: "", photos: [{ id: "p", path: "x", takenAt: "" }] },
  };
  assert.equal(validateChangeContent(ok), null);
  assert.match(validateChangeContent({ ...ok, name: "  " }) || "", /nazwę/);
  assert.match(validateChangeContent({ ...ok, siteId: "" }) || "", /plac/);
  assert.match(
    validateChangeContent({ ...ok, current: { description: " ", photos: [] } }) || "",
    /Jest/
  );
});
