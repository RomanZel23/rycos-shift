"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Header, ActiveTab } from "@/components/Header";
import { StartShiftForm } from "@/components/StartShiftForm";
import { EndShiftForm } from "@/components/EndShiftForm";
import { ReportArchive } from "@/components/ReportArchive";
import { AdminSettings } from "@/components/AdminSettings";
import { LoginForm } from "@/components/LoginForm";
import { AccessGate } from "@/components/AccessGate";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import { ProjectChangesTab } from "@/components/ProjectChangesTab";
import { isAcceptorOnly } from "@/lib/project-change";
import {
  User,
  ConstructionSite,
  DiscussedTopicTemplate,
  TenantSettings,
  DailyReport,
} from "@/types";
import { APP_VERSION } from "@/lib/version";
import {
  INITIAL_SETTINGS,
  getStoredUsers,
  saveStoredUsers,
  getStoredSites,
  saveStoredSites,
  getStoredTopics,
  saveStoredTopics,
  getStoredSettings,
  saveStoredSettings,
  getStoredReports,
  saveStoredReport,
  saveStoredReports,
  removeStoredReport,
  markStoredReportSynced,
  bumpStoredReportAttempt,
  ensureReportSyncSchema,
  MAX_SYNC_ATTEMPTS,
} from "@/lib/storage";

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("START_SHIFT");
  // Archiwum ma dwie sekcje: raporty dzienne i zmiany w projekcie (punkt 11).
  const [archiveSection, setArchiveSection] = useState<"REPORTS" | "CHANGES">("REPORTS");
  // Karta do otwarcia po wejściu z linku w mailu (/?zmiana=<id>).
  const [focusChangeId, setFocusChangeId] = useState<string | null>(null);

  // Wszystkie stany pobierane w 100% z bazy danych Supabase (brak wpisów na sztywno)
  const [users, setUsers] = useState<User[]>([]);
  const [sites, setSites] = useState<ConstructionSite[]>([]);
  const [topics, setTopics] = useState<DiscussedTopicTemplate[]>([]);
  const [settings, setSettings] = useState<TenantSettings>(INITIAL_SETTINGS);
  const [reports, setReports] = useState<DailyReport[]>([]);
  
  // Stan autentykacji. Źródłem prawdy jest ciasteczko sesji po stronie serwera —
  // localStorage nie przechowuje już zalogowanego użytkownika, bo dało się go
  // tam po prostu dopisać.
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isSessionChecked, setIsSessionChecked] = useState(false);

  // Stan synchronizacji z bazą Supabase
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(true);

  // Etap 0: bramka dostępu do API (autoryzacja przeglądarki kodem)
  const [isGateChecked, setIsGateChecked] = useState(false);
  const [isGateLocked, setIsGateLocked] = useState(false);

  // Jedna synchronizacja naraz. Start aplikacji, wejście do Archiwum i przycisk
  // „Odśwież" potrafiły uruchomić ją równolegle — każda wysyłała wtedy te same
  // niedosłane raporty i zapisywała do localStorage własną wersję listy.
  const syncInFlight = useRef<Promise<void> | null>(null);

  // Funkcja pobierania najświeższych danych bezpośrednio z bazy danych Supabase
  const syncWithDatabase = useCallback((): Promise<void> => {
    if (syncInFlight.current) return syncInFlight.current;
    const run = runSync().finally(() => {
      syncInFlight.current = null;
    });
    syncInFlight.current = run;
    return run;

    async function runSync(): Promise<void> {
    try {
      setIsSyncing(true);
      const res = await fetch("/api/db/sync");

      // Bramka przeglądarki albo wygasła sesja użytkownika
      if (res.status === 401 || res.status === 503) {
        const body = await res.json().catch(() => null);
        if (body?.code === "GATE_LOCKED" || body?.code === "GATE_NOT_CONFIGURED") {
          setIsGateLocked(true);
          setIsGateChecked(true);
          return;
        }
        if (body?.code === "UNAUTHENTICATED") {
          setCurrentUser(null);
          return;
        }
      }

      const resJson = await res.json();
      if (resJson.success && resJson.isConnected && resJson.data) {
        setIsSupabaseConnected(true);
        const {
          users: dbUsers,
          sites: dbSites,
          topics: dbTopics,
          settings: dbSettings,
          reports: dbReports,
        } = resJson.data;

        if (Array.isArray(dbUsers)) {
          setUsers(dbUsers);
          saveStoredUsers(dbUsers);
        }
        if (Array.isArray(dbSites)) {
          setSites(dbSites);
          saveStoredSites(dbSites);
        }
        if (Array.isArray(dbTopics)) {
          setTopics(dbTopics);
          saveStoredTopics(dbTopics);
        }
        if (dbSettings) {
          setSettings(dbSettings);
          saveStoredSettings(dbSettings);
        }
        if (Array.isArray(dbReports)) {
          // Raport lokalny nieobecny w chmurze może znaczyć dwie różne rzeczy:
          //   a) nigdy nie potwierdzono jego zapisu (brak cloudSyncedAt) -> dosyłamy,
          //   b) był już potwierdzony -> ktoś skasował go w bazie, usuwamy z cache.
          // Brak tego rozróżnienia powodował, że skasowane rekordy wracały do bazy
          // przy każdym odświeżeniu archiwum.
          const cloudIds = new Set(dbReports.map((r: DailyReport) => r.id));
          const localReports = getStoredReports();

          // Raport obecny w bazie jest z definicji zsynchronizowany. Bez tego
          // stempla wersja z API nadpisywałaby lokalny znacznik i raport
          // skasowany później w bazie znów wyglądałby na niedosłany.
          const syncedNow = new Date().toISOString();
          const cloudReports: DailyReport[] = dbReports.map((r: DailyReport) => ({
            ...r,
            cloudSyncedAt: syncedNow,
            syncAttempts: 0,
          }));

          const toUpload = localReports.filter(
            (r) =>
              !cloudIds.has(r.id) &&
              !r.cloudSyncedAt &&
              (r.syncAttempts || 0) < MAX_SYNC_ATTEMPTS
          );

          const justUploaded: DailyReport[] = [];
          for (const missing of toUpload) {
            try {
              const uploadRes = await fetch("/api/db/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "SAVE_REPORT", report: missing }),
              });
              const uploadJson = await uploadRes.json();
              if (uploadJson.success) {
                // optimizedReport ma lekkie adresy /api/files zamiast base64
                const light: DailyReport = {
                  ...missing,
                  ...(uploadJson.optimizedReport || {}),
                  cloudSyncedAt: new Date().toISOString(),
                  syncAttempts: 0,
                };
                markStoredReportSynced(missing.id, uploadJson.optimizedReport);
                justUploaded.push(light);
              } else {
                bumpStoredReportAttempt(missing.id);
              }
            } catch (uploadErr) {
              console.warn("Auto-sync missing report error:", uploadErr);
              bumpStoredReportAttempt(missing.id);
            }
          }

          // Nadal lokalne: niedosłane (w tym te po wyczerpaniu prób), bez tych z tej rundy
          const stillPending = getStoredReports().filter(
            (r) =>
              !cloudIds.has(r.id) &&
              !r.cloudSyncedAt &&
              !justUploaded.some((j) => j.id === r.id)
          );

          const mergedReports = [...justUploaded, ...stillPending, ...cloudReports];
          setReports(mergedReports);
          saveStoredReports(mergedReports);
        }
      } else {
        setIsSupabaseConnected(resJson.isConnected ?? false);
      }
    } catch (err) {
      console.warn("Supabase background sync skipped (offline or unconfigured):", err);
      setIsSupabaseConnected(false);
    } finally {
      setIsSyncing(false);
    }
    }
  }, []);

  // Przełączanie aktywnej zakładki
  /**
   * Usunięcie raportu z archiwum (tylko administrator — serwer i tak sprawdza
   * uprawnienie osobno). Po skasowaniu wiersza zdejmujemy raport z widoku
   * i z lokalnej kopii. Bez tego drugiego kroku wpis wróciłby przy najbliższym
   * odświeżeniu — urządzenie uznałoby go za niedosłany i wysłało ponownie.
   */
  const handleDeleteReport = useCallback(
    async (reportId: string): Promise<{ ok: boolean; message: string }> => {
      try {
        const res = await fetch("/api/reports/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportId }),
        });
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.success) {
          return {
            ok: false,
            message: data?.message || "Nie udało się usunąć raportu.",
          };
        }

        removeStoredReport(reportId);
        setReports((prev) => prev.filter((r) => r.id !== reportId));
        return { ok: true, message: data.message || "Raport usunięty." };
      } catch {
        return { ok: false, message: "Brak połączenia z serwerem." };
      }
    },
    []
  );

  const handleTabChange = useCallback((newTab: ActiveTab) => {
    setActiveTab(newTab);
    // Gdy użytkownik wchodzi do Archiwum, natychmiast odśwież z bazy Supabase
    if (newTab === "ARCHIVE") {
      syncWithDatabase();
    }
  }, [syncWithDatabase]);

  // Etap 0: sprawdzenie bramki przed pierwszym odpytaniem API
  useEffect(() => {
    let cancelled = false;
    fetch("/api/gate")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setIsGateLocked(Boolean(data?.required) && !data?.unlocked);
      })
      .catch(() => {
        // Offline — nie blokuj aplikacji, dane z cache localStorage nadal działają
      })
      .finally(() => {
        if (!cancelled) setIsGateChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGateUnlocked = useCallback(() => {
    setIsGateLocked(false);
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data?.user) setCurrentUser(data.user as User);
      })
      .catch(() => {});
  }, []);

  // Inicjalizacja z localStorage i synchronizacja w tle przy starcie
  useEffect(() => {
    try {
      // Jednorazowo ostemplowaj stary cache raportów jako zsynchronizowany,
      // inaczej pierwsze odświeżenie po wdrożeniu wypchnęłoby go z powrotem do bazy.
      ensureReportSyncSchema();

      const loadedUsers = getStoredUsers();
      const loadedSites = getStoredSites();
      const loadedTopics = getStoredTopics();
      const loadedSettings = getStoredSettings();
      const loadedReports = getStoredReports();

      if (loadedUsers && loadedUsers.length > 0) setUsers(loadedUsers);
      if (loadedSites && loadedSites.length > 0) setSites(loadedSites);
      if (loadedTopics && loadedTopics.length > 0) setTopics(loadedTopics);
      if (loadedSettings) setSettings(loadedSettings);
      if (loadedReports) setReports(loadedReports);
    } catch (storageErr) {
      console.warn("Storage hydration notice:", storageErr);
    }

  }, []);

  // Kto jest zalogowany — pyta serwer, bo ciasteczko sesji jest httpOnly
  // i przeglądarka nie umie go odczytać.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data?.user) setCurrentUser(data.user as User);
      })
      .catch(() => {
        // offline — zostajemy przy ekranie logowania
      })
      .finally(() => {
        if (!cancelled) setIsSessionChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Dane z bazy pobieramy dopiero, gdy jest sesja — bez niej API i tak zwróci 401.
  useEffect(() => {
    if (currentUser) syncWithDatabase();
  }, [currentUser, syncWithDatabase]);

  // /?zmiana=<id> — z linku w mailu (po PIN-ie) albo z powiadomienia o decyzji.
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("zmiana");
      if (id) {
        setFocusChangeId(id);
        params.delete("zmiana");
        const rest = params.toString();
        window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
      }
    } catch {
      /* brak dostępu do adresu — bez znaczenia */
    }
  }, []);

  // Akceptujący bez uprawnień brygadzisty widzi wyłącznie rejestr zmian,
  // a karta z linku otwiera się w zakładce zmian.
  useEffect(() => {
    if (!currentUser) return;
    if (focusChangeId || isAcceptorOnly(currentUser)) setActiveTab("CHANGES");
  }, [currentUser, focusChangeId]);
  const clearFocus = useCallback(() => setFocusChangeId(null), []);

  // Handlery logowania i wylogowania. Sesję zakłada i kasuje serwer.
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setActiveTab(isAcceptorOnly(user) ? "CHANGES" : "START_SHIFT");
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // brak sieci — i tak czyścimy stan lokalny
    }
    setCurrentUser(null);
    setActiveTab("START_SHIFT");
  };

  /**
   * Zapis konfiguracji z panelu administratora. Wcześniej wynik był ignorowany
   * (`.catch(() => {})`), więc przy odrzuconym zapisie — np. zdublowany login —
   * panel pokazywał „zapisano", a po następnej synchronizacji zmiana znikała.
   * Teraz błąd jest pokazywany, a stan wraca do tego, co faktycznie jest w bazie.
   */
  const pushAdminSync = useCallback(
    async (payload: Record<string, unknown>) => {
      try {
        const res = await fetch("/api/db/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success) {
          window.alert(data?.message || "Nie udało się zapisać zmian w bazie.");
          await syncWithDatabase();
        }
      } catch {
        window.alert("Brak połączenia z serwerem — zmiany nie zostały zapisane w bazie.");
        await syncWithDatabase();
      }
    },
    [syncWithDatabase]
  );

  const handleUpdateUsers = (updated: User[]) => {
    setUsers(updated);
    saveStoredUsers(updated);
    void pushAdminSync({ action: "SYNC_USERS", users: updated });
  };

  const handleUpdateSites = (updated: ConstructionSite[]) => {
    setSites(updated);
    saveStoredSites(updated);
    void pushAdminSync({ action: "SYNC_SITES", sites: updated });
  };

  const handleUpdateTopics = (updated: DiscussedTopicTemplate[]) => {
    setTopics(updated);
    saveStoredTopics(updated);
    void pushAdminSync({ action: "SYNC_TOPICS", topics: updated });
  };

  const handleUpdateSettings = (updated: TenantSettings) => {
    setSettings(updated);
    saveStoredSettings(updated);
    void pushAdminSync({ action: "SYNC_SETTINGS", settings: updated });
  };


  /**
   * Raport jest zapisywany i wysylany przez /api/reports jeszcze w formularzu,
   * wiec tutaj zostaje wylacznie wstawienie gotowego wyniku do stanu i cache'u.
   * Wczesniej ta funkcja robila drugi zapis do bazy.
   */
  const handleReportCreated = (report: DailyReport) => {
    setReports((prev) => [report, ...prev.filter((r) => r.id !== report.id)]);
    saveStoredReport(report);
  };

  // ETAP 0: PRZEGLĄDARKA BEZ AUTORYZACJI -> EKRAN KODU DOSTĘPU PRZED LOGOWANIEM
  if (isGateChecked && isGateLocked) {
    return <AccessGate onUnlocked={handleGateUnlocked} />;
  }

  // Zanim wiadomo, czy jest sesja, nie migaj ekranem logowania
  if (!isSessionChecked) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // JEŚLI UŻYTKOWNIK NIE JEST ZALOGOWANY -> POKAŻ OD RAZU EKRAN LOGOWANIA
  if (!currentUser) {
    return (
      <>
        <PwaInstallPrompt />
        <LoginForm settings={settings} onLogin={handleLogin} />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased selection:bg-sky-500 selection:text-white">
      {/* BANER AUTOMATYCZNEJ INSTALACJI PWA */}
      <PwaInstallPrompt />

      {/* NAGŁÓWEK SYSTEMU Z PROFILEM I WYLOGOWANIEM */}
      <Header
        activeTab={activeTab}
        onTabChange={handleTabChange}
        currentUser={currentUser}
        onLogout={handleLogout}
        settings={settings}
        reportsCount={reports.length}
      />

      {/* GŁÓWNA ZAWARTOŚĆ STRONY */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-3.5 sm:px-6 pt-4 sm:pt-8 pb-20 md:pb-8">
        {activeTab === "CHANGES" && (
          <ProjectChangesTab
            currentUser={currentUser}
            sites={sites}
            users={users}
            reports={reports}
            focusChangeId={focusChangeId}
            onFocusHandled={clearFocus}
          />
        )}

        {activeTab === "START_SHIFT" && !isAcceptorOnly(currentUser) && (
          <StartShiftForm
            sites={sites}
            users={users}
            topicTemplates={topics}
            settings={settings}
            onReportCreated={handleReportCreated}
            onNavigateToArchive={() => handleTabChange("ARCHIVE")}
          />
        )}

        {activeTab === "END_SHIFT" && !isAcceptorOnly(currentUser) && (
          <EndShiftForm
            sites={sites}
            users={users}
            settings={settings}
            onReportCreated={handleReportCreated}
            onNavigateToArchive={() => handleTabChange("ARCHIVE")}
          />
        )}

        {activeTab === "ARCHIVE" && !isAcceptorOnly(currentUser) && (
          <div className="max-w-5xl mx-auto mb-5 flex gap-2">
            <button
              type="button"
              onClick={() => setArchiveSection("REPORTS")}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-2xl text-sm font-black cursor-pointer ${
                archiveSection === "REPORTS"
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-2 border-slate-200 dark:border-slate-800"
              }`}
            >
              Raporty dzienne
            </button>
            <button
              type="button"
              onClick={() => setArchiveSection("CHANGES")}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-2xl text-sm font-black cursor-pointer ${
                archiveSection === "CHANGES"
                  ? "bg-emerald-600 text-white"
                  : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-2 border-slate-200 dark:border-slate-800"
              }`}
            >
              Zmiany w projekcie
            </button>
          </div>
        )}

        {activeTab === "ARCHIVE" && !isAcceptorOnly(currentUser) && archiveSection === "CHANGES" && (
          <ProjectChangesTab
            currentUser={currentUser}
            sites={sites}
            users={users}
            reports={reports}
            archiveOnly
          />
        )}

        {activeTab === "ARCHIVE" && !isAcceptorOnly(currentUser) && archiveSection === "REPORTS" && (
          <ReportArchive
            reports={reports}
            settings={settings}
            onNewStartReport={() => handleTabChange("START_SHIFT")}
            onNewEndReport={() => handleTabChange("END_SHIFT")}
            onRefresh={syncWithDatabase}
            isSyncing={isSyncing}
            isSupabaseConnected={isSupabaseConnected}
            canDelete={currentUser.isAdmin}
            onDeleteReport={handleDeleteReport}
          />
        )}

        {activeTab === "SETTINGS" && currentUser.isAdmin && (
          <AdminSettings
            users={users}
            sites={sites}
            topicTemplates={topics}
            settings={settings}
            onUpdateUsers={handleUpdateUsers}
            onUpdateSites={handleUpdateSites}
            onUpdateTopics={handleUpdateTopics}
            onUpdateSettings={handleUpdateSettings}
          />
        )}
      </main>

      {/* STOPKA INFORMACYJNA */}
      <footer className="hidden sm:block border-t border-slate-200 dark:border-slate-800/80 py-6 text-center text-xs text-slate-500 bg-white/60 dark:bg-slate-900/60 mt-auto">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          {/*
            Uwaga klienta #016: nazwa firmy ma być logotypem z odnośnikiem do
            strony, a człon po kropce bez słowa „workflow". Ten drugi bierze się
            z Ustawień (logoSubtitle), więc poprawia się go bez wdrożenia.
          */}
          <div>
            <a
              href="https://www.solutionsbay.pl"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-slate-700 dark:text-slate-300 hover:text-sky-600 dark:hover:text-sky-400 hover:underline transition-colors"
            >
              {settings?.organizationName || "SolutionsBay"}
            </a>{" "}
            • {settings?.logoSubtitle || "RYCOS Shift"}
          </div>
          <div>
            <Link
              href="/polityka-prywatnosci"
              className="font-semibold hover:text-sky-600 dark:hover:text-sky-400 hover:underline transition-colors"
            >
              Polityka prywatności
            </Link>
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            Wersja {APP_VERSION}
          </div>
        </div>
      </footer>
    </div>
  );
}
