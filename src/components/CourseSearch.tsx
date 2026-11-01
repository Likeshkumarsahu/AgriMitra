"use client";

import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import CourseCard from "@/components/CourseCard";
import { EmptyState } from "@/components/Status";
import { useLang } from "@/components/providers";
import type { CourseSummary } from "@/types";

export default function CourseSearch({
  courses,
  initialCat,
}: {
  courses: CourseSummary[];
  initialCat?: string;
}) {
  const { t } = useLang();
  const categories = useMemo(
    () => Array.from(new Set(courses.map((c) => c.category))),
    [courses]
  );
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState(initialCat ?? "All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses.filter((c) => {
      const matchCat = cat === "All" || c.category === cat;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.topics.some((topic) => topic.toLowerCase().includes(q)) ||
        c.category.toLowerCase().includes(q)
      );
    });
  }, [courses, query, cat]);

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-emerald-700/50 dark:text-emerald-300/50"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search_placeholder")}
            className="w-full rounded-xl border border-emerald-900/15 bg-white py-3 pl-11 pr-10 text-sm text-emerald-950 placeholder:text-emerald-950/40 focus:border-emerald-600/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-emerald-400/15 dark:bg-[#0e150d] dark:text-emerald-50 dark:placeholder:text-emerald-100/40"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-700/50 hover:text-emerald-700 dark:text-emerald-300/50"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex max-w-full gap-2 overflow-x-auto pb-1 md:justify-end">
          {["All", ...categories].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
                cat === c
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "border border-emerald-900/15 bg-white text-emerald-950/70 hover:border-emerald-600/40 dark:border-emerald-400/15 dark:bg-[#0e150d] dark:text-emerald-100/70"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-xs text-emerald-950/50 dark:text-emerald-100/50">
        {filtered.length} {t("search_results")}
      </p>

      {filtered.length === 0 ? (
        <div className="mt-6">
          <EmptyState onReset={() => { setQuery(""); setCat("All"); }} />
        </div>
      ) : (
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <CourseCard key={c.slug} course={c} />
          ))}
        </div>
      )}
    </div>
  );
}