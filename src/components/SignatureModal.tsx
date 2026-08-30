"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { X, Check, RotateCcw, PenTool, User as UserIcon, AlertCircle } from "lucide-react";
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [hasSignature, setHasSignature] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const pointsCountRef = useRef(0);

  // Dostępni pracownicy do wyboru
  const selectableWorkers = isForemanModal
    ? (preselectedUser ? [preselectedUser] : [])
    : availableUsers.filter((u) => !alreadyAddedUserIds.includes(u.id));

  // Inicjalizacja canvasu i wymiarów
  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = "#0f172a"; // Ciemny granat / navy
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setHasSignature(false);
      setErrorMsg(null);
      pointsCountRef.current = 0;

      if (isForemanModal && preselectedUser) {
        setSelectedUserId(preselectedUser.id);
      } else if (selectableWorkers.length > 0) {
        setSelectedUserId(selectableWorkers[0].id);
      } else {
        setSelectedUserId("");
      }

      setTimeout(() => {
        initCanvas();
      }, 50);
    }
  }, [isOpen, isForemanModal, preselectedUser, availableUsers, alreadyAddedUserIds, initCanvas]);

  useEffect(() => {
    const handleResize = () => {
      if (isOpen) initCanvas();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen, initCanvas]);

  if (!isOpen) return null;

  const effectiveUserId = isForemanModal
    ? preselectedUser?.id
    : selectedUserId || (selectableWorkers[0]?.id ?? "");

  const currentSelectedUser = isForemanModal
    ? preselectedUser
    : availableUsers.find((u) => u.id === effectiveUserId) || selectableWorkers[0];

  // RYSOWANIE
  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    pointsCountRef.current += 1;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();

    pointsCountRef.current += 1;
    if (pointsCountRef.current > 3 && !hasSignature) {
      setHasSignature(true);
      setErrorMsg(null);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {
        // ok
      }
    }
    setIsDrawing(false);
    if (pointsCountRef.current > 3) {
      setHasSignature(true);
      setErrorMsg(null);
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    initCanvas();
    setHasSignature(false);
    pointsCountRef.current = 0;
  };

  const handleSave = () => {
    if (!currentSelectedUser) {
      setErrorMsg("Proszę wybrać pracownika z listy.");
      return;
    }

    if (!hasSignature || pointsCountRef.current <= 3) {
      setErrorMsg("Złożenie podpisu odręcznego w ramce jest wymagane!");
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const signatureDataUrl = canvas.toDataURL("image/png");

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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* NAGŁÓWEK OKNA */}
        <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/25 text-sky-400 rounded-xl">
              <PenTool className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-lg sm:text-xl text-white">
                {isForemanModal ? "Podpis Brygadzisty" : "Podpis pracownika na liście"}
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 font-semibold">
                Złóż czytelny podpis palcem lub rysikiem
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* ZAWARTOŚĆ FORMULARZA */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          {/* WYBÓR OSOBY */}
          {isForemanModal ? (
            <div className="p-4 bg-sky-50 dark:bg-sky-950/60 border-2 border-sky-200 dark:border-sky-800 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center font-black text-lg flex-shrink-0 shadow-md">
                {currentSelectedUser?.firstName[0]}
                {currentSelectedUser?.lastName[0]}
              </div>
              <div>
                <div className="text-xs text-sky-800 dark:text-sky-300 font-extrabold uppercase tracking-wider">
                  Brygadzista prowadzący odprawę:
                </div>
                <div className="font-black text-slate-900 dark:text-white text-lg sm:text-xl">
                  {currentSelectedUser
                    ? `${currentSelectedUser.firstName} ${currentSelectedUser.lastName}`
                    : "Nie wybrano brygadzisty"}
                </div>
                <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-semibold">
                  {currentSelectedUser?.role || "Brygadzista"}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-200 mb-2">
                Wybierz pracownika z listy: <span className="text-rose-500">*</span>
              </label>
              {selectableWorkers.length === 0 ? (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/60 border-2 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-sm font-bold rounded-2xl flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-amber-600" />
                  <span>Wszyscy dostępni pracownicy zostali już dodani do listy obecności.</span>
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={effectiveUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full h-14 px-4 pr-12 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-base sm:text-lg font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none appearance-none truncate cursor-pointer shadow-inner"
                  >
                    {selectableWorkers.map((worker) => (
                      <option key={worker.id} value={worker.id}>
                        {worker.firstName} {worker.lastName} ({worker.role || "Pracownik"})
                      </option>
                    ))}
                  </select>
                  <UserIcon className="w-5 h-5 text-slate-400 absolute right-4 top-4.5 pointer-events-none" />
                </div>
              )}
            </div>
          )}

          {/* POLE PODPISU (CANVAS) - DUŻA PRZESTRZEŃ */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                <span>Złóż podpis w ramce poniżej:</span>
                <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleClear}
                className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs sm:text-sm text-slate-700 dark:text-slate-300 rounded-xl flex items-center gap-1.5 font-bold cursor-pointer transition-colors border border-slate-200 dark:border-slate-700"
              >
                <RotateCcw className="w-4 h-4" />
                Wyczyść
              </button>
            </div>

            <div
              ref={containerRef}
              className="relative border-3 border-dashed border-slate-400 dark:border-slate-600 bg-white rounded-2xl overflow-hidden shadow-inner touch-none select-none h-52 sm:h-60"
            >
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="w-full h-full cursor-crosshair touch-none"
                style={{ touchAction: "none" }}
              />

              {!hasSignature && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400 text-sm sm:text-base gap-2 opacity-60 font-bold">
                  <PenTool className="w-8 h-8 animate-pulse text-sky-600" />
                  <span>Podpisz palcem lub rysikiem tutaj</span>
                </div>
              )}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border-2 border-rose-200 text-rose-800 text-sm rounded-xl font-bold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* STOPKA I PRZYCISKI AKCJI */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/80 border-t-2 border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3.5 rounded-2xl border-2 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-base transition-colors cursor-pointer"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasSignature || !currentSelectedUser}
            className={`flex items-center gap-2 px-8 py-3.5 rounded-2xl font-black text-base sm:text-lg shadow-xl transition-all cursor-pointer ${
              hasSignature && currentSelectedUser
                ? "bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/30 active:scale-95"
                : "bg-slate-300 text-slate-500 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed opacity-60 shadow-none"
            }`}
          >
            <Check className="w-5 h-5" />
            Zatwierdź podpis (OK)
          </button>
        </div>
      </div>
    </div>
  );
}
