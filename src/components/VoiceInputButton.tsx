"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Volume2 } from "lucide-react";
import { finalTranscriptFrom, SpeechResultEvent } from "@/lib/speech";

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
  placeholderText?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function VoiceInputButton({
  onTranscript,
  className = "",
  placeholderText = "Mów teraz...",
}: VoiceInputButtonProps) {
  const [isListening, setIsListening] = useState(false);
  // Brak obsługi mowy poznajemy po pustym refie — osobny stan był zbędny
  // (widok go nie używał), a jego ustawianie w efekcie łamie regułę
  // react-hooks/set-state-in-effect i przy React Compiler bywa pomijane.
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Wywołanie zwrotne trzymamy w refie, żeby móc zbudować obiekt rozpoznawania
  // DOKŁADNIE RAZ. Wcześniej efekt zależał od `onTranscript`, a rodzic
  // przekazuje tu funkcję strzałkową tworzoną przy każdym renderze — więc przy
  // każdym wpisanym znaku powstawał nowy obiekt rozpoznawania. Ten w refie
  // przestawał być tym, który faktycznie nasłuchuje, i przycisk „Zatrzymaj"
  // zatrzymywał nie to, co trzeba.
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.continuous = false;
    // Wyniki tymczasowe są nam niepotrzebne, a to one powodowały doklejanie
    // kolejnych wersji tej samej frazy. Filtr `isFinal` w finalTranscriptFrom
    // broni nas i wtedy, gdy przeglądarka przyśle je mimo tego ustawienia.
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.lang = "pl-PL";

    recognition.onresult = (event: SpeechResultEvent) => {
      const text = finalTranscriptFrom(event);
      if (text) onTranscriptRef.current(text);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      // Bez tego mikrofon zostawał otwarty po zamknięciu okna opisu zdjęcia.
      try {
        recognition.abort();
      } catch {
        /* obiekt mógł nigdy nie wystartować */
      }
      recognitionRef.current = null;
    };
  }, []);

  const toggleListening = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const recognition = recognitionRef.current;
      if (!recognition) {
        const text = prompt(
          "Wprowadzanie głosowe nie jest wspierane w tej przeglądarce. Wpisz tekst:"
        );
        if (text) onTranscriptRef.current(text.trim());
        return;
      }

      if (isListening) {
        try {
          recognition.stop();
        } catch {
          /* już zatrzymane */
        }
        setIsListening(false);
        return;
      }

      try {
        recognition.start();
        setIsListening(true);
      } catch (err) {
        // start() rzuca InvalidStateError, jeśli sesja już trwa.
        console.warn("Speech start error:", err);
        setIsListening(false);
      }
    },
    [isListening]
  );

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={toggleListening}
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer select-none active:scale-95 shadow-sm ${
          isListening
            ? "bg-rose-600 text-white shadow-lg shadow-rose-500/30 animate-pulse"
            : "bg-sky-100 text-sky-900 hover:bg-sky-200 dark:bg-sky-950 dark:text-sky-200 dark:hover:bg-sky-900 border-2 border-sky-300 dark:border-sky-700"
        } ${className}`}
        title={isListening ? "Zatrzymaj dyktowanie" : "Dyktuj głosem (polski)"}
      >
        {isListening ? (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
            </span>
            <MicOff className="w-4 h-4" />
            <span>Słucham...</span>
          </>
        ) : (
          <>
            <Mic className="w-4 h-4 text-sky-700 dark:text-sky-300" />
            <span>Dyktuj głosem</span>
          </>
        )}
      </button>

      {isListening && (
        <div className="absolute left-0 -top-11 bg-slate-900 text-white text-xs px-3.5 py-1.5 rounded-xl shadow-2xl flex items-center gap-2 whitespace-nowrap z-30 animate-fade-in border border-slate-700">
          <Volume2 className="w-4 h-4 text-sky-400 animate-bounce" />
          <span className="font-semibold">{placeholderText}</span>
        </div>
      )}
    </div>
  );
}
