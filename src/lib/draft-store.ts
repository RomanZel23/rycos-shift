import { AttendanceRecord, GeoLocationData, PhotoDocumentationItem } from "@/types";

/**
 * Etap 4 — szkice formularzy w IndexedDB.
 *
 * Problem: wyjście z formularza fotorelacji (przypadkowe cofnięcie, przełączenie
 * zakładki, wygaszenie ekranu na tyle długo, że iOS ubije stronę) kasowało cały
 * stan. Zdjęcia to jedyne dane w tym formularzu, których nie da się odtworzyć
 * z pamięci — reszta to wybór z listy.
 *
 * Dlaczego IndexedDB, a nie localStorage: dziewięć zdjęć po kompresji to około
 * 2–3 MB w base64, a localStorage ma ok. 5 MB na całą aplikację i dzieli je
 * z cache'em raportów. Zapis szkicu wywalałby quota i — jak już widzieliśmy
 * przy raportach — robiłby to po cichu. IndexedDB ma limity liczone w setkach
 * megabajtów i nie konkuruje o tę samą pulę.
 *
 * Zdjęcia trzymamy jako data URL, czyli w tej samej postaci, w jakiej są
 * w stanie formularza. Blob byłby o jedną trzecią oszczędniejszy, ale wymagałby
 * przepisania całego obiegu zdjęć — do rozważenia osobno.
 */

const DB_NAME = "rycos-shift";
const DB_VERSION = 1;
const STORE = "drafts";

/** Po tylu dniach szkic uznajemy za porzucony i kasujemy przy starcie. */
const MAX_AGE_DAYS = 7;

export type DraftKind = "START_SHIFT" | "END_SHIFT";

export interface StartShiftDraft {
  date: string;
  time: string;
  siteId: string;
  foremanId: string;
  location: GeoLocationData;
  discussedTopics: string[];
  attendanceList: AttendanceRecord[];
}

export interface EndShiftDraft {
  date: string;
  time: string;
  siteId: string;
  foremanId: string;
  location: GeoLocationData;
  photos: PhotoDocumentationItem[];
}

export type DraftPayload = StartShiftDraft | EndShiftDraft;

interface DraftRecord {
  kind: DraftKind;
  updatedAt: string;
  payload: DraftPayload;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !("indexedDB" in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "kind" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    // Tryb prywatny, brak miejsca, zablokowana baza — szkice są wygodą,
    // nie mechanizmem krytycznym, więc po cichu rezygnujemy.
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

function tx<T>(
  db: IDBDatabase,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | null> {
  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE, mode);
      const request = run(transaction.objectStore(STORE));
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
      transaction.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function saveDraft(kind: DraftKind, payload: DraftPayload): Promise<void> {
  const db = await openDb();
  if (!db) return;
  const record: DraftRecord = { kind, updatedAt: new Date().toISOString(), payload };
  await tx(db, "readwrite", (store) => store.put(record));
  db.close();
}

export async function loadDraft(
  kind: DraftKind
): Promise<{ payload: DraftPayload; updatedAt: string } | null> {
  const db = await openDb();
  if (!db) return null;
  const record = (await tx<DraftRecord>(db, "readonly", (store) => store.get(kind))) as
    | DraftRecord
    | null;
  db.close();

  if (!record?.payload || !record.updatedAt) return null;

  const ageMs = Date.now() - new Date(record.updatedAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs > MAX_AGE_DAYS * 24 * 60 * 60 * 1000) {
    await clearDraft(kind);
    return null;
  }

  return { payload: record.payload, updatedAt: record.updatedAt };
}

export async function clearDraft(kind: DraftKind): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await tx(db, "readwrite", (store) => store.delete(kind));
  db.close();
}

/** Czy szkic zawiera cokolwiek wartego przywracania. */
export function draftHasContent(kind: DraftKind, payload: DraftPayload): boolean {
  if (kind === "END_SHIFT") {
    return ((payload as EndShiftDraft).photos || []).length > 0;
  }
  const start = payload as StartShiftDraft;
  return (start.attendanceList || []).length > 0 || (start.discussedTopics || []).length > 1;
}

/** Godzina ostatniego zapisu do pokazania w banerze. */
export function formatDraftTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pl-PL", {
      timeZone: "Europe/Warsaw",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return "";
  }
}
