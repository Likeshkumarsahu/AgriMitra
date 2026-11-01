"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sprout } from "lucide-react";

import LangToggle from "@/components/LangToggle";
import ThemeToggle from "@/components/ThemeToggle";
import { useLang } from "@/components/providers";

export default function Navbar() {
  const { t } = useLang();
  const pathname = usePathname();

  const links = [
    { href: "/", label: t("nav_home") },
    { href: "/courses", label: t("nav_courses") },
    { href: "/recommend", label: t("nav_recommend") },
    { href: "/#about", label: t("nav_about") },
  ];

  const active = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-emerald-900/20 bg-[#ffffff]/85 backdrop-blur-md dark:border-emerald-400/10 dark:bg-[#0a1008]/85">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-700 text-white shadow-lg shadow-emerald-900/40">
            <Sprout size={20} />
          </span>
          <span className="text-lg text-emerald-950 dark:text-emerald-50">
            {t("brand")}
          </span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                active(l.href)
                  ? "bg-emerald-600/10 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200"
                  : "text-emerald-950/70 hover:bg-emerald-600/5 hover:text-emerald-800 dark:text-emerald-100/70 dark:hover:text-emerald-100"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <LangToggle />
          <ThemeToggle />
          {/* mobile menu link fallback */}
          <Link
            href="/recommend"
            className="inline-flex h-9 items-center rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 md:hidden"
          >
            {t("nav_recommend")}
          </Link>
        </div>
      </nav>
    </header>
  );
}