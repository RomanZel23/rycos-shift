"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Volume2 } from "lucide-react";

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
  placeholderText?: string;
}

// Typy dla Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
    length: number;
  };
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: Event) => void;
  onend: () => void;
}

export function VoiceInputButton({
  onTranscript,
  className = "",
  placeholderText = "Mów teraz...",
}: VoiceInputButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance }).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "pl-PL";

        recognition.onresult = (event: SpeechRecognitionEvent) => {
          if (event.results.length > 0) {
            const transcript = event.results[0][0].transcript;
            if (transcript) {
              onTranscript(transcript.trim());
            }
          }
          setIsListening(false);
        };

        recognition.onerror = () => {
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } else {
        setSupported(false);
      }
    }
  }, [onTranscript]);

  const toggleListening = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!supported) {
      // Fallback dialog if Web Speech API isn't enabled
      const text = prompt("Wprowadzanie głosowe nie jest wspierane w tej przeglądarce. Wpisz tekst:");
      if (text) onTranscript(text.trim());
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (err) {
        console.warn("Speech start error:", err);
        setIsListening(false);
      }
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={toggleListening}
        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none active:scale-95 ${
          isListening
            ? "bg-rose-600 text-white shadow-lg shadow-rose-500/30 animate-pulse"
            : "bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/60 dark:text-sky-300 dark:hover:bg-sky-900/60 border border-sky-200 dark:border-sky-800"
        } ${className}`}
        title={isListening ? "Zatrzymaj dyktowanie" : "Dyktuj głosem (polski)"}
      >
        {isListening ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            <MicOff className="w-3.5 h-3.5" />
            <span>Słucham...</span>
          </>
        ) : (
          <>
            <Mic className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>Powiedz</span>
          </>
        )}
      </button>

      {isListening && (
        <div className="absolute left-0 -top-9 bg-slate-900 text-white text-[11px] px-2.5 py-1 rounded-md shadow-lg flex items-center gap-1.5 whitespace-nowrap z-30 animate-fade-in">
          <Volume2 className="w-3 h-3 text-sky-400 animate-bounce" />
          <span>{placeholderText}</span>
        </div>
      )}
    </div>
  );
}
