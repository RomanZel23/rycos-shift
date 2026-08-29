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
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* LOGOTYP & BRANDING */}
          <div className="flex items-center gap-3">
            {/* Sygnet / Ikona SB Technology */}
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr from-sky-600 via-blue-600 to-indigo-500 flex items-center justify-center font-black text-white text-base sm:text-lg shadow-lg shadow-sky-500/20 border border-white/20 flex-shrink-0">
              SB
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base sm:text-lg tracking-wider text-white uppercase font-sans">
                  {settings.logoText || "SB TECHNOLOGY"}
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 bg-sky-500/20 text-sky-300 text-[10px] font-bold rounded uppercase tracking-wider border border-sky-500/30">
                  Poznań
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-slate-400 font-medium">
                {settings.logoSubtitle || "RYCOS Shift workflow"}
              </p>
            </div>
          </div>

          {/* NAWIGACJA DESKTOP / TABLET */}
          <nav className="hidden md:flex items-center gap-1.5 bg-slate-800/80 p-1.5 rounded-2xl border border-slate-700/60">
            <button
              type="button"
              onClick={() => onTabChange("START_SHIFT")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "START_SHIFT"
                  ? "bg-sky-600 text-white shadow-md shadow-sky-600/25"
                  : "text-slate-300 hover:text-white hover:bg-slate-700/50"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Rozpoczęcie prac</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange("END_SHIFT")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === "END_SHIFT"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                  : "text-slate-300 hover:text-white hover:bg-slate-700/50"
              }`}
            >
              <Camera className="w-4 h-4" />
              <span>Zakończenie prac</span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange("ARCHIVE")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
                activeTab === "ARCHIVE"
                  ? "bg-slate-700 text-white shadow-md"
                  : "text-slate-300 hover:text-white hover:bg-slate-700/50"
              }`}
            >
              <Archive className="w-4 h-4" />
              <span>Archiwum</span>
              {reportsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-sky-500 text-white text-[10px] font-bold font-mono">
                  {reportsCount}
                </span>
              )}
            </button>

            {/* ZAKŁADKA USTAWIENIA – TYLKO DLA ADMINA */}
            {currentUser.isAdmin && (
              <button
                type="button"
                onClick={() => onTabChange("SETTINGS")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "SETTINGS"
                    ? "bg-amber-600 text-white shadow-md shadow-amber-600/25"
                    : "text-amber-400 hover:text-amber-300 hover:bg-slate-700/50"
                }`}
              >
                <SettingsIcon className="w-4 h-4" />
                <span>Ustawienia</span>
              </button>
            )}
          </nav>

          {/* PRZEŁĄCZNIK PROFILU UŻYTKOWNIKA */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-left transition-all cursor-pointer active:scale-95"
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                  currentUser.isAdmin
                    ? "bg-amber-500 text-slate-950"
                    : currentUser.isForeman
                    ? "bg-sky-500 text-white"
                    : "bg-slate-600 text-white"
                }`}
              >
                {currentUser.isAdmin ? (
                  <Shield className="w-3.5 h-3.5" />
                ) : currentUser.isForeman ? (
                  <HardHat className="w-3.5 h-3.5" />
                ) : (
                  <UserIcon className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-white leading-tight">
                  {currentUser.firstName} {currentUser.lastName}
                </div>
                <div className="text-[10px] text-slate-400 font-medium">
                  {currentUser.isAdmin
                    ? "Administrator"
                    : currentUser.isForeman
                    ? "Brygadzista"
                    : "Pracownik"}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* DROPDOWN WYBORU UŻYTKOWNIKA DO TESTOWANIA RÓL */}
            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-2 z-50 animate-fade-in">
                <div className="px-3 py-2 text-[11px] text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                  Przełącz profil użytkownika:
                </div>
                <div className="max-h-60 overflow-y-auto py-1 space-y-1">
                  {allUsers.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => {
                        onUserChange(user);
                        setUserDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors cursor-pointer ${
                        user.id === currentUser.id
                          ? "bg-sky-600 text-white font-bold"
                          : "text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <div>
                        <div className="font-semibold">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-[10px] opacity-80">{user.role}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        {user.isAdmin && (
                          <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 text-[9px] font-bold rounded">
                            ADMIN
                          </span>
                        )}
                        {user.isForeman && (
                          <span className="px-1.5 py-0.5 bg-sky-500/20 text-sky-300 text-[9px] font-bold rounded">
                            BRYGADA
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="p-2 border-t border-slate-800 text-[10px] text-slate-400 text-center">
                  Zegar systemowy: <strong className="text-sky-400 font-mono">{currentTime}</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MOBILNA BELKA NAWIGACYJNA (DOLNA / STICKY BOTTOM DLA SMARTFONÓW) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-1.5 flex items-center justify-around">
        <button
          type="button"
          onClick={() => onTabChange("START_SHIFT")}
          className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === "START_SHIFT"
              ? "text-sky-400 font-bold scale-105"
              : "text-slate-400 font-medium"
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-[10px]">Rozpoczęcie</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange("END_SHIFT")}
          className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
            activeTab === "END_SHIFT"
              ? "text-indigo-400 font-bold scale-105"
              : "text-slate-400 font-medium"
          }`}
        >
          <Camera className="w-5 h-5" />
          <span className="text-[10px]">Zakończenie</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange("ARCHIVE")}
          className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer relative ${
            activeTab === "ARCHIVE"
              ? "text-slate-200 font-bold scale-105"
              : "text-slate-400 font-medium"
          }`}
        >
          <Archive className="w-5 h-5" />
          <span className="text-[10px]">Archiwum</span>
          {reportsCount > 0 && (
            <span className="absolute top-1 right-2 w-4 h-4 bg-sky-500 text-white rounded-full text-[9px] flex items-center justify-center font-bold">
              {reportsCount}
            </span>
          )}
        </button>

        {currentUser.isAdmin && (
          <button
            type="button"
            onClick={() => onTabChange("SETTINGS")}
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
              activeTab === "SETTINGS"
                ? "text-amber-400 font-bold scale-105"
                : "text-slate-400 font-medium"
            }`}
          >
            <SettingsIcon className="w-5 h-5" />
            <span className="text-[10px]">Ustawienia</span>
          </button>
        )}
      </div>
    </header>
  );
}
