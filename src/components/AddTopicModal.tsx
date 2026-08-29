"use client";

import React, { useState } from "react";
import { X, Plus, ListFilter, Type, Check } from "lucide-react";
import { DiscussedTopicTemplate } from "@/types";
import { VoiceInputButton } from "./VoiceInputButton";

interface AddTopicModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTopic: (topicText: string) => void;
  availableTemplates: DiscussedTopicTemplate[];
}

export function AddTopicModal({
  isOpen,
  onClose,
  onAddTopic,
  availableTemplates,
}: AddTopicModalProps) {
  const [topicText, setTopicText] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  if (!isOpen) return null;

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = availableTemplates.find((t) => t.id === templateId);
    if (template) {
      setTopicText(template.title);
    }
  };

  const handleVoiceTranscript = (text: string) => {
    setTopicText((prev) => (prev ? `${prev} ${text}` : text));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topicText.trim()) return;
    onAddTopic(topicText.trim());
    setTopicText("");
    setSelectedTemplateId("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* NAGŁÓWEK */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-500/20 text-sky-400 rounded-lg">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Dodaj omawiany obszar / BHP</h3>
              <p className="text-xs text-slate-400">
                Wybierz z listy szablonów, wpisz ręcznie lub podyktuj
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FORMULARZ */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* OPCJA 1: WYBÓR Z LISTY ROZWIJANEJ */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <ListFilter className="w-3.5 h-3.5 text-sky-600" />
              <span>Opcja A: Wybierz ze zdefiniowanych szablonów</span>
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => handleTemplateSelect(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
            >
              <option value="">-- Wybierz gotowy temat odprawy / BHP --</option>
              {availableTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.category ? `[${t.category}] ` : ""}{t.title}
                </option>
              ))}
            </select>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
            <span className="flex-shrink mx-3 text-slate-400 text-[11px] uppercase font-bold tracking-wider">
              lub wpisz / podyktuj
            </span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800"></div>
          </div>

          {/* OPCJA 2 & 3: WPISZ RĘCZNIE LUB GŁOSEM */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-sky-600" />
                <span>Treść omawianego punktu / instruktażu:</span>
              </label>
              {/* Mikrofon */}
              <VoiceInputButton
                onTranscript={handleVoiceTranscript}
                placeholderText="Mów teraz (np. Instruktaż montażu słupów)..."
              />
            </div>
            <textarea
              rows={3}
              value={topicText}
              onChange={(e) => setTopicText(e.target.value)}
              placeholder="Wpisz treść omawianego tematu lub użyj mikrofonu..."
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:outline-none resize-none"
              autoFocus
            />
          </div>

          {/* PRZYCISKI AKCJI */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold text-sm transition-colors cursor-pointer"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={!topicText.trim()}
              className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition-all cursor-pointer ${
                topicText.trim()
                  ? "bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/25 active:scale-95"
                  : "bg-slate-300 text-slate-500 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed opacity-60"
              }`}
            >
              <Check className="w-4 h-4" />
              Dodaj do raportu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
