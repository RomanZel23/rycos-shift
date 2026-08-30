"use client";

import React, { useState } from "react";
import { X, Check, Plus, MessageSquarePlus, Sparkles, BookOpen } from "lucide-react";
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    const template = availableTemplates.find((t) => t.id === templateId);
    if (template) {
      setTopicText(template.title);
      setErrorMsg(null);
    }
  };

  const handleVoiceTranscript = (text: string) => {
    setTopicText((prev) => (prev ? `${prev} ${text}` : text));
    setErrorMsg(null);
  };

  const handleSave = () => {
    const trimmed = topicText.trim();
    if (!trimmed) {
      setErrorMsg("Wprowadź treść tematu lub wybierz szablon z listy");
      return;
    }

    onAddTopic(trimmed);
    setTopicText("");
    setSelectedTemplateId("");
    setErrorMsg(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* NAGŁÓWEK */}
        <div className="px-6 py-5 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/25 text-sky-400 rounded-xl">
              <MessageSquarePlus className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-lg sm:text-xl text-white">
                Dodaj obszar / temat odprawy
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 font-medium">
                Wybierz z gotowych reguł BHP lub podyktuj głosem
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

        {/* TREŚĆ */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* SZABLONY PREDEFINIOWANE */}
          {availableTemplates.length > 0 && (
            <div>
              <label className="block text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-sky-500" />
                <span>Wybierz z gotowych szablonów BHP:</span>
              </label>
              <div className="relative">
                <select
                  value={selectedTemplateId}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="w-full h-14 px-4 pr-10 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-sm sm:text-base font-bold text-slate-900 dark:text-white focus:ring-4 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none appearance-none truncate cursor-pointer shadow-inner"
                >
                  <option value="">-- Wybierz szablon lub wpisz poniżej własny --</option>
                  {availableTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      [{template.category || "BHP"}] {template.title}
                    </option>
                  ))}
                </select>
                <Sparkles className="w-5 h-5 text-sky-500 absolute right-4 top-4.5 pointer-events-none" />
              </div>
            </div>
          )}

          {/* WPISYWANIE WŁASNEGO TEKSTU / DYKTOWANIE */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm sm:text-base font-extrabold text-slate-800 dark:text-slate-200">
                Treść omawianego punktu: <span className="text-rose-500">*</span>
              </label>
              <VoiceInputButton
                onTranscript={handleVoiceTranscript}
                placeholderText="Dyktuj treść punktu BHP..."
              />
            </div>

            <textarea
              rows={4}
              value={topicText}
              onChange={(e) => {
                setTopicText(e.target.value);
                setErrorMsg(null);
              }}
              placeholder="Wpisz treść zagadnienia lub kliknij 'Dyktuj głosem' powyżej..."
              className="w-full p-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-base sm:text-lg font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-4 focus:ring-sky-500/20 focus:border-sky-500 focus:outline-none shadow-inner leading-relaxed"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border-2 border-rose-200 text-rose-800 text-sm rounded-xl font-bold">
              {errorMsg}
            </div>
          )}
        </div>

        {/* PRZYCISKI STOPKI */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/80 border-t-2 border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-3 rounded-2xl border-2 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold text-base transition-colors cursor-pointer"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!topicText.trim()}
            className={`flex items-center gap-2 px-7 py-3.5 rounded-2xl font-black text-base shadow-lg transition-all cursor-pointer ${
              topicText.trim()
                ? "bg-sky-600 hover:bg-sky-500 text-white shadow-sky-600/30 active:scale-95"
                : "bg-slate-300 text-slate-500 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed opacity-60"
            }`}
          >
            <Check className="w-5 h-5" />
            Dodaj do raportu
          </button>
        </div>
      </div>
    </div>
  );
}
