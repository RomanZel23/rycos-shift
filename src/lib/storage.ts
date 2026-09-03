import { ConstructionSite, DiscussedTopicTemplate, User, TenantSettings, DailyReport, PdfTemplate } from "@/types";

// Brak wpisów na sztywno - wszystkie dane (użytkownicy, place budowy, tematy, szablony)
// są w 100% pobierane bezpośrednio z bazy danych Supabase (PostgreSQL).
export const INITIAL_USERS: User[] = [];
export const INITIAL_SITES: ConstructionSite[] = [];
export const INITIAL_TOPIC_TEMPLATES: DiscussedTopicTemplate[] = [];
export const INITIAL_PDF_TEMPLATES: PdfTemplate[] = [];

export const INITIAL_SETTINGS: TenantSettings = {
  tenantId: "tenant-sb-tech-poznan",
  organizationName: "SolutionsBay / SB Technology",
  logoText: "SB Technology",
  logoSubtitle: "RYCOS Shift workflow",
  startShiftEmailRecipients: [
    "raporty-start@solutionsbay.pl",
    "kierownik.budowy@solutionsbay.pl"
  ],
  endShiftEmailRecipients: [
    "raporty-koniec@solutionsbay.pl",
    "kierownik.budowy@solutionsbay.pl",
    "zarzad@solutionsbay.pl"
  ],
  resendApiKey: "",
  resendFromEmail: "raporty@shift.rycos.eu",
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
};

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
    const parsed: TenantSettings = JSON.parse(data);
    if (parsed.resendFromEmail && parsed.resendFromEmail.includes("solutionsbay.pl")) {
      parsed.resendFromEmail = "raporty@shift.rycos.eu";
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(parsed));
    }
    return parsed;
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
