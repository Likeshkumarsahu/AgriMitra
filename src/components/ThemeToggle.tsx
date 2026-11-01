"use client";

import { Moon, Sun } from "lucide-react";

import { useTheme } from "@/components/providers";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label="Toggle dark/light theme"
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-700/30 bg-white/5 text-emerald-200 transition hover:bg-white/10 hover:text-emerald-100 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100"
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}