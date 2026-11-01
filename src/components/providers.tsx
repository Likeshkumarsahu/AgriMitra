"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { t } from "@/lib/i18n";
import type { Lang } from "@/types";

/* ------------------------------------------------------------------ theme */
type Theme = "light" | "dark";

interface ThemeCtx {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeCtx>({ theme: "dark", toggleTheme: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const stored = window.localStorage.getItem("agrimitra-theme") as Theme | null;
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/* ------------------------------------------------------------------ lang */
interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  t: (key: string) => string;
}

const LangContext = createContext<LangCtx>({
  lang: "en",
  setLang: () => {},
  toggleLang: () => {},
  t: (k) => k,
});

export function useLang() {
  return useContext(LangContext);
}

function getInitialLang(): Lang {
  if (typeof window === "undefined") return "en";
  return (window.localStorage.getItem("agrimitra-lang") as Lang) || "en";
}

/* ---------------------------------------------------------------- provider */
export function Providers({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [lang, setLangState] = useState<Lang>(getInitialLang);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    window.localStorage.setItem("agrimitra-theme", theme);
  }, [theme]);

  useEffect(() => {
    window.localStorage.setItem("agrimitra-lang", lang);
    document.documentElement.lang = lang === "hi" ? "hi" : "en";
  }, [lang]);

  const toggleTheme = useCallback(() => setTheme((p) => (p === "dark" ? "light" : "dark")), []);
  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const toggleLang = useCallback(() => setLangState((p) => (p === "en" ? "hi" : "en")), []);

  const langValue = useMemo(
    () => ({ lang, setLang, toggleLang, t: (k: string) => t(k, lang) }),
    [lang, setLang, toggleLang]
  );
  const themeValue = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return (
    <ThemeContext.Provider value={themeValue}>
      <LangContext.Provider value={langValue}>{children}</LangContext.Provider>
    </ThemeContext.Provider>
  );
}