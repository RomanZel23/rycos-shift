"use client";

import React, { useState } from "react";
import {
  Users,
  Building2,
  ListFilter,
  Mail,
  Sliders,
  Plus,
  Trash2,
  Check,
  Shield,
  Key,
  Layers,
  Save,
  FileCode,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  User,
  ConstructionSite,
  DiscussedTopicTemplate,
  TenantSettings,
  PdfTemplate,
} from "@/types";

interface AdminSettingsProps {
  users: User[];
  sites: ConstructionSite[];
  topicTemplates: DiscussedTopicTemplate[];
  settings: TenantSettings;
  pdfTemplates?: PdfTemplate[];
  onUpdateUsers: (users: User[]) => void;
  onUpdateSites: (sites: ConstructionSite[]) => void;
  onUpdateTopics: (topics: DiscussedTopicTemplate[]) => void;
  onUpdateSettings: (settings: TenantSettings) => void;
  onUpdatePdfTemplates?: (templates: PdfTemplate[]) => void;
}

export function AdminSettings({
  users,
  sites,
  topicTemplates,
  settings,
  pdfTemplates = [],
  onUpdateUsers,
  onUpdateSites,
  onUpdateTopics,
  onUpdateSettings,
  onUpdatePdfTemplates,
}: AdminSettingsProps) {
  const [activeSubTab, setActiveSubTab] = useState<
    "users" | "sites" | "topics" | "emails" | "tenant" | "templates"
  >("users");

  // Stan nowego użytkownika
  const [newUser, setNewUser] = useState({
    firstName: "",
    lastName: "",
    role: "Montażysta",
    isForeman: false,
    isAdmin: false,
    login: "",
  });

  // Stan nowego placu budowy
  const [newSiteName, setNewSiteName] = useState("");
  const [newSiteAddress, setNewSiteAddress] = useState("");

  // Stan nowego szablonu tematu
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [newTopicCategory, setNewTopicCategory] = useState("BHP");

  // Stan edycji list mailingowych i Resend
  const [startEmails, setStartEmails] = useState(
    settings.startShiftEmailRecipients.join(", ")
  );
  const [endEmails, setEndEmails] = useState(
    settings.endShiftEmailRecipients.join(", ")
  );
  const [resendApiKey, setResendApiKey] = useState(settings.resendApiKey || "");
  const [resendFromEmail, setResendFromEmail] = useState(
    settings.resendFromEmail || "raporty@shift.rycos.eu"
  );
  const [orgName, setOrgName] = useState(settings.organizationName);
  const [logoText, setLogoText] = useState(settings.logoText);

  // Stan edytora szablonów PDF
  const [selectedTemplateType, setSelectedTemplateType] = useState<"START_SHIFT" | "END_SHIFT">("START_SHIFT");
  const currentTemplate = pdfTemplates.find((t) => t.reportType === selectedTemplateType) || pdfTemplates[0];
  const [templateCode, setTemplateCode] = useState(currentTemplate?.htmlContent || "");

  // Etap 1: nadawanie haseł i PIN-ów. Hasła nie przechodzą przez stan aplikacji
  // dłużej niż trzeba i nigdy nie trafiają do localStorage — idą prosto do
  // /api/users/credentials, gdzie serwer je hashuje.
  const [credentialsFor, setCredentialsFor] = useState<User | null>(null);
  const [credPassword, setCredPassword] = useState("");
  const [credPin, setCredPin] = useState("");
  const [credError, setCredError] = useState<string | null>(null);
  const [credSaving, setCredSaving] = useState(false);

  const closeCredentials = () => {
    setCredentialsFor(null);
    setCredPassword("");
    setCredPin("");
    setCredError(null);
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentialsFor || credSaving) return;
    if (!credPassword && !credPin) {
      setCredError("Podaj hasło, PIN albo oba.");
      return;
    }
    setCredSaving(true);
    setCredError(null);
    try {
      const res = await fetch("/api/users/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: credentialsFor.id,
          ...(credPassword ? { password: credPassword } : {}),
          ...(credPin ? { pin: credPin } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const name = `${credentialsFor.firstName} ${credentialsFor.lastName}`;
        closeCredentials();
        triggerSaveBanner(`Poświadczenia dla ${name} zapisane. Stare sesje wygasły.`);
      } else {
        setCredError(data?.message || "Nie udało się zapisać poświadczeń.");
      }
    } catch {
      setCredError("Brak połączenia z serwerem.");
    } finally {
      setCredSaving(false);
    }
  };

  const handleUnlockAccount = async (user: User) => {
    try {
      const res = await fetch("/api/users/credentials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      triggerSaveBanner(
        data?.success
          ? `Konto ${user.firstName} ${user.lastName} odblokowane.`
          : data?.message || "Nie udało się odblokować konta."
      );
    } catch {
      triggerSaveBanner("Brak połączenia z serwerem.");
    }
  };

  // Komunikat potwierdzenia zapisu
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  const triggerSaveBanner = (msg: string) => {
    setSaveBanner(msg);
    setTimeout(() => setSaveBanner(null), 3000);
  };

  // --- OBSŁUGA UŻYTKOWNIKÓW ---
  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.firstName.trim() || !newUser.lastName.trim()) return;

    const created: User = {
      id: "usr-" + Date.now(),
      firstName: newUser.firstName.trim(),
      lastName: newUser.lastName.trim(),
      role: newUser.role.trim() || "Pracownik",
      isForeman: newUser.isForeman,
      isAdmin: newUser.isAdmin,
      login:
        newUser.login.trim() ||
        `${newUser.firstName[0].toLowerCase()}.${newUser.lastName.toLowerCase()}`,
      createdAt: new Date().toISOString(),
    };

    const updated = [...users, created];
    onUpdateUsers(updated);
    setNewUser({
      firstName: "",
      lastName: "",
      role: "Montażysta",
      isForeman: false,
      isAdmin: false,
      login: "",
    });
    triggerSaveBanner(
      "Użytkownik dodany. Nadaj mu hasło lub PIN przyciskiem „Poświadczenia” — bez tego się nie zaloguje."
    );
  };

  const handleDeleteUser = async (userId: string) => {
    if (users.length <= 1) {
      alert("Nie można usunąć ostatniego użytkownika w systemie.");
      return;
    }
    const updated = users.filter((u) => u.id !== userId);
    onUpdateUsers(updated);
    try {
      await fetch("/api/db/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DELETE_USER", userId }),
      });
    } catch {}
    triggerSaveBanner("Użytkownik został usunięty z bazy Supabase.");
  };

  // --- OBSŁUGA PLACÓW BUDOWY ---
  const handleAddSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteName.trim()) return;

    const created: ConstructionSite = {
      id: "site-" + Date.now(),
      name: newSiteName.trim(),
      address: newSiteAddress.trim(),
      active: true,
    };

    onUpdateSites([...sites, created]);
    setNewSiteName("");
    setNewSiteAddress("");
    triggerSaveBanner("Plac budowy został dodany i zapisany w Supabase.");
  };

  const handleDeleteSite = async (siteId: string) => {
    if (sites.length <= 1) {
      alert("W systemie musi pozostać co najmniej jeden plac budowy.");
      return;
    }
    const updated = sites.filter((s) => s.id !== siteId);
    onUpdateSites(updated);
    try {
      await fetch("/api/db/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DELETE_SITE", siteId }),
      });
    } catch {}
    triggerSaveBanner("Plac budowy został usunięty z bazy Supabase.");
  };

  // --- OBSŁUGA SZABLONÓW TEMATÓW ---
  const handleAddTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicTitle.trim()) return;

    const created: DiscussedTopicTemplate = {
      id: "top-" + Date.now(),
      title: newTopicTitle.trim(),
      category: newTopicCategory.trim() || "BHP",
    };

    onUpdateTopics([...topicTemplates, created]);
    setNewTopicTitle("");
    triggerSaveBanner("Szablon tematu odprawy został dodany i zapisany w Supabase.");
  };

  const handleDeleteTopic = async (topicId: string) => {
    const updated = topicTemplates.filter((t) => t.id !== topicId);
    onUpdateTopics(updated);
    try {
      await fetch("/api/db/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "DELETE_TOPIC", topicId }),
      });
    } catch {}
    triggerSaveBanner("Szablon tematu został usunięty z bazy Supabase.");
  };

  // --- ZAPIS USTAWIEŃ MAILINGOWYCH & INSTANCJI ---
  const handleSaveSettings = () => {
    const startList = startEmails
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
    const endList = endEmails
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    const updatedSettings: TenantSettings = {
      ...settings,
      organizationName: orgName.trim() || settings.organizationName,
      logoText: logoText.trim() || settings.logoText,
      startShiftEmailRecipients: startList,
      endShiftEmailRecipients: endList,
      resendApiKey: resendApiKey.trim(),
      resendFromEmail: resendFromEmail.trim() || "raporty@shift.rycos.eu",
    };

    onUpdateSettings(updatedSettings);
    triggerSaveBanner("Konfiguracja instancji i e-mail została zsynchronizowana z Supabase.");
  };

  // --- ZAPIS SZABLONU PDF ---
  const handleSaveTemplate = () => {
    if (!onUpdatePdfTemplates) return;
    const updated = pdfTemplates.map((t) => {
      if (t.reportType === selectedTemplateType) {
        return {
          ...t,
          htmlContent: templateCode,
          updatedAt: new Date().toISOString(),
        };
      }
      return t;
    });

    onUpdatePdfTemplates(updated);
    triggerSaveBanner("Szablon raportu PDF (HTML) został zapisany w bazie danych Supabase!");
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-32 md:pb-20">
      {/* NAGŁÓWEK PANELU ADMINA */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-5 border border-slate-800">
        <div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/25 text-amber-300 text-xs sm:text-sm font-black uppercase tracking-wider mb-2.5 border border-amber-500/40">
            <Shield className="w-4 h-4" />
            <span>Panel Administracyjny & Baza Danych</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Ustawienia Systemu RYCOS Shift
          </h1>
          <p className="text-sm sm:text-base text-slate-300 mt-1 font-medium">
            Zarządzanie pracownikami, placami budów, tematami BHP, listami e-mail, instancjami i szablonami HTML
          </p>
        </div>
      </div>

      {saveBanner && (
        <div className="p-4 sm:p-5 bg-emerald-50 dark:bg-emerald-950/70 border-2 border-emerald-300 dark:border-emerald-800 rounded-2xl text-emerald-900 dark:text-emerald-100 text-sm sm:text-base font-bold flex items-center gap-3 animate-fade-in shadow-md">
          <Check className="w-6 h-6 text-emerald-600 flex-shrink-0" />
          <span>{saveBanner}</span>
        </div>
      )}

      {/* ZAKŁADKI PODRZĘDNE W USTAWIENIACH */}
      <div className="flex flex-wrap gap-2.5 border-b border-slate-200 dark:border-slate-800 pb-3">
        <button
          type="button"
          onClick={() => setActiveSubTab("users")}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSubTab === "users"
              ? "bg-slate-900 text-white shadow-md shadow-slate-900/30"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-800"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Użytkownicy i Brygadziści ({users.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("sites")}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSubTab === "sites"
              ? "bg-slate-900 text-white shadow-md shadow-slate-900/30"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-800"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Place Budowy ({sites.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("topics")}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSubTab === "topics"
              ? "bg-slate-900 text-white shadow-md shadow-slate-900/30"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-800"
          }`}
        >
          <ListFilter className="w-4 h-4" />
          <span>Obszary Omawiane / BHP ({topicTemplates.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("emails")}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSubTab === "emails"
              ? "bg-slate-900 text-white shadow-md shadow-slate-900/30"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-800"
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Listy Mailingowe & Resend</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("templates")}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSubTab === "templates"
              ? "bg-sky-600 text-white shadow-md shadow-sky-600/30 font-black"
              : "bg-white dark:bg-slate-900 text-sky-700 dark:text-sky-300 hover:bg-sky-50 border border-sky-200 dark:border-sky-800"
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>Szablony PDF (HTML Baza)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("tenant")}
          className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSubTab === "tenant"
              ? "bg-slate-900 text-white shadow-md shadow-slate-900/30"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 border border-slate-200 dark:border-slate-800"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Instancja & Branding</span>
        </button>
      </div>

      {/* 1. ZAKŁADKA UŻYTKOWNIKÓW */}
      {activeSubTab === "users" && (
        <div className="space-y-6">
          <form
            onSubmit={handleAddUser}
            className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-sm space-y-4"
          >
            <h3 className="text-base sm:text-lg font-black uppercase text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-sky-600" />
              <span>Dodaj nowego pracownika lub brygadzistę</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Imię: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="np. Piotr"
                  value={newUser.firstName}
                  onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                  className="w-full h-12 px-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nazwisko: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="np. Nowak"
                  value={newUser.lastName}
                  onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                  className="w-full h-12 px-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Stanowisko / Rola:
                </label>
                <input
                  type="text"
                  placeholder="np. Cieśla, Zbrojarz, Montażysta"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full h-12 px-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={newUser.isForeman}
                    onChange={(e) => setNewUser({ ...newUser, isForeman: e.target.checked })}
                    className="w-5 h-5 rounded-lg border-slate-400 text-sky-600 focus:ring-sky-500"
                  />
                  <span>Uprawnienia Brygadzisty</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-800 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={newUser.isAdmin}
                    onChange={(e) => setNewUser({ ...newUser, isAdmin: e.target.checked })}
                    className="w-5 h-5 rounded-lg border-slate-400 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Administrator Systemu</span>
                </label>
              </div>

              <button
                type="submit"
                className="px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white font-black text-sm rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Dodaj pracownika
              </button>
            </div>
          </form>

          {/* LISTA UŻYTKOWNIKÓW */}
          <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="divide-y-2 divide-slate-100 dark:divide-slate-800">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm ${
                        u.isAdmin
                          ? "bg-amber-500 text-slate-950"
                          : u.isForeman
                          ? "bg-sky-500 text-white"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {u.firstName[0]}
                      {u.lastName[0]}
                    </div>
                    <div>
                      <div className="font-black text-slate-900 dark:text-white text-base flex items-center gap-2">
                        <span>
                          {u.firstName} {u.lastName}
                        </span>
                        {u.isAdmin && (
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-800 dark:text-amber-300 text-xs font-black rounded-lg">
                            ADMIN
                          </span>
                        )}
                        {u.isForeman && (
                          <span className="px-2 py-0.5 bg-sky-500/20 text-sky-800 dark:text-sky-300 text-xs font-black rounded-lg">
                            BRYGADZISTA
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-semibold">{u.role}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setCredentialsFor(u);
                        setCredPassword("");
                        setCredPin("");
                        setCredError(null);
                      }}
                      title="Nadaj hasło lub PIN"
                      className="px-3 py-2 text-xs font-black text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-950/60 hover:bg-sky-200 dark:hover:bg-sky-900 rounded-xl transition-colors cursor-pointer"
                    >
                      Poświadczenia
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUnlockAccount(u)}
                      title="Odblokuj konto po nieudanych próbach logowania"
                      className="px-3 py-2 text-xs font-black text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                    >
                      Odblokuj
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(u.id)}
                      className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. ZAKŁADKA PLACÓW BUDOWY */}
      {activeSubTab === "sites" && (
        <div className="space-y-6">
          <form
            onSubmit={handleAddSite}
            className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-sm space-y-4"
          >
            <h3 className="text-base sm:text-lg font-black uppercase text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-sky-600" />
              <span>Dodaj nowy plac budowy</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Nazwa Placu: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="np. Poznań - Marcelin Etap II"
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  className="w-full h-12 px-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Adres / Lokalizacja:
                </label>
                <input
                  type="text"
                  placeholder="ul. Marcelińska, Poznań"
                  value={newSiteAddress}
                  onChange={(e) => setNewSiteAddress(e.target.value)}
                  className="w-full h-12 px-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-sm font-semibold"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white font-black text-sm rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Dodaj plac budowy
              </button>
            </div>
          </form>

          <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="divide-y-2 divide-slate-100 dark:divide-slate-800">
              {sites.map((s) => (
                <div
                  key={s.id}
                  className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="p-3 bg-sky-50 dark:bg-sky-950 text-sky-600 rounded-2xl">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-black text-slate-900 dark:text-white text-base">
                        {s.name}
                      </div>
                      <div className="text-xs text-slate-500 font-semibold">{s.address || "Brak adresu"}</div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteSite(s.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. ZAKŁADKA TEMATÓW BHP */}
      {activeSubTab === "topics" && (
        <div className="space-y-6">
          <form
            onSubmit={handleAddTopic}
            className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-7 shadow-sm space-y-4"
          >
            <h3 className="text-base sm:text-lg font-black uppercase text-slate-900 dark:text-white flex items-center gap-2">
              <Plus className="w-5 h-5 text-sky-600" />
              <span>Dodaj szablon tematu odprawy BHP</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Treść punktu odprawy: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="np. Weryfikacja szelek asekuracyjnych przy pracach na wysokości"
                  value={newTopicTitle}
                  onChange={(e) => setNewTopicTitle(e.target.value)}
                  className="w-full h-12 px-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Kategoria:
                </label>
                <select
                  value={newTopicCategory}
                  onChange={(e) => setNewTopicCategory(e.target.value)}
                  className="w-full h-12 px-3.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-sm font-bold"
                >
                  <option value="BHP">BHP</option>
                  <option value="Organizacja">Organizacja</option>
                  <option value="Sprzęt">Sprzęt</option>
                  <option value="Logistyka">Logistyka</option>
                  <option value="Jakość">Jakość</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-6 py-3 bg-sky-600 hover:bg-sky-500 text-white font-black text-sm rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Dodaj szablon BHP
              </button>
            </div>
          </form>

          <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
            <div className="divide-y-2 divide-slate-100 dark:divide-slate-800">
              {topicTemplates.map((t) => (
                <div
                  key={t.id}
                  className="p-4 sm:p-5 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  <div className="flex items-center gap-3.5">
                    <span className="px-2.5 py-1 bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 text-xs font-black rounded-lg">
                      {t.category || "BHP"}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">
                      {t.title}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteTopic(t.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 4. ZAKŁADKA LIST MAILINGOWYCH & RESEND */}
      {activeSubTab === "emails" && (
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <h3 className="text-base sm:text-lg font-black uppercase text-slate-900 dark:text-white flex items-center gap-2">
            <Mail className="w-5 h-5 text-sky-600" />
            <span>Konfiguracja Wysyłki E-mail (Resend API)</span>
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-extrabold text-slate-800 dark:text-slate-200 mb-1.5">
                Odbiorcy raportów Rozpoczęcia Prac (oddziel przecinkami):
              </label>
              <input
                type="text"
                value={startEmails}
                onChange={(e) => setStartEmails(e.target.value)}
                placeholder="raporty-start@solutionsbay.pl, kierownik.budowy@solutionsbay.pl"
                className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-sm font-semibold"
              />
            </div>

            <div>
              <label className="block text-sm font-extrabold text-slate-800 dark:text-slate-200 mb-1.5">
                Odbiorcy raportów Zakończenia Prac (oddziel przecinkami):
              </label>
              <input
                type="text"
                value={endEmails}
                onChange={(e) => setEndEmails(e.target.value)}
                placeholder="raporty-koniec@solutionsbay.pl, zarzad@solutionsbay.pl"
                className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-sm font-semibold"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-sm font-extrabold text-slate-800 dark:text-slate-200 mb-1.5">
                  Adres e-mail Nadawcy:
                </label>
                <input
                  type="email"
                  value={resendFromEmail}
                  onChange={(e) => setResendFromEmail(e.target.value)}
                  placeholder="raporty@shift.rycos.eu"
                  className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-sm font-semibold"
                />
              </div>

              <div>
                <label className="block text-sm font-extrabold text-slate-800 dark:text-slate-200 mb-1.5">
                  Klucz API Resend:
                </label>
                <input
                  type="password"
                  value={resendApiKey}
                  onChange={(e) => setResendApiKey(e.target.value)}
                  placeholder="re_xxxxxxxxxxxx"
                  className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-sm font-semibold font-mono"
                />
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                type="button"
                onClick={handleSaveSettings}
                className="flex items-center gap-2 px-8 py-3.5 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl font-black text-sm shadow-md cursor-pointer active:scale-95 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>Zapisz ustawienia mailingowe w Supabase</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. ZAKŁADKA SZABLONÓW PDF (HTML BAZA) */}
      {activeSubTab === "templates" && (
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-base sm:text-lg font-black uppercase text-slate-900 dark:text-white flex items-center gap-2">
                <FileCode className="w-5 h-5 text-sky-600" />
                <span>Szablony PDF (HTML w bazie danych Supabase)</span>
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Szablony HTML generowane są w 100% z kodowaniem UTF-8, obsługując dowolne logo, kolory i układ tabeli.
              </p>
            </div>

            {/* PRZEŁĄCZNIK TYPU SZABLONU */}
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-2xl">
              <button
                type="button"
                onClick={() => {
                  setSelectedTemplateType("START_SHIFT");
                  const tpl = pdfTemplates.find((t) => t.reportType === "START_SHIFT");
                  if (tpl) setTemplateCode(tpl.htmlContent);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  selectedTemplateType === "START_SHIFT"
                    ? "bg-sky-600 text-white shadow-md"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                Rozpoczęcie prac
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedTemplateType("END_SHIFT");
                  const tpl = pdfTemplates.find((t) => t.reportType === "END_SHIFT");
                  if (tpl) setTemplateCode(tpl.htmlContent);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  selectedTemplateType === "END_SHIFT"
                    ? "bg-indigo-600 text-white shadow-md"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                Zakończenie prac
              </button>
            </div>
          </div>

          {/* INFORMACJA O ZAPISIE W BAZIE */}
          <div className="p-4 bg-sky-50 dark:bg-sky-950/60 border-2 border-sky-200 dark:border-sky-800 rounded-2xl text-xs sm:text-sm text-sky-900 dark:text-sky-200 font-semibold space-y-1">
            <div className="flex items-center gap-2 font-black text-sky-800 dark:text-sky-300">
              <Sparkles className="w-4 h-4 text-sky-500" />
              <span>Tabela: public.pdf_templates (Supabase PostgreSQL)</span>
            </div>
            <div>
              Edytujesz aktywny szablon: <strong>{currentTemplate?.name || selectedTemplateType}</strong>.
            </div>
          </div>

          <div>
            <label className="block text-sm font-extrabold text-slate-800 dark:text-slate-200 mb-2">
              Kod źródłowy szablonu HTML / CSS:
            </label>
            <textarea
              rows={12}
              value={templateCode}
              onChange={(e) => setTemplateCode(e.target.value)}
              className="w-full p-4 bg-slate-950 text-sky-300 font-mono text-xs sm:text-sm rounded-2xl border-2 border-slate-800 focus:ring-4 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none leading-relaxed"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                const def = pdfTemplates.find((t) => t.reportType === selectedTemplateType);
                if (def) setTemplateCode(def.htmlContent);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Przywróć domyślny kod HTML</span>
            </button>

            <button
              type="button"
              onClick={handleSaveTemplate}
              className="flex items-center gap-2 px-8 py-3.5 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl font-black text-sm shadow-md cursor-pointer active:scale-95 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Zapisz szablon HTML w bazie Supabase</span>
            </button>
          </div>
        </div>
      )}

      {/* 6. ZAKŁADKA INSTANCJI & BRANDINGU */}
      {activeSubTab === "tenant" && (
        <div className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <h3 className="text-base sm:text-lg font-black uppercase text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-sky-600" />
            <span>Wieloinstancyjność & Branding (Multi-Instance)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Nazwa Organizacji / Podmiotu:
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="SolutionsBay / SB Technology"
                className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-sm font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tekst Logotypu (Branding):
              </label>
              <input
                type="text"
                value={logoText}
                onChange={(e) => setLogoText(e.target.value)}
                placeholder="SB Technology"
                className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-sm font-semibold"
              />
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-1 border border-slate-200 dark:border-slate-700">
            <div className="font-bold text-slate-900 dark:text-white">Identyfikator instancji:</div>
            <div className="font-mono text-sky-600 dark:text-sky-400 font-bold">{settings.tenantId}</div>
            <p className="text-xs text-slate-400 pt-1">
              Architektura RYCOS Shift umożliwia podłączenie kolejnych instancji podwykonawców lub innych oddziałów z odrębnymi bazami placów i szablonami HTML.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleSaveSettings}
              className="flex items-center gap-2 px-8 py-3.5 bg-sky-600 hover:bg-sky-500 text-white rounded-2xl text-sm font-black shadow-md cursor-pointer active:scale-95 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Zapisz konfigurację instancji</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL: NADANIE HASŁA I PIN-U */}
      {credentialsFor && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm p-0 sm:p-4">
          <form
            onSubmit={handleSaveCredentials}
            className="w-full sm:max-w-md bg-white dark:bg-slate-900 border-t-2 sm:border-2 border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl p-6 space-y-5 shadow-2xl"
          >
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Poświadczenia
              </h3>
              <p className="text-sm text-slate-500 font-semibold">
                {credentialsFor.firstName} {credentialsFor.lastName}
                {credentialsFor.login ? ` · ${credentialsFor.login}` : ""}
              </p>
            </div>

            {credError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border-2 border-rose-300 dark:border-rose-800 rounded-2xl text-rose-700 dark:text-rose-200 text-xs font-bold">
                {credError}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                Hasło (tryb „Login i Hasło")
              </label>
              <input
                type="text"
                autoComplete="off"
                value={credPassword}
                onChange={(e) => setCredPassword(e.target.value)}
                placeholder="min. 10 znaków, litery i cyfry"
                className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 focus:border-sky-500 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-slate-500">
                PIN (tryb „Wybór Pracownika")
              </label>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={credPin}
                onChange={(e) => setCredPin(e.target.value)}
                placeholder="4–8 cyfr"
                className="w-full h-12 px-4 bg-slate-50 dark:bg-slate-950 border-2 border-slate-200 dark:border-slate-800 focus:border-sky-500 rounded-2xl text-sm font-semibold text-slate-900 dark:text-white outline-none tracking-widest"
              />
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Wartości są widoczne, żebyś mógł je przepisać pracownikowi — zapisz je teraz,
              bo serwer przechowuje wyłącznie hash i nie da się ich później odczytać.
              Zapis unieważnia wszystkie aktywne sesje tej osoby.
            </p>

            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={closeCredentials}
                className="flex-1 h-12 rounded-2xl border-2 border-slate-200 dark:border-slate-700 text-sm font-black text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Anuluj
              </button>
              <button
                type="submit"
                disabled={credSaving}
                className="flex-1 h-12 rounded-2xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-black cursor-pointer"
              >
                {credSaving ? "Zapisywanie..." : "Zapisz"}
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
