"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Volume2 } from "lucide-react";

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
  placeholderText?: string;
}

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
