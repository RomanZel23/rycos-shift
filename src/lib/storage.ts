import { ConstructionSite, DiscussedTopicTemplate, User, TenantSettings, DailyReport, PdfTemplate } from "@/types";

// Brak wpisów na sztywno - wszystkie dane (użytkownicy, place budowy, tematy, szablony)
// są w 100% pobierane bezpośrednio z bazy danych Supabase (PostgreSQL).
export const INITIAL_USERS: User[] = [];
export const INITIAL_SITES: ConstructionSite[] = [];
export const INITIAL_TOPIC_TEMPLATES: DiscussedTopicTemplate[] = [];
export const INITIAL_PDF_TEMPLATES: PdfTemplate[] = [];

/**
 * Etap 4: listy odbiorców są puste, bo prawdziwe adresy trzyma tabela
 * `tenant_settings` i tylko ona liczy się przy wysyłce — `resolveEmailConfig`
 * w src/lib/email.ts czyta je po stronie serwera i nigdy nie zagląda tutaj.
 *
 * Adresy zaszyte w kodzie były podwójnie szkodliwe. Po pierwsze, dane osobowe
 * pracowników leżały w repozytorium i w bundlu wysyłanym do każdej przeglądarki.
 * Po drugie, rozjeżdżały się z bazą: gdy ktoś zmienił odbiorców w panelu, panel
 * i tak potrafił pokazać starą listę z kodu, więc nie było wiadomo, dokąd
 * naprawdę idą raporty.
 *
 * To jest wyłącznie kształt obiektu na czas, zanim pierwsza synchronizacja
 * przyniesie ustawienia z bazy.
 */
export const INITIAL_SETTINGS: TenantSettings = {
  tenantId: "tenant-sb-tech-poznan",
  organizationName: "SolutionsBay / SB Technology",
  logoText: "SB Technology",
  logoSubtitle: "RYCOS Shift workflow",
  startShiftEmailRecipients: [],
  endShiftEmailRecipients: [],
  resendFromEmail: "",
  storageFolder: "Raporty_RYCOS_Shift_Poznan",
};

// Klucze LocalStorage dla pamięci podręcznej (offline cache)
const STORAGE_KEYS = {
  USERS: "rycos_shift_users_v1",
  SITES: "rycos_shift_sites_v1",
  TOPICS: "rycos_shift_topics_v1",
  SETTINGS: "rycos_shift_settings_v1",
  REPORTS: "rycos_shift_reports_v1",
  TEMPLATES: "rycos_shift_templates_v1",
  CURRENT_USER_ID: "rycos_shift_current_user_v1",
  LOGGED_USER: "rycos_shift_logged_user_v1",
  SYNC_SCHEMA: "rycos_shift_sync_schema_v1",
};

/** Po tylu nieudanych próbach przestajemy dosyłać raport przy każdym odświeżeniu. */
export const MAX_SYNC_ATTEMPTS = 5;

export const getStoredUsers = (): User[] => {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveStoredUsers = (users: User[]): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
};

export const getStoredSites = (): ConstructionSite[] => {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SITES);
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveStoredSites = (sites: ConstructionSite[]): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.SITES, JSON.stringify(sites));
};

export const getStoredTopics = (): DiscussedTopicTemplate[] => {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TOPICS);
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveStoredTopics = (topics: DiscussedTopicTemplate[]): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(topics));
};

export const getStoredSettings = (): TenantSettings => {
  if (typeof window === "undefined") return INITIAL_SETTINGS;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!data) return INITIAL_SETTINGS;
    // Etap 4: usunięta łatka podmieniająca stare adresy `raporty-start@` /
    // `raporty-koniec@` na listę z kodu. Adresów tych nie ma już w bazie, a łatka
    // nadpisywała cache własnymi wpisami przy każdym odczycie — czyli robiła
    // dokładnie to, przed czym miała chronić.
    return JSON.parse(data) as TenantSettings;
  } catch {
    return INITIAL_SETTINGS;
  }
};

export const saveStoredSettings = (settings: TenantSettings): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
};

export const getStoredReports = (): DailyReport[] => {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEYS.REPORTS);
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveStoredReport = (report: DailyReport): void => {
  if (typeof window === "undefined") return;
  try {
    const existing = getStoredReports();
    // Sprawdź czy raport już istnieje (np. aktualizacja)
    const index = existing.findIndex((r) => r.id === report.id);
    if (index >= 0) {
      existing[index] = report;
    } else {
      existing.unshift(report);
    }
    localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(existing));
  } catch (err) {
    console.warn("Storage save report error:", err);
  }
};

/**
 * Usuwa raport z lokalnej kopii archiwum. Wołane po skasowaniu wiersza
 * w bazie — bez tego wpis wisiałby na liście do następnej synchronizacji,
 * a przy braku znacznika cloudSyncedAt urządzenie próbowałoby go dosłać.
 */
export const removeStoredReport = (id: string): void => {
  if (typeof window === "undefined" || !id) return;
  try {
    const remaining = getStoredReports().filter((r) => r.id !== id);
    localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(remaining));
  } catch (err) {
    console.warn("Storage remove report error:", err);
  }
};

/** Nadpisuje całą lokalną listę raportów (używane po scaleniu z bazą). */
export const saveStoredReports = (reports: DailyReport[]): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(reports));
  } catch (err) {
    console.warn("Storage save reports error:", err);
  }
};

/**
 * Oznacza raport jako potwierdzony w bazie. Od tej chwili jego brak w chmurze
 * znaczy „skasowany w bazie", a nie „jeszcze niedosłany" — dzięki temu raport
 * usunięty w Supabase nie wraca przy kolejnej synchronizacji.
 */
export const markStoredReportSynced = (
  id: string,
  replacement?: Partial<DailyReport>
): void => {
  if (typeof window === "undefined") return;
  try {
    const reports = getStoredReports().map((r) =>
      r.id === id
        ? {
            ...r,
            ...(replacement || {}),
            cloudSyncedAt: new Date().toISOString(),
            syncAttempts: 0,
          }
        : r
    );
    saveStoredReports(reports);
  } catch (err) {
    console.warn("Storage mark synced error:", err);
  }
};

/** Zwiększa licznik nieudanych prób dosłania. */
export const bumpStoredReportAttempt = (id: string): void => {
  if (typeof window === "undefined") return;
  try {
    const reports = getStoredReports().map((r) =>
      r.id === id ? { ...r, syncAttempts: (r.syncAttempts || 0) + 1 } : r
    );
    saveStoredReports(reports);
  } catch (err) {
    console.warn("Storage bump attempt error:", err);
  }
};

/**
 * Jednorazowa migracja cache'u urządzenia.
 *
 * Raporty zapisane przed wprowadzeniem cloudSyncedAt nie mają tego znacznika,
 * więc nowa logika uznałaby je za niedosłane i wypchnęła z powrotem do bazy —
 * czyli dokładnie ten sam błąd, który naprawiamy. Wszystkie pochodzą z bazy
 * (stara pętla dbała o to aż nadto), więc stemplujemy je jako zsynchronizowane.
 */
export const ensureReportSyncSchema = (): void => {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(STORAGE_KEYS.SYNC_SCHEMA)) return;
    const stamped = getStoredReports().map((r) => ({
      ...r,
      cloudSyncedAt: r.cloudSyncedAt || new Date().toISOString(),
      syncAttempts: 0,
    }));
    saveStoredReports(stamped);
    localStorage.setItem(STORAGE_KEYS.SYNC_SCHEMA, "v1");
  } catch (err) {
    console.warn("Storage sync-schema migration error:", err);
  }
};

export const getStoredCurrentUserId = (): string => {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID) || "";
  } catch {
    return "";
  }
};

export const setStoredCurrentUserId = (id: string): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, id);
};

export const getStoredPdfTemplates = (): PdfTemplate[] => {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveStoredPdfTemplates = (templates: PdfTemplate[]): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
};

export const getStoredLoggedUser = (): User | null => {
  if (typeof window === "undefined") return null;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.LOGGED_USER);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
};

export const setStoredLoggedUser = (user: User | null): void => {
  if (typeof window === "undefined") return;
  if (!user) {
    localStorage.removeItem(STORAGE_KEYS.LOGGED_USER);
  } else {
    localStorage.setItem(STORAGE_KEYS.LOGGED_USER, JSON.stringify(user));
  }
};
