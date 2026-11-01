"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  Cpu,
  Database,
  Leaf,
  Search,
  Sparkles,
} from "lucide-react";

import CourseCard, { CATEGORY_EMOJI } from "@/components/CourseCard";
import { useLang } from "@/components/providers";
import { fmt, totalWords } from "@/lib/utils";
import type { CourseSummary, Crop } from "@/types";

interface Props {
  courses: CourseSummary[];
  crops: Crop[];
}

export default function HomeClient({ courses, crops }: Props) {
  const { t } = useLang();
  const categories = Array.from(new Set(courses.map((c) => c.category)));
  const catCounts = courses.reduce<Record<string, number>>((acc, c) => {
    acc[c.category] = (acc[c.category] || 0) + 1;
    return acc;
  }, {});
  const words = totalWords(courses);
  const topCrops = crops.slice(0, 6);

  return (
    <>
      {/* ============================== HERO ============================== */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#ecfdf5] via-[#f7fee7] to-white dark:from-[#0a1008] dark:via-[#0b1409] dark:to-[#0a1008]">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 right-0 h-72 w-72 rounded-full bg-emerald-300/30 blur-3xl dark:bg-emerald-500/10"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 top-40 h-72 w-72 rounded-full bg-lime-200/40 blur-3xl dark:bg-lime-500/10"
        />

        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-16 sm:px-6 sm:pt-20">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-600/25 bg-white/70 px-4 py-1.5 text-sm font-medium text-emerald-800 backdrop-blur dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200">
            🌾 {t("hero_badge").replace("🌾 ", "")}
          </span>

          <h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-emerald-950 sm:text-6xl dark:text-emerald-50">
            {t("hero_title_1")}{" "}
            <span className="bg-gradient-to-r from-emerald-600 to-lime-500 bg-clip-text text-transparent">
              {t("hero_title_2")}
            </span>
          </h1>

          <p className="mt-5 max-w-2xl text-base leading-relaxed text-emerald-950/70 sm:text-lg dark:text-emerald-100/70">
            {t("hero_sub")}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/30 transition hover:bg-emerald-500"
            >
              {t("hero_cta_courses")}
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/recommend"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-700/30 bg-white px-6 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-50 dark:border-emerald-400/25 dark:bg-emerald-500/10 dark:text-emerald-100"
            >
              <Sparkles size={16} />
              {t("hero_cta_recommend")}
            </Link>
          </div>

          {/* stats strip */}
          <dl className="mt-14 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { icon: <BookOpen size={16} />, label: t("stats_modules"), value: courses.length },
              { icon: <Leaf size={16} />, label: t("stats_crops"), value: crops.length },
              { icon: <Search size={16} />, label: t("stats_topics"), value: courses.reduce((s, c) => s + c.topicCount, 0) },
              { icon: <BarChart3 size={16} />, label: t("stats_words"), value: fmt(words) },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-emerald-900/10 bg-white/70 p-4 backdrop-blur dark:border-emerald-400/10 dark:bg-white/5"
              >
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  {s.icon}
                  <span className="text-[11px] font-medium uppercase tracking-wide">
                    {s.label}
                  </span>
                </div>
                <p className="mt-2 text-2xl font-bold text-emerald-950 dark:text-emerald-50">
                  {s.value}
                </p>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ==================== RECOMMENDER BANNER ==================== */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-700 via-emerald-600 to-lime-600 p-8 shadow-xl shadow-emerald-900/20 sm:p-12">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-2xl"
          />
          <div className="relative max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">
              <Cpu size={14} /> {t("model_version")}: RandomForest
            </span>
            <h2 className="mt-4 text-2xl font-extrabold text-white sm:text-3xl">
              {t("recommender_banner_title")}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-emerald-50/85 sm:text-base">
              {t("recommender_banner_text")}
            </p>
            <Link
              href="/recommend"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-700 shadow-lg transition hover:bg-emerald-50"
            >
              {t("recommender_cta")} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ========================= CATEGORIES ========================= */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-emerald-950 dark:text-emerald-50">
              {t("categories_title")}
            </h2>
            <p className="mt-2 text-sm text-emerald-950/60 dark:text-emerald-100/60">
              {t("categories_sub")}
            </p>
          </div>
          <Link
            href="/courses"
            className="hidden text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400 sm:block"
          >
            {t("view_all")} →
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((cat) => (
            <Link
              key={cat}
              href={`/courses?cat=${encodeURIComponent(cat)}`}
              className="group flex items-center gap-3 rounded-2xl border border-emerald-900/10 bg-white p-4 transition hover:border-emerald-600/40 hover:shadow-md dark:border-emerald-400/10 dark:bg-[#0e150d] dark:hover:border-emerald-400/30"
            >
              <span className="text-xl">{CATEGORY_EMOJI[cat] ?? "🌱"}</span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-emerald-950 dark:text-emerald-50">
                  {cat}
                </p>
                <p className="text-xs text-emerald-950/50 dark:text-emerald-100/50">
                  {catCounts[cat]} {t("footer_courses").toLowerCase()}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ======================= FEATURE CARDS ======================= */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              icon: <BookOpen size={22} />,
              title: t("nav_courses"),
              text: t("courses_sub"),
            },
            {
              icon: <Cpu size={22} />,
              title: t("recommender_banner_title"),
              text: t("recommender_banner_text"),
            },
            {
              icon: <Bot size={22} />,
              title: t("chatbot_title"),
              text: t("chatbot_subtitle"),
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-emerald-900/10 bg-white p-6 dark:border-emerald-400/10 dark:bg-[#0e150d]"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300">
                {f.icon}
              </span>
              <h3 className="mt-4 font-semibold text-emerald-950 dark:text-emerald-50">
                {f.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-emerald-950/60 dark:text-emerald-100/60">
                {f.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ========================= LATEST MODULES ========================= */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-emerald-950 dark:text-emerald-50">
              {t("courses_title")}
            </h2>
            <p className="mt-2 text-sm text-emerald-950/60 dark:text-emerald-100/60">
              {t("courses_sub")}
            </p>
          </div>
          <Link
            href="/courses"
            className="text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            {t("view_all")} →
          </Link>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {courses.slice(0, 8).map((c) => (
            <CourseCard key={c.slug} course={c} />
          ))}
        </div>
      </section>

      {/* ========================= CROP PREVIEW ========================= */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-emerald-950 dark:text-emerald-50">
              {t("stats_crops")} · 15-point guides
            </h2>
            <p className="mt-2 text-sm text-emerald-950/60 dark:text-emerald-100/60">
              {t("crop_sections_label")}
            </p>
          </div>
          <Link
            href="/recommend"
            className="text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            {t("recommender_cta")}
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {topCrops.map((crop) => (
            <Link
              key={crop.slug}
              href={`/crop/${crop.slug}`}
              className="group rounded-2xl border border-emerald-900/10 bg-white p-5 text-center transition hover:-translate-y-1 hover:border-emerald-600/40 hover:shadow-md dark:border-emerald-400/10 dark:bg-[#0e150d] dark:hover:border-emerald-400/30"
            >
              <span className="text-4xl">{crop.emoji}</span>
              <p className="mt-3 font-semibold text-emerald-950 group-hover:text-emerald-700 dark:text-emerald-50">
                {crop.name}
              </p>
              <p className="text-xs text-emerald-950/50 dark:text-emerald-100/50">
                {crop.categoryName}
              </p>
            </Link>
          ))}
        </div>
      </section>

      {/* ========================= ABOUT ========================= */}
      <section id="about" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-14 sm:px-6">
        <div className="rounded-3xl border border-emerald-900/10 bg-white p-8 dark:border-emerald-400/10 dark:bg-[#0e150d]">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300">
              <Database size={22} />
            </span>
            <h2 className="text-2xl font-bold text-emerald-950 dark:text-emerald-50">
              {t("about_title")}
            </h2>
          </div>
          <p className="mt-4 max-w-3xl leading-relaxed text-emerald-950/70 dark:text-emerald-100/70">
            {t("about_text")}
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs font-medium">
            {["Next.js", "FastAPI", "MongoDB", "ChromaDB", "Gemini", "Tailwind"].map(
              (tech) => (
                <span
                  key={tech}
                  className="rounded-full bg-emerald-600/10 px-3 py-1 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300"
                >
                  {tech}
                </span>
              )
            )}
          </div>
          <p className="mt-4 text-xs text-emerald-950/50 dark:text-emerald-100/50">
            {t("built_with")} FastAPI · Next.js · MongoDB · ChromaDB · Gemini API ·
            Groq
          </p>
        </div>
      </section>
    </>
  );
}