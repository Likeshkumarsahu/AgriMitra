"use client";

import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";

import { useLang } from "@/components/providers";
import { fmt } from "@/lib/utils";
import type { CourseSummary } from "@/types";

export const CATEGORY_EMOJI: Record<string, string> = {
  "Farming Practices": "🚜",
  Soils: "🪨",
  "Soil Science": "🪨",
  Crops: "🌾",
  "Crop Production": "🌾",
  Irrigation: "💧",
  "Water Management": "💧",
  Fertilizers: "🧪",
  "Organic Farming": "🌱",
  Horticulture: "🍇",
  "Dairy Science": "🐄",
  Engineering: "⚙️",
  "Farm Machinery": "⚙️",
  Pathology: "🦠",
  Entomology: "🐞",
  Weeds: "🌿",
  Economics: "📈",
};

export default function CourseCard({ course }: { course: CourseSummary }) {
  const { t } = useLang();
  const words = fmt(course.words);
  return (
    <Link
      href={`/courses/${course.slug}`}
      className="group flex h-full flex-col rounded-2xl border border-emerald-900/10 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-emerald-600/40 hover:shadow-lg dark:border-emerald-400/10 dark:bg-[#0e150d] dark:hover:border-emerald-400/30"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xl">{CATEGORY_EMOJI[course.category] ?? "📖"}</span>
        <span className="rounded-full bg-emerald-600/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
          {course.category}
        </span>
      </div>
      <h3 className="mt-3 text-base font-semibold leading-snug text-emerald-950 group-hover:text-emerald-700 dark:text-emerald-50 dark:group-hover:text-emerald-200">
        {course.title}
      </h3>
      <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-emerald-950/60 dark:text-emerald-100/60">
        {course.description}
      </p>
      <div className="mt-4 flex items-center justify-between text-xs text-emerald-950/50 dark:text-emerald-100/50">
        <span className="inline-flex items-center gap-1">
          <BookOpen size={13} /> {course.topicCount} {t("course_topics")} · {words}{" "}
          {t("stats_words")}
        </span>
        <ArrowRight
          size={15}
          className="transition group-hover:translate-x-1 group-hover:text-emerald-600"
        />
      </div>
    </Link>
  );
}