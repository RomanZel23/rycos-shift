"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  Camera,
  Archive,
  Settings as SettingsIcon,
  Shield,
  UserCheck,
  User as UserIcon,
  HardHat,
  ChevronDown,
} from "lucide-react";
import { User, TenantSettings } from "@/types";

export type ActiveTab = "START_SHIFT" | "END_SHIFT" | "ARCHIVE" | "SETTINGS";

interface HeaderProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  currentUser: User;
  allUsers: User[];
  onUserChange: (user: User) => void;
  settings: TenantSettings;
  reportsCount: number;
}

export function Header({
  activeTab,
  onTabChange,
  currentUser,
  allUsers,
  onUserChange,
  settings,
  reportsCount,
}: HeaderProps) {
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-xl">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-18 sm:h-22">
          {/* LOGOTYP & BRANDING */}
          <div className="flex items-center gap-3">
            {/* Sygnet / Ikona SB Technology */}
            <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-500 flex items-center justify-center font-black text-white text-xl sm:text-2xl shadow-lg shadow-sky-500/25 border-2 border-white/20 flex-shrink-0">
              SB
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg sm:text-2xl tracking-wide text-white uppercase font-sans">
                  {settings.logoText || "SB TECHNOLOGY"}
                </span>
                <span className="hidden sm:inline-block px-2.5 py-0.5 bg-sky-500/25 text-sky-300 text-xs font-black rounded-lg uppercase tracking-wider border border-sky-500/40">
                  Poznań
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 font-semibold">
                {settings.logoSubtitle || "RYCOS Shift workflow"}
              </p>
            </div>
          </div>

          {/* NAWIGACJA DESKTOP / TABLET */}
          <nav className="hidden md:flex items-center gap-2 bg-slate-800/90 p-2 rounded-2xl border border-slate-700/80">
            <button
              type="button"
              onClick={() => onTabChange("START_SHIFT")}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                activeTab === "START_SHIFT"
                  ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
                  : "text-slate-300 hover:text-white hover:bg-slate-700/60"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Rozpoczęcie prac</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange("END_SHIFT")}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                activeTab === "END_SHIFT"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-300 hover:text-white hover:bg-slate-700/60"
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Zakończenie prac</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange("ARCHIVE")}
              className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer relative ${
                activeTab === "ARCHIVE"
                  ? "bg-slate-700 text-white shadow-md"
                  : "text-slate-300 hover:text-white hover:bg-slate-700/60"
              }`}
            >
              <Archive className="w-4 h-4" />
              <span>Archiwum</span>
              {reportsCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-sky-500 text-white text-xs font-black font-mono">
                  {reportsCount}
                </span>
              )}
            </button>

            {/* ZAKŁADKA USTAWIENIA – TYLKO DLA ADMINA */}
            {currentUser.isAdmin && (
              <button
                type="button"
                onClick={() => onTabChange("SETTINGS")}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  activeTab === "SETTINGS"
                    ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                    : "text-amber-400 hover:text-amber-300 hover:bg-slate-700/60"
                }`}
              >
                <SettingsIcon className="w-4 h-4" />
                <span>Ustawienia</span>
              </button>
            )}
          </nav>

          {/* PRZEŁĄCZNIK PROFILU UŻYTKOWNIKA (DUŻY I CZYTELNY) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700/90 border border-slate-700 rounded-2xl text-left transition-all cursor-pointer active:scale-95 shadow-sm"
            >
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shadow-md ${
                  currentUser.isAdmin
                    ? "bg-amber-500 text-slate-950"
                    : currentUser.isForeman
                    ? "bg-sky-500 text-white"
                    : "bg-slate-600 text-white"
                }`}
              >
                {currentUser.isAdmin ? (
                  <Shield className="w-5 h-5" />
                ) : currentUser.isForeman ? (
                  <HardHat className="w-5 h-5" />
                ) : (
                  <UserIcon className="w-5 h-5" />
                )}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-sm font-bold text-white leading-tight">
                  {currentUser.firstName} {currentUser.lastName}
                </div>
                <div className="text-xs text-slate-400 font-semibold">
                  {currentUser.isAdmin
                    ? "Administrator"
                    : currentUser.isForeman
                    ? "Brygadzista"
                    : "Pracownik"}
                </div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {/* DROPDOWN WYBORU UŻYTKOWNIKA */}
            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-slate-900 border-2 border-slate-700 rounded-2xl shadow-2xl p-2.5 z-50 animate-fade-in">
                <div className="px-3 py-2 text-xs text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                  Przełącz profil użytkownika:
                </div>
                <div className="max-h-72 overflow-y-auto py-1 space-y-1.5">
                  {allUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        onUserChange(user);
                        setUserDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm flex items-center justify-between transition-colors cursor-pointer ${
                        user.id === currentUser.id
                          ? "bg-sky-600 text-white font-bold shadow-sm"
                          : "text-slate-200 hover:bg-slate-800"
                      }`}
                    >
                      <div>
                        <div className="font-bold text-sm">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-xs opacity-80">{user.role}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        {user.isAdmin && (
                          <span className="px-2 py-0.5 bg-amber-500/30 text-amber-300 text-[10px] font-black rounded-md">
                            ADMIN
                          </span>
                        )}
                        {user.isForeman && (
                          <span className="px-2 py-0.5 bg-sky-500/30 text-sky-300 text-[10px] font-black rounded-md">
                            BRYGADA
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="p-2.5 border-t border-slate-800 text-xs text-slate-400 text-center font-medium">
                  Zegar: <strong className="text-sky-400 font-mono text-sm">{currentTime}</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MOBILNA BELKA NAWIGACYJNA (DUŻE IKONY I CZYTELNE NAPISY) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/98 backdrop-blur-lg border-t-2 border-slate-800 px-3 py-2 flex items-center justify-around shadow-2xl">
        <button
          type="button"
          onClick={() => onTabChange("START_SHIFT")}
          className={`flex flex-col items-center gap-1 py-2 px-3 rounded-2xl transition-all cursor-pointer ${
            activeTab === "START_SHIFT"
              ? "text-white font-black bg-sky-600 shadow-md shadow-sky-600/30 scale-105"
              : "text-slate-400 font-bold hover:text-slate-200"
          }`}
        >
          <FileText className="w-6 h-6" />
          <span className="text-xs">Rozpoczęcie</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange("END_SHIFT")}
          className={`flex flex-col items-center gap-1 py-2 px-3 rounded-2xl transition-all cursor-pointer ${
            activeTab === "END_SHIFT"
              ? "text-white font-black bg-indigo-600 shadow-md shadow-indigo-600/30 scale-105"
              : "text-slate-400 font-bold hover:text-slate-200"
          }`}
        >
          <Camera className="w-6 h-6" />
          <span className="text-xs">Zakończenie</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange("ARCHIVE")}
          className={`flex flex-col items-center gap-1 py-2 px-3 rounded-2xl transition-all cursor-pointer relative ${
            activeTab === "ARCHIVE"
              ? "text-white font-black bg-slate-700 shadow-md scale-105"
              : "text-slate-400 font-bold hover:text-slate-200"
          }`}
        >
          <Archive className="w-6 h-6" />
          <span className="text-xs">Archiwum</span>
          {reportsCount > 0 && (
            <span className="absolute top-1 right-2 w-5 h-5 bg-sky-500 text-white rounded-full text-xs flex items-center justify-center font-black">
              {reportsCount}
            </span>
          )}
        </button>

        {currentUser.isAdmin && (
          <button
            type="button"
            onClick={() => onTabChange("SETTINGS")}
            className={`flex flex-col items-center gap-1 py-2 px-3 rounded-2xl transition-all cursor-pointer ${
              activeTab === "SETTINGS"
                ? "text-white font-black bg-amber-600 shadow-md shadow-amber-600/30 scale-105"
                : "text-slate-400 font-bold hover:text-slate-200"
            }`}
          >
            <SettingsIcon className="w-6 h-6" />
            <span className="text-xs">Ustawienia</span>
          </button>
        )}
      </div>
    </header>
  );
}
