"use client";

import Link from "next/link";
import { GitBranch, Heart, Sprout } from "lucide-react";

import { useLang } from "@/components/providers";

export default function Footer() {
  const { t } = useLang();
  return (
    <footer className="border-t border-emerald-900/20 bg-[#f6faf2] dark:border-emerald-400/10 dark:bg-[#0b1109]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2 font-bold">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-green-700 text-white">
              <Sprout size={18} />
            </span>
            <span className="text-emerald-950 dark:text-emerald-50">{t("brand")}</span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-emerald-950/60 dark:text-emerald-100/60">
            {t("footer_text")}. {t("tagline")}.
          </p>
        </div>

        <div className="md:justify-self-center">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-950/80 dark:text-emerald-100/80">
            {t("footer_links")}
          </h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/courses" className="text-emerald-950/60 hover:text-emerald-700 dark:text-emerald-100/60 dark:hover:text-emerald-200">
                {t("footer_courses")}
              </Link>
            </li>
            <li>
              <Link href="/recommend" className="text-emerald-950/60 hover:text-emerald-700 dark:text-emerald-100/60 dark:hover:text-emerald-200">
                {t("footer_recommend")}
              </Link>
            </li>
            <li>
              <span className="cursor-pointer text-emerald-950/60 hover:text-emerald-700 dark:text-emerald-100/60 dark:hover:text-emerald-200">
                {t("footer_chat")}
              </span>
            </li>
          </ul>
        </div>

        <div className="md:justify-self-end">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-emerald-950/80 dark:text-emerald-100/80">
            Stack
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-emerald-950/60 dark:text-emerald-100/60">
            Next.js · FastAPI · MongoDB · ChromaDB · Gemini
          </p>
          <div className="mt-4 flex gap-3 text-emerald-950/50 dark:text-emerald-100/50">
            <GitBranch size={20} aria-label="GitHub" />
            <span className="inline-flex items-center gap-1 text-xs">
              <Heart size={14} className="text-emerald-600 dark:text-emerald-400" />
              Major Project
            </span>
          </div>
        </div>
      </div>
      <div className="border-t border-emerald-900/10 py-4 text-center text-xs text-emerald-950/50 dark:border-emerald-400/10 dark:text-emerald-100/50">
        © {new Date().getFullYear()} AgriMitra · {t("footer_rights")}
      </div>
    </footer>
  );
}