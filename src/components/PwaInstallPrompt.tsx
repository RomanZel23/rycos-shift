"use client";

import React, { useState, useEffect } from "react";
import { Download, X, Share, Smartphone, Check } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // 1. Sprawdź czy strona jest już otwarta jako zainstalowana aplikacja PWA
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes("android-app://");
      setIsStandalone(Boolean(isStandaloneMode));
    };

    checkStandalone();

    // 2. Wykryj system iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // 3. Rejestracja Service Workera
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => {
          // zarejestrowano
        })
        .catch((err) => {
          console.warn("ServiceWorker registration notice:", err);
        });
    }

    // 4. Obsługa zdarzenia beforeinstallprompt (Android / Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    try {
      const wasDismissed = sessionStorage.getItem("pwa_prompt_dismissed");
      if (wasDismissed) {
        setDismissed(true);
      }
    } catch {
      // ignore
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  // Jeśli aplikacja jest już zainstalowana lub użytkownik zamknął powiadomienie -> nie pokazuj
  if (isStandalone || dismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      if (isIOS) {
        setShowIOSPrompt(true);
      }
      return;
    }

    // Pokaż natywne okno instalacji Android/Chrome
    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;

    if (choiceResult.outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("pwa_prompt_dismissed", "true");
  };

  // Jeśli Android ma gotowy prompt instalacji LUB iOS Safari
  if (!deferredPrompt && !isIOS) {
    return null;
  }

  return (
    <div className="fixed top-20 sm:top-24 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-bounce-short">
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950 border-2 border-sky-500/80 rounded-3xl p-4 sm:p-5 shadow-2xl text-white backdrop-blur-xl relative">
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-start gap-3.5 pr-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-blue-600 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-sky-500/30 flex-shrink-0 border border-white/20">
            SB
          </div>
          <div>
            <div className="font-black text-base text-white">
              Zainstaluj aplikację na telefonie
            </div>
            <p className="text-xs text-slate-300 mt-0.5 leading-relaxed font-medium">
              Dodaj <strong>RYCOS Shift</strong> do ekranu głównego – zyskasz pełny ekran, szybsze działanie i dostęp offline!
            </p>
          </div>
        </div>

        {/* PRZYCISK AKCJI DLA ANDROIDA */}
        {deferredPrompt && (
          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              onClick={handleInstallClick}
              className="flex-1 py-3 px-5 bg-sky-600 hover:bg-sky-500 active:scale-95 text-white font-black text-sm rounded-2xl shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Zainstaluj jednym kliknięciem</span>
            </button>
          </div>
        )}

        {/* WSKAZÓWKA DLA IPHONE / IPAD */}
        {isIOS && !deferredPrompt && (
          <div className="mt-3.5 pt-3 border-t border-slate-800">
            <div className="bg-slate-800/80 p-3 rounded-2xl text-xs space-y-1.5 text-slate-200">
              <div className="font-bold flex items-center gap-1.5 text-sky-400">
                <Share className="w-4 h-4" />
                <span>Instalacja na iPhone / iPad:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-300 font-medium pl-1">
                <li>Kliknij ikonę <strong>Udostępnij</strong> na dolnym pasku Safari (kwadrat ze strzałką w górę <Share className="w-3 h-3 inline text-sky-400" />).</li>
                <li>Wybierz opcję <strong>„Do ekranu początkowego”</strong> (Add to Home Screen).</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
