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
} from "lucide-react";
import {
  User,
  ConstructionSite,
  DiscussedTopicTemplate,
  TenantSettings,
} from "@/types";

interface AdminSettingsProps {
  users: User[];
  sites: ConstructionSite[];
  topicTemplates: DiscussedTopicTemplate[];
  settings: TenantSettings;
  onUpdateUsers: (users: User[]) => void;
  onUpdateSites: (sites: ConstructionSite[]) => void;
  onUpdateTopics: (topics: DiscussedTopicTemplate[]) => void;
  onUpdateSettings: (settings: TenantSettings) => void;
}

export function AdminSettings({
  users,
  sites,
  topicTemplates,
  settings,
  onUpdateUsers,
  onUpdateSites,
  onUpdateTopics,
  onUpdateSettings,
}: AdminSettingsProps) {
  const [activeSubTab, setActiveSubTab] = useState<
    "users" | "sites" | "topics" | "emails" | "tenant"
  >("users");

  // Stan nowego użytkownika
  const [newUser, setNewUser] = useState({
    firstName: "",
    lastName: "",
    role: "Montażysta",
    isForeman: false,
    isAdmin: false,
    login: "",
    password: "",
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
    settings.resendFromEmail || "raporty@solutionsbay.pl"
  );
  const [orgName, setOrgName] = useState(settings.organizationName);
  const [logoText, setLogoText] = useState(settings.logoText);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

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
      password: newUser.password || "password123",
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
      password: "",
    });
    triggerSaveBanner("Użytkownik został pomyślnie dodany.");
  };

  const handleDeleteUser = (userId: string) => {
    if (users.length <= 1) {
      alert("Nie można usunąć ostatniego użytkownika w systemie.");
      return;
    }
    const updated = users.filter((u) => u.id !== userId);
    onUpdateUsers(updated);
    triggerSaveBanner("Użytkownik został usunięty.");
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
    triggerSaveBanner("Plac budowy został dodany.");
  };

  const handleDeleteSite = (siteId: string) => {
    if (sites.length <= 1) {
      alert("W systemie musi pozostać co najmniej jeden plac budowy.");
      return;
    }
    onUpdateSites(sites.filter((s) => s.id !== siteId));
    triggerSaveBanner("Plac budowy został usunięty.");
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
    triggerSaveBanner("Szablon tematu odprawy został dodany.");
  };

  const handleDeleteTopic = (topicId: string) => {
    onUpdateTopics(topicTemplates.filter((t) => t.id !== topicId));
    triggerSaveBanner("Szablon tematu został usunięty.");
  };

  // --- ZAPIS USTAWIEŃ MAILINGOWYCH I INSTANCJI ---
  const handleSaveSettings = () => {
    const parseEmails = (str: string) =>
      str
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    const updated: TenantSettings = {
      ...settings,
      organizationName: orgName.trim() || "SolutionsBay / SB Technology",
      logoText: logoText.trim() || "SB Technology",
      startShiftEmailRecipients: parseEmails(startEmails),
      endShiftEmailRecipients: parseEmails(endEmails),
      resendApiKey: resendApiKey.trim(),
      resendFromEmail: resendFromEmail.trim(),
    };

    onUpdateSettings(updated);
    triggerSaveBanner("Ustawienia zostały zapisane.");
  };

  const triggerSaveBanner = (msg: string) => {
    setSaveBanner(msg);
    setTimeout(() => setSaveBanner(null), 3000);
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-32 md:pb-20">
      {/* NAGŁÓWEK PANELU ADMINA */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 sm:p-6 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-2 border border-amber-500/30">
            <Shield className="w-3.5 h-3.5" />
            <span>Panel Administracyjny</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Ustawienia Systemu RYCOS Shift
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
            Zarządzanie pracownikami, placami budów, tematami BHP, listami e-mail i instancjami
          </p>
        </div>
      </div>

      {saveBanner && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-sm font-semibold flex items-center gap-2 animate-fade-in">
          <Check className="w-5 h-5 text-emerald-600" />
          <span>{saveBanner}</span>
        </div>
      )}

      {/* ZAKŁADKI PODRZĘDNE W USTAWIENIACH */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          type="button"
          onClick={() => setActiveSubTab("users")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSubTab === "users"
              ? "bg-slate-900 text-white shadow-md"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Użytkownicy i Brygadziści ({users.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("sites")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSubTab === "sites"
              ? "bg-slate-900 text-white shadow-md"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Place Budowy ({sites.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("topics")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSubTab === "topics"
              ? "bg-slate-900 text-white shadow-md"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
          }`}
        >
          <ListFilter className="w-4 h-4" />
          <span>Obszary Omawiane / BHP ({topicTemplates.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("emails")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSubTab === "emails"
              ? "bg-slate-900 text-white shadow-md"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
          }`}
        >
          <Mail className="w-4 h-4" />
          <span>Listy Mailingowe & Resend</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab("tenant")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeSubTab === "tenant"
              ? "bg-slate-900 text-white shadow-md"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Instancja & Branding</span>
        </button>
      </div>

      {/* 1. ZAKŁADKA UŻYTKOWNIKÓW */}
      {activeSubTab === "users" && (
        <div className="space-y-6">
          {/* FORMULARZ DODAWANIA NOWEGO UŻYTKOWNIKA */}
          <form
            onSubmit={handleAddUser}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4"
          >
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <Plus className="w-4 h-4 text-sky-600" />
              <span>Dodaj Nowego Pracownika / Brygadzistę</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Imię:
                </label>
                <input
                  type="text"
                  required
                  placeholder="np. Jan"
                  value={newUser.firstName}
                  onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nazwisko:
                </label>
                <input
                  type="text"
                  required
                  placeholder="np. Kowalski"
                  value={newUser.lastName}
                  onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Rola / Stanowisko:
                </label>
                <input
                  type="text"
                  placeholder="np. Zbrojarz, Cieśla, Montażysta"
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Login (opcjonalny):
                </label>
                <input
                  type="text"
                  placeholder="j.kowalski"
                  value={newUser.login}
                  onChange={(e) => setNewUser({ ...newUser, login: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Hasło (opcjonalne):
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium"
                />
              </div>

              {/* CHECKBOXY RÓL */}
              <div className="flex items-center gap-4 pt-4 sm:pt-6">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newUser.isForeman}
                    onChange={(e) => setNewUser({ ...newUser, isForeman: e.target.checked })}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                  />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Brygadzista
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newUser.isAdmin}
                    onChange={(e) => setNewUser({ ...newUser, isAdmin: e.target.checked })}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Admin
                  </span>
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
              >
                Dodaj użytkownika
              </button>
            </div>
          </form>

          {/* TABELA ISTNIEJĄCYCH UŻYTKOWNIKÓW */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-500 font-bold border-b border-slate-200 dark:border-slate-700 uppercase">
                <tr>
                  <th className="p-3.5">Pracownik</th>
                  <th className="p-3.5">Rola</th>
                  <th className="p-3.5">Brygadzista</th>
                  <th className="p-3.5">Admin</th>
                  <th className="p-3.5">Login</th>
                  <th className="p-3.5 text-right">Akcja</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                      {u.firstName} {u.lastName}
                    </td>
                    <td className="p-3.5 text-slate-600 dark:text-slate-300">{u.role}</td>
                    <td className="p-3.5">
                      {u.isForeman ? (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 rounded font-bold text-[10px]">
                          TAK
                        </span>
                      ) : (
                        <span className="text-slate-400">NIE</span>
                      )}
                    </td>
                    <td className="p-3.5">
                      {u.isAdmin ? (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 rounded font-bold text-[10px]">
                          ADMIN
                        </span>
                      ) : (
                        <span className="text-slate-400">NIE</span>
                      )}
                    </td>
                    <td className="p-3.5 font-mono text-slate-500">{u.login}</td>
                    <td className="p-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(u.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                        title="Usuń"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. ZAKŁADKA PLACÓW BUDOWY */}
      {activeSubTab === "sites" && (
        <div className="space-y-6">
          <form
            onSubmit={handleAddSite}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4"
          >
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <Plus className="w-4 h-4 text-sky-600" />
              <span>Dodaj Nowy Plac Budowy</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Nazwa Placu Budowy:
                </label>
                <input
                  type="text"
                  required
                  placeholder="np. Poznań - Marcelin"
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Adres / Lokalizacja:
                </label>
                <input
                  type="text"
                  placeholder="ul. Kolorowa, Poznań"
                  value={newSiteAddress}
                  onChange={(e) => setNewSiteAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
              >
                Dodaj plac budowy
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {sites.map((site) => (
              <div
                key={site.id}
                className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-between shadow-sm"
              >
                <div>
                  <div className="font-bold text-sm text-slate-900 dark:text-white">
                    {site.name}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{site.address || "Brak adresu"}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteSite(site.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. ZAKŁADKA SZABLONÓW TEMATÓW ODPRAWY */}
      {activeSubTab === "topics" && (
        <div className="space-y-6">
          <form
            onSubmit={handleAddTopic}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4"
          >
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <Plus className="w-4 h-4 text-sky-600" />
              <span>Dodaj Szablon Zagadnienia BHP / Omawianego Obszaru</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Treść zagadnienia:
                </label>
                <input
                  type="text"
                  required
                  placeholder="np. Kontrola zabezpieczeń krawędziowych na stropie"
                  value={newTopicTitle}
                  onChange={(e) => setNewTopicTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Kategoria:
                </label>
                <select
                  value={newTopicCategory}
                  onChange={(e) => setNewTopicCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium"
                >
                  <option value="BHP">BHP</option>
                  <option value="Organizacja">Organizacja</option>
                  <option value="Sprzęt">Sprzęt</option>
                  <option value="Logistyka">Logistyka</option>
                  <option value="Jakość">Jakość</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer"
              >
                Dodaj szablon
              </button>
            </div>
          </form>

          <div className="space-y-2">
            {topicTemplates.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3 shadow-sm"
              >
                <div className="flex items-center gap-2.5 text-xs text-slate-800 dark:text-slate-200">
                  <span className="px-2 py-0.5 bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 font-bold text-[10px] rounded-md">
                    {item.category || "BHP"}
                  </span>
                  <span className="font-medium">{item.title}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteTopic(item.id)}
                  className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. ZAKŁADKA LIST MAILINGOWYCH & RESEND */}
      {activeSubTab === "emails" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2">
            <Mail className="w-4 h-4 text-sky-600" />
            <span>Konfiguracja Dystrybucji E-mail & Resend API</span>
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Adresy odbiorców dla raportów „Rozpoczęcie prac zespołu” (oddzielone przecinkami):
              </label>
              <textarea
                rows={2}
                value={startEmails}
                onChange={(e) => setStartEmails(e.target.value)}
                placeholder="raporty-start@solutionsbay.pl, kierownik.budowy@solutionsbay.pl"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Adresy odbiorców dla raportów „Zakończenie prac zespołu” (oddzielone przecinkami):
              </label>
              <textarea
                rows={2}
                value={endEmails}
                onChange={(e) => setEndEmails(e.target.value)}
                placeholder="raporty-koniec@solutionsbay.pl, zarzad@solutionsbay.pl"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-500" />
                  <span>Klucz Resend API (re_...):</span>
                </label>
                <input
                  type="password"
                  value={resendApiKey}
                  onChange={(e) => setResendApiKey(e.target.value)}
                  placeholder="re_123456789..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-mono text-slate-900 dark:text-white"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Możesz wpisać klucz tutaj lub zdefiniować `RESEND_API_KEY` w zmiennych środowiskowych serwera.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Adres Nadawcy (From e-mail):
                </label>
                <input
                  type="text"
                  value={resendFromEmail}
                  onChange={(e) => setResendFromEmail(e.target.value)}
                  placeholder="raporty@solutionsbay.pl lub onboarding@resend.dev"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-mono text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="button"
                onClick={handleSaveSettings}
                className="flex items-center gap-2 px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer active:scale-95 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>Zapisz ustawienia mailingowe</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. ZAKŁADKA INSTANCJI & BRANDINGU */}
      {activeSubTab === "tenant" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-2">
            <Layers className="w-4 h-4 text-sky-600" />
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
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold"
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
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-semibold"
              />
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-xs text-slate-600 dark:text-slate-300 space-y-1">
            <div className="font-bold text-slate-900 dark:text-white">Identyfikator instancji:</div>
            <div className="font-mono text-sky-600 dark:text-sky-400">{settings.tenantId}</div>
            <p className="text-[11px] text-slate-400 pt-1">
              Architektura RYCOS Shift umożliwia podłączenie kolejnych instancji podwykonawców lub innych oddziałów z odrębnymi bazami placów i logotypami.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleSaveSettings}
              className="flex items-center gap-2 px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-md cursor-pointer active:scale-95 transition-all"
            >
              <Save className="w-4 h-4" />
              <span>Zapisz konfigurację instancji</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
