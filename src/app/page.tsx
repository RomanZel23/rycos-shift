"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header, ActiveTab } from "@/components/Header";
import { StartShiftForm } from "@/components/StartShiftForm";
import { EndShiftForm } from "@/components/EndShiftForm";
import { ReportArchive } from "@/components/ReportArchive";
import { AdminSettings } from "@/components/AdminSettings";
import { LoginForm } from "@/components/LoginForm";
import { PwaInstallPrompt } from "@/components/PwaInstallPrompt";
import {
  User,
  ConstructionSite,
  DiscussedTopicTemplate,
  TenantSettings,
  DailyReport,
  PdfTemplate,
} from "@/types";
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
  getStoredPdfTemplates,
  saveStoredPdfTemplates,
  getStoredLoggedUser,
  setStoredLoggedUser,
} from "@/lib/storage";

export default function Home() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("START_SHIFT");

  // Wszystkie stany pobierane w 100% z bazy danych Supabase (brak wpisów na sztywno)
  const [users, setUsers] = useState<User[]>([]);
  const [sites, setSites] = useState<ConstructionSite[]>([]);
  const [topics, setTopics] = useState<DiscussedTopicTemplate[]>([]);
  const [settings, setSettings] = useState<TenantSettings>(INITIAL_SETTINGS);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [pdfTemplates, setPdfTemplates] = useState<PdfTemplate[]>([]);
  
  // Stan autentykacji / zalogowanego użytkownika
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Stan synchronizacji z bazą Supabase
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(true);

  // Funkcja pobierania najświeższych danych bezpośrednio z bazy danych Supabase
  const syncWithDatabase = useCallback(async () => {
    try {
      setIsSyncing(true);
      const res = await fetch("/api/db/sync");
      const resJson = await res.json();
      if (resJson.success && resJson.isConnected && resJson.data) {
        setIsSupabaseConnected(true);
        const {
          users: dbUsers,
          sites: dbSites,
          topics: dbTopics,
          settings: dbSettings,
          reports: dbReports,
          pdfTemplates: dbTemplates,
        } = resJson.data;

        if (Array.isArray(dbUsers)) {
          setUsers(dbUsers);
          saveStoredUsers(dbUsers);
          const loggedUser = getStoredLoggedUser();
          if (loggedUser) {
            const updatedCurrent = dbUsers.find((u: User) => u.id === loggedUser.id);
            if (updatedCurrent) {
              setCurrentUser(updatedCurrent);
              setStoredLoggedUser(updatedCurrent);
            }
          }
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
          setReports(dbReports);
          try {
            localStorage.setItem("rycos_shift_reports_v1", JSON.stringify(dbReports));
          } catch {}
        }
        if (Array.isArray(dbTemplates)) {
          setPdfTemplates(dbTemplates);
          saveStoredPdfTemplates(dbTemplates);
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
  }, []);

  // Obsługa nawigacji 'Wstecz' na Androidzie (PWA / Browser History)
  const handleTabChange = useCallback((newTab: ActiveTab, pushHistory = true) => {
    setActiveTab(newTab);
    if (pushHistory && typeof window !== "undefined") {
      window.history.pushState({ tab: newTab }, "");
    }
    // Gdy użytkownik wchodzi do Archiwum, natychmiast odśwież z bazy Supabase
    if (newTab === "ARCHIVE") {
      syncWithDatabase();
    }
  }, [syncWithDatabase]);

  // Inicjalizacja z localStorage i synchronizacja w tle przy starcie
  useEffect(() => {
    try {
      const loadedUsers = getStoredUsers();
      const loadedSites = getStoredSites();
      const loadedTopics = getStoredTopics();
      const loadedSettings = getStoredSettings();
      const loadedReports = getStoredReports();
      const loadedTemplates = getStoredPdfTemplates();
      const loggedUser = getStoredLoggedUser();

      if (loadedUsers && loadedUsers.length > 0) setUsers(loadedUsers);
      if (loadedSites && loadedSites.length > 0) setSites(loadedSites);
      if (loadedTopics && loadedTopics.length > 0) setTopics(loadedTopics);
      if (loadedSettings) setSettings(loadedSettings);
      if (loadedReports) setReports(loadedReports);
      if (loadedTemplates && loadedTemplates.length > 0) setPdfTemplates(loadedTemplates);
      if (loggedUser) setCurrentUser(loggedUser);
    } catch (storageErr) {
      console.warn("Storage hydration notice:", storageErr);
    }

    // 1. Natychmiastowa synchronizacja z bazą Supabase przy starcie aplikacji
    syncWithDatabase();

    // 2. Inicjalizacja bazowego stanu historii dla PWA
    if (typeof window !== "undefined") {
      window.history.replaceState({ tab: "START_SHIFT" }, "");

      const handlePopState = (e: PopStateEvent) => {
        if (e.state && e.state.tab) {
          setActiveTab(e.state.tab);
          if (e.state.tab === "ARCHIVE") {
            syncWithDatabase();
          }
        }
      };

      window.addEventListener("popstate", handlePopState);
      return () => window.removeEventListener("popstate", handlePopState);
    }
  }, [syncWithDatabase]);

  // Handlery logowania i wylogowania
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setStoredLoggedUser(user);
    handleTabChange("START_SHIFT", false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setStoredLoggedUser(null);
    handleTabChange("START_SHIFT", false);
  };

  const handleUserChange = (user: User) => {
    setCurrentUser(user);
    setStoredLoggedUser(user);
    if (!user.isAdmin && activeTab === "SETTINGS") {
      handleTabChange("START_SHIFT");
    }
  };

  const handleUpdateUsers = (updated: User[]) => {
    setUsers(updated);
    saveStoredUsers(updated);
    fetch("/api/db/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SYNC_USERS", users: updated }),
    }).catch(() => {});
  };

  const handleUpdateSites = (updated: ConstructionSite[]) => {
    setSites(updated);
    saveStoredSites(updated);
    fetch("/api/db/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SYNC_SITES", sites: updated }),
    }).catch(() => {});
  };

  const handleUpdateTopics = (updated: DiscussedTopicTemplate[]) => {
    setTopics(updated);
    saveStoredTopics(updated);
    fetch("/api/db/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SYNC_TOPICS", topics: updated }),
    }).catch(() => {});
  };

  const handleUpdateSettings = (updated: TenantSettings) => {
    setSettings(updated);
    saveStoredSettings(updated);
    fetch("/api/db/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SYNC_SETTINGS", settings: updated }),
    }).catch(() => {});
  };

  const handleUpdatePdfTemplates = (updated: PdfTemplate[]) => {
    setPdfTemplates(updated);
    saveStoredPdfTemplates(updated);
    fetch("/api/db/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SYNC_PDF_TEMPLATES", pdfTemplates: updated }),
    }).catch(() => {});
  };

  const handleReportCreated = (newReport: DailyReport) => {
    setReports((prev) => [newReport, ...prev]);
    fetch("/api/db/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "SAVE_REPORT", report: newReport }),
    }).catch(() => {});
  };

  // JEŚLI UŻYTKOWNIK NIE JEST ZALOGOWANY -> POKAŻ OD RAZU EKRAN LOGOWANIA
  if (!currentUser) {
    return (
      <>
        <PwaInstallPrompt />
        <LoginForm
          users={users}
          settings={settings}
          onLogin={handleLogin}
          onRefresh={syncWithDatabase}
          isSyncing={isSyncing}
        />
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
        allUsers={users}
        onUserChange={handleUserChange}
        onLogout={handleLogout}
        settings={settings}
        reportsCount={reports.length}
      />

      {/* GŁÓWNA ZAWARTOŚĆ STRONY */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-3.5 sm:px-6 pt-4 sm:pt-8 pb-20 md:pb-8">
        {activeTab === "START_SHIFT" && (
          <StartShiftForm
            sites={sites}
            users={users}
            topicTemplates={topics}
            settings={settings}
            onReportCreated={handleReportCreated}
            onNavigateToArchive={() => handleTabChange("ARCHIVE")}
          />
        )}

        {activeTab === "END_SHIFT" && (
          <EndShiftForm
            sites={sites}
            users={users}
            settings={settings}
            onReportCreated={handleReportCreated}
            onNavigateToArchive={() => handleTabChange("ARCHIVE")}
          />
        )}

        {activeTab === "ARCHIVE" && (
          <ReportArchive
            reports={reports}
            settings={settings}
            onNewStartReport={() => handleTabChange("START_SHIFT")}
            onNewEndReport={() => handleTabChange("END_SHIFT")}
            onRefresh={syncWithDatabase}
            isSyncing={isSyncing}
            isSupabaseConnected={isSupabaseConnected}
          />
        )}

        {activeTab === "SETTINGS" && currentUser.isAdmin && (
          <AdminSettings
            users={users}
            sites={sites}
            topicTemplates={topics}
            settings={settings}
            pdfTemplates={pdfTemplates}
            onUpdateUsers={handleUpdateUsers}
            onUpdateSites={handleUpdateSites}
            onUpdateTopics={handleUpdateTopics}
            onUpdateSettings={handleUpdateSettings}
            onUpdatePdfTemplates={handleUpdatePdfTemplates}
          />
        )}
      </main>

      {/* STOPKA INFORMACYJNA */}
      <footer className="hidden sm:block border-t border-slate-200 dark:border-slate-800/80 py-6 text-center text-xs text-slate-500 bg-white/60 dark:bg-slate-900/60 mt-auto">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <strong>{settings?.organizationName || "iDream Business Center"}</strong> • {settings?.logoSubtitle || "SolutionsBay Sp. z o.o."}
          </div>
          <div>
            System RYCOS Shift — Raportowanie odpraw i fotorelacji z budowy
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            Wersja 1.3 (Supabase Cloud Sync)
          </div>
        </div>
      </footer>
    </div>
  );
}
