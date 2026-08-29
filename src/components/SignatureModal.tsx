"use client";

import React, { useRef, useState, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { X, Check, RotateCcw, PenTool, User as UserIcon } from "lucide-react";
import { User, AttendanceRecord } from "@/types";

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (record: AttendanceRecord) => void;
  isForemanModal: boolean;
  preselectedUser?: User | null;
  availableUsers: User[];
  alreadyAddedUserIds: string[];
}

export function SignatureModal({
  isOpen,
  onClose,
  onConfirm,
  isForemanModal,
  preselectedUser,
  availableUsers,
  alreadyAddedUserIds,
}: SignatureModalProps) {
  const sigPadRef = useRef<SignatureCanvas | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [hasSignature, setHasSignature] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filtruj pracowników dostępnych do wyboru (wykluczając już dodanych, chyba że to edycja)
  const selectableWorkers = availableUsers.filter((u) => !alreadyAddedUserIds.includes(u.id));

  useEffect(() => {
    if (isOpen) {
      setHasSignature(false);
      setErrorMsg(null);
      if (isForemanModal && preselectedUser) {
        setSelectedUserId(preselectedUser.id);
      } else {
        const firstAvailable = selectableWorkers[0];
        setSelectedUserId(firstAvailable ? firstAvailable.id : "");
      }
      setTimeout(() => {
        sigPadRef.current?.clear();
      }, 100);
    }
  }, [isOpen, isForemanModal, preselectedUser]);

  if (!isOpen) return null;

  const currentSelectedUser = isForemanModal
    ? preselectedUser
    : availableUsers.find((u) => u.id === selectedUserId);

  const handleClear = () => {
    sigPadRef.current?.clear();
    setHasSignature(false);
  };

  const handleEndDrawing = () => {
    if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
      setHasSignature(true);
      setErrorMsg(null);
    } else {
      setHasSignature(false);
    }
  };

  const handleSave = () => {
    if (!currentSelectedUser) {
      setErrorMsg("Proszę wybrać pracownika z listy");
      return;
    }

    if (!sigPadRef.current || sigPadRef.current.isEmpty() || !hasSignature) {
      setErrorMsg("Złożenie podpisu odręcznego jest wymagane!");
      return;
    }

    // Pobierz podpis jako przezroczysty lub biały PNG
    const signatureDataUrl = sigPadRef.current.getTrimmedCanvas().toDataURL("image/png");

    const record: AttendanceRecord = {
      id: "att-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
      userId: currentSelectedUser.id,
      userName: `${currentSelectedUser.firstName} ${currentSelectedUser.lastName}`,
      userRole: currentSelectedUser.role || (isForemanModal ? "Brygadzista" : "Pracownik"),
      isForeman: isForemanModal || currentSelectedUser.isForeman,
      signatureDataUrl,
      signedAt: new Date().toISOString(),
    };

    onConfirm(record);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* NAGŁÓWEK OKNA */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-500/20 text-sky-400 rounded-lg">
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                {isForemanModal ? "Podpis Brygadzisty" : "Lista obecności – Podpis pracownika"}
              </h3>
              <p className="text-xs text-slate-400">
                Wymagany czytelny podpis palcem lub rysikiem
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ZAWARTOŚĆ FORMULARZA */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* WYBÓR OSOBY */}
          {isForemanModal ? (
            <div className="p-3.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 rounded-xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sky-600 text-white flex items-center justify-center font-bold text-sm">
                {currentSelectedUser?.firstName[0]}
                {currentSelectedUser?.lastName[0]}
              </div>
              <div>
                <div className="text-xs text-sky-800 dark:text-sky-300 font-semibold uppercase tracking-wider">
                  Brygadzista prowadzący odprawę:
                </div>
                <div className="font-bold text-slate-900 dark:text-white text-base">
                  {currentSelectedUser
                    ? `${currentSelectedUser.firstName} ${currentSelectedUser.lastName}`
                    : "Nie wybrano brygadzisty"}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  {currentSelectedUser?.role || "Brygadzista"}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Wybierz pracownika z listy:
              </label>
              {selectableWorkers.length === 0 ? (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs rounded-xl">
                  Wszyscy dostępni pracownicy zostali już dodani do listy obecności.
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none appearance-none"
                  >
                    {selectableWorkers.map((worker) => (
                      <option key={worker.id} value={worker.id}>
                        {worker.firstName} {worker.lastName} ({worker.role || "Pracownik"})
                      </option>
                    ))}
                  </select>
                  <UserIcon className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
                </div>
              )}
            </div>
          )}

          {/* POLE PODPISU (CANVAS) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                <span>Złóż podpis w ramce poniżej:</span>
                <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 font-medium cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Wyczyść
              </button>
            </div>

            <div
              className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 bg-white rounded-xl overflow-hidden shadow-inner touch-none"
              style={{ height: "180px" }}
            >
              <SignatureCanvas
                ref={(ref) => {
                  sigPadRef.current = ref;
                }}
                onEnd={handleEndDrawing}
                penColor="#0f172a"
                canvasProps={{
                  className: "w-full h-full cursor-crosshair",
                  style: { touchAction: "none", width: "100%", height: "100%" },
                }}
              />
              {!hasSignature && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400 text-xs gap-1 opacity-60">
                  <PenTool className="w-6 h-6" />
                  <span>Podpisz palcem lub rysikiem tutaj</span>
                </div>
              )}
            </div>
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
              {errorMsg}
            </div>
          )}
        </div>

        {/* STOPKA I PRZYCISKI AKCJI */}
        <div className="px-5 py-4 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-sm transition-colors cursor-pointer"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasSignature || !currentSelectedUser}
            className={`flex items-center gap-1.5 px-6 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer ${
              hasSignature && currentSelectedUser
                ? "bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/25 active:scale-95"
                : "bg-slate-300 text-slate-500 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed opacity-60 shadow-none"
            }`}
          >
            <Check className="w-4 h-4" />
            OK (Zatwierdź podpis)
          </button>
        </div>
      </div>
    </div>
  );
}
