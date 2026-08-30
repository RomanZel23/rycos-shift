"use client";

import React, { useState, useEffect } from "react";
import { Header, ActiveTab } from "@/components/Header";
import { StartShiftForm } from "@/components/StartShiftForm";
import { EndShiftForm } from "@/components/EndShiftForm";
import { ReportArchive } from "@/components/ReportArchive";
import { AdminSettings } from "@/components/AdminSettings";
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
  getStoredUsers,
  saveStoredUsers,
  getStoredSites,
  saveStoredSites,
  getStoredTopics,
  saveStoredTopics,
  getStoredSettings,
  saveStoredSettings,
  getStoredReports,
  getStoredCurrentUserId,
  setStoredCurrentUserId,
  getStoredPdfTemplates,
  saveStoredPdfTemplates,
  INITIAL_PDF_TEMPLATES,
} from "@/lib/storage";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("START_SHIFT");

  // Główne stany aplikacji
  const [users, setUsers] = useState<User[]>([]);
  const [sites, setSites] = useState<ConstructionSite[]>([]);
  const [topics, setTopics] = useState<DiscussedTopicTemplate[]>([]);
  const [settings, setSettings] = useState<TenantSettings>({
    tenantId: "tenant-sb-tech-poznan",
    organizationName: "SolutionsBay / SB Technology",
    logoText: "SB Technology",
    logoSubtitle: "RYCOS Shift workflow",
    startShiftEmailRecipients: ["raporty-start@solutionsbay.pl"],
    endShiftEmailRecipients: ["raporty-koniec@solutionsbay.pl"],
  });
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [pdfTemplates, setPdfTemplates] = useState<PdfTemplate[]>(INITIAL_PDF_TEMPLATES);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  // Inicjalizacja z localStorage
  useEffect(() => {
    const loadedUsers = getStoredUsers();
    const loadedSites = getStoredSites();
    const loadedTopics = getStoredTopics();
    const loadedSettings = getStoredSettings();
    const loadedReports = getStoredReports();
    const loadedTemplates = getStoredPdfTemplates();
    const loadedCurrentUserId = getStoredCurrentUserId();

    setUsers(loadedUsers);
    setSites(loadedSites);
    setTopics(loadedTopics);
    setSettings(loadedSettings);
    setReports(loadedReports);
    setPdfTemplates(loadedTemplates);
    setCurrentUserId(loadedCurrentUserId);

    setMounted(true);

    // Automatyczna synchronizacja z Supabase (w tle)
    const syncWithDatabase = async () => {
      try {
        const res = await fetch("/api/db/sync");
        const resJson = await res.json();
        if (resJson.success && resJson.isConnected && resJson.data) {
          const {
            users: dbUsers,
            sites: dbSites,
            topics: dbTopics,
            settings: dbSettings,
            reports: dbReports,
            pdfTemplates: dbTemplates,
          } = resJson.data;
          if (dbUsers && dbUsers.length > 0) {
            setUsers(dbUsers);
            saveStoredUsers(dbUsers);
          }
          if (dbSites && dbSites.length > 0) {
            setSites(dbSites);
            saveStoredSites(dbSites);
          }
          if (dbTopics && dbTopics.length > 0) {
            setTopics(dbTopics);
            saveStoredTopics(dbTopics);
          }
          if (dbSettings) {
            setSettings(dbSettings);
            saveStoredSettings(dbSettings);
          }
          if (dbReports && dbReports.length > 0) {
            setReports(dbReports);
            localStorage.setItem("rycos_shift_reports_v1", JSON.stringify(dbReports));
          }
          if (dbTemplates && dbTemplates.length > 0) {
            setPdfTemplates(dbTemplates);
            saveStoredPdfTemplates(dbTemplates);
          }
        }
      } catch (err) {
        console.warn("Supabase background sync skipped (offline or unconfigured):", err);
      }
    };

    syncWithDatabase();
  }, []);

  const currentUser =
    users.find((u) => u.id === currentUserId) ||
    users[0] || {
      id: "usr-admin-1",
      firstName: "Marcin",
      lastName: "Bajda",
      role: "Kierownik Operacyjny",
      isForeman: true,
      isAdmin: true,
      login: "m.bajda",
      createdAt: new Date().toISOString(),
    };

  // Handlery aktualizacji
  const handleUserChange = (user: User) => {
    setCurrentUserId(user.id);
    setStoredCurrentUserId(user.id);
    // Jeśli przełączono na nie-admina, a byliśmy w Ustawieniach, przejdź do Rozpoczęcia
    if (!user.isAdmin && activeTab === "SETTINGS") {
      setActiveTab("START_SHIFT");
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

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
        <div className="mt-4 font-black text-lg tracking-wider text-sky-400">SB TECHNOLOGY</div>
        <div className="text-xs text-slate-400 mt-1">Ładowanie systemu RYCOS Shift...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans antialiased selection:bg-sky-500 selection:text-white">
      {/* BANER AUTOMATYCZNEJ INSTALACJI PWA */}
      <PwaInstallPrompt />

      {/* NAGŁÓWEK SYSTEMU */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        currentUser={currentUser}
        allUsers={users}
        onUserChange={handleUserChange}
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
            onNavigateToArchive={() => setActiveTab("ARCHIVE")}
          />
        )}

        {activeTab === "END_SHIFT" && (
          <EndShiftForm
            sites={sites}
            users={users}
            settings={settings}
            onReportCreated={handleReportCreated}
            onNavigateToArchive={() => setActiveTab("ARCHIVE")}
          />
        )}

        {activeTab === "ARCHIVE" && (
          <ReportArchive
            reports={reports}
            onNewStartReport={() => setActiveTab("START_SHIFT")}
            onNewEndReport={() => setActiveTab("END_SHIFT")}
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
            <strong>RYCOS Shift</strong> • SB Technology Poznań
          </div>
          <div>
            System raportowania terenowego dla zespołów wykonawczych
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            Wersja 1.0 (Mobile Ready)
          </div>
        </div>
      </footer>
    </div>
  );
}
