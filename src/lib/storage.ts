import { ConstructionSite, DiscussedTopicTemplate, User, TenantSettings, DailyReport, PdfTemplate } from "@/types";

export const INITIAL_USERS: User[] = [
  {
    id: "usr-admin-1",
    firstName: "Marcin",
    lastName: "Bajda",
    role: "Kierownik Operacyjny / Admin",
    isForeman: true,
    isAdmin: true,
    login: "m.bajda",
    password: "password123",
    createdAt: new Date().toISOString(),
  },
  {
    id: "usr-foreman-1",
    firstName: "Jan",
    lastName: "Kowalski",
    role: "Brygadzista Główny",
    isForeman: true,
    isAdmin: false,
    login: "j.kowalski",
    password: "password123",
    createdAt: new Date().toISOString(),
  },
  {
    id: "usr-foreman-2",
    firstName: "Marek",
    lastName: "Wiśniewski",
    role: "Brygadzista Montażu",
    isForeman: true,
    isAdmin: false,
    login: "m.wisniewski",
    password: "password123",
    createdAt: new Date().toISOString(),
  },
  {
    id: "usr-worker-1",
    firstName: "Piotr",
    lastName: "Nowak",
    role: "Montażysta konstrukcji",
    isForeman: false,
    isAdmin: false,
    login: "p.nowak",
    password: "password123",
    createdAt: new Date().toISOString(),
  },
  {
    id: "usr-worker-2",
    firstName: "Tomasz",
    lastName: "Zieliński",
    role: "Cieśla szalunkowy",
    isForeman: false,
    isAdmin: false,
    login: "t.zielinski",
    password: "password123",
    createdAt: new Date().toISOString(),
  },
  {
    id: "usr-worker-3",
    firstName: "Andrzej",
    lastName: "Wójcik",
    role: "Zbrojarz",
    isForeman: false,
    isAdmin: false,
    login: "a.wojcik",
    password: "password123",
    createdAt: new Date().toISOString(),
  },
  {
    id: "usr-worker-4",
    firstName: "Krzysztof",
    lastName: "Kozłowski",
    role: "Operator sprzętu",
    isForeman: false,
    isAdmin: false,
    login: "k.kozlowski",
    password: "password123",
    createdAt: new Date().toISOString(),
  },
  {
    id: "usr-worker-5",
    firstName: "Michał",
    lastName: "Lewandowski",
    role: "Pomocnik budowlany",
    isForeman: false,
    isAdmin: false,
    login: "m.lewandowski",
    password: "password123",
    createdAt: new Date().toISOString(),
  },
];

export const INITIAL_SITES: ConstructionSite[] = [
  {
    id: "site-1",
    name: "Poznań - Piątkowo",
    address: "ul. Wojciechowskiego, Poznań",
    active: true,
  },
  {
    id: "site-2",
    name: "Poznań - Franowo",
    address: "ul. Szwedzka, Poznań",
    active: true,
  },
  {
    id: "site-3",
    name: "Poznań - Grunwald",
    address: "ul. Marcelińska, Poznań",
    active: true,
  },
];

export const INITIAL_TOPIC_TEMPLATES: DiscussedTopicTemplate[] = [
  {
    id: "top-1",
    title: "Szkolenie BHP i instruktaż stanowiskowy przed rozpoczęciem prac",
    category: "BHP",
  },
  {
    id: "top-2",
    title: "Weryfikacja środków ochrony indywidualnej (szelki, kaski, okulary, rękawice)",
    category: "BHP",
  },
  {
    id: "top-3",
    title: "Rozdysponowanie zadań montażowych na dzień bieżący",
    category: "Organizacja",
  },
  {
    id: "top-4",
    title: "Procedury bezpieczeństwa przy pracach na wysokości i rusztowaniach",
    category: "BHP",
  },
  {
    id: "top-5",
    title: "Sprawdzenie stanu technicznego elektronarzędzi i maszyn",
    category: "Sprzęt",
  },
  {
    id: "top-6",
    title: "Koordynacja transportu materiałów i strefy rozładunku",
    category: "Logistyka",
  },
  {
    id: "top-7",
    title: "Zasady komunikacji radiowej i sygnalizacji z operatorem żurawia",
    category: "Organizacja",
  },
];

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
  resendFromEmail: "raporty@solutionsbay.pl",
  storageFolder: "Raporty_RYCOS_Shift_Poznan",
};

export const INITIAL_PDF_TEMPLATES: PdfTemplate[] = [
  {
    id: "tpl-start-shift-sb",
    tenantId: "tenant-sb-tech-poznan",
    reportType: "START_SHIFT",
    name: "Szablon Rozpoczęcia Prac SB Technology",
    htmlContent: "DEFAULT_HTML_START_SHIFT",
    active: true,
    updatedAt: new Date().toISOString(),
  },
  {
    id: "tpl-end-shift-sb",
    tenantId: "tenant-sb-tech-poznan",
    reportType: "END_SHIFT",
    name: "Szablon Zakończenia Prac SB Technology",
    htmlContent: "DEFAULT_HTML_END_SHIFT",
    active: true,
    updatedAt: new Date().toISOString(),
  },
];

// Klucze LocalStorage dla trwałości danych w przeglądarce
const STORAGE_KEYS = {
  USERS: "rycos_shift_users_v1",
  SITES: "rycos_shift_sites_v1",
  TOPICS: "rycos_shift_topics_v1",
  SETTINGS: "rycos_shift_settings_v1",
  REPORTS: "rycos_shift_reports_v1",
  TEMPLATES: "rycos_shift_templates_v1",
  CURRENT_USER_ID: "rycos_shift_current_user_v1",
};

export const getStoredUsers = (): User[] => {
  if (typeof window === "undefined") return INITIAL_USERS;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.USERS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
      return INITIAL_USERS;
    }
    const parsed: User[] = JSON.parse(data);
    // Automatyczna migracja jeśli w pamięci telefonu pozostał Roman Administrator
    const migrated = parsed.map((u) => {
      if (u.id === "usr-admin-1" && u.firstName === "Roman") {
        return {
          ...u,
          firstName: "Marcin",
          lastName: "Bajda",
          login: "m.bajda",
        };
      }
      return u;
    });
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(migrated));
    return migrated;
  } catch {
    return INITIAL_USERS;
  }
};

export const saveStoredUsers = (users: User[]): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
};

export const getStoredSites = (): ConstructionSite[] => {
  if (typeof window === "undefined") return INITIAL_SITES;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SITES);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.SITES, JSON.stringify(INITIAL_SITES));
      return INITIAL_SITES;
    }
    return JSON.parse(data);
  } catch {
    return INITIAL_SITES;
  }
};

export const saveStoredSites = (sites: ConstructionSite[]): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.SITES, JSON.stringify(sites));
};

export const getStoredTopics = (): DiscussedTopicTemplate[] => {
  if (typeof window === "undefined") return INITIAL_TOPIC_TEMPLATES;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TOPICS);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.TOPICS, JSON.stringify(INITIAL_TOPIC_TEMPLATES));
      return INITIAL_TOPIC_TEMPLATES;
    }
    return JSON.parse(data);
  } catch {
    return INITIAL_TOPIC_TEMPLATES;
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
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(INITIAL_SETTINGS));
      return INITIAL_SETTINGS;
    }
    return JSON.parse(data);
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

export const saveStoredReport = (report: DailyReport): DailyReport[] => {
  if (typeof window === "undefined") return [report];
  try {
    const current = getStoredReports();
    // Sprawdź czy już istnieje (np. aktualizacja)
    const existingIndex = current.findIndex((r) => r.id === report.id);
    let updated: DailyReport[];
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = report;
    } else {
      updated = [report, ...current];
    }
    localStorage.setItem(STORAGE_KEYS.REPORTS, JSON.stringify(updated));
    return updated;
  } catch {
    return [report];
  }
};

export const getStoredCurrentUserId = (): string => {
  if (typeof window === "undefined") return INITIAL_USERS[0].id;
  try {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_USER_ID) || INITIAL_USERS[0].id;
  } catch {
    return INITIAL_USERS[0].id;
  }
};

export const setStoredCurrentUserId = (userId: string): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER_ID, userId);
};

export const getStoredPdfTemplates = (): PdfTemplate[] => {
  if (typeof window === "undefined") return INITIAL_PDF_TEMPLATES;
  try {
    const data = localStorage.getItem(STORAGE_KEYS.TEMPLATES);
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(INITIAL_PDF_TEMPLATES));
      return INITIAL_PDF_TEMPLATES;
    }
    return JSON.parse(data);
  } catch {
    return INITIAL_PDF_TEMPLATES;
  }
};

export const saveStoredPdfTemplates = (templates: PdfTemplate[]): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.TEMPLATES, JSON.stringify(templates));
};
