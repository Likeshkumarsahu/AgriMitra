"use client";

import { Languages } from "lucide-react";

import { useLang } from "@/components/providers";

export default function LangToggle() {
  const { lang, toggleLang } = useLang();
  return (
    <button
      type="button"
      onClick={toggleLang}
      aria-label="Switch language English/Hindi"
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-700/30 bg-white/5 px-3 text-sm font-medium text-emerald-200 transition hover:bg-white/10 hover:text-emerald-100 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100"
      title={lang === "en" ? "हिन्दी पर जाएं" : "Switch to English"}
    >
      <Languages size={16} />
      <span>{lang === "en" ? "हिन्दी" : "English"}</span>
    </button>
  );
}