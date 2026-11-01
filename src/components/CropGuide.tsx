"use client";

import {
  MapPin,
  Clock,
  FlaskConical,
  ListTree,
} from "lucide-react";

import { useLang } from "@/components/providers";
import type { Crop } from "@/types";

const CONDITIONS = [
  { key: "n", label: "N" },
  { key: "p", label: "P" },
  { key: "k", label: "K" },
  { key: "temperature", label: "Temp (°C)" },
  { key: "humidity", label: "Humidity (%)" },
  { key: "ph", label: "pH" },
  { key: "rainfall", label: "Rainfall (mm)" },
] as const;

export default function CropGuide({ crop }: { crop: Crop }) {
  const { lang } = useLang();
  const name = lang === "hi" && crop.nameHi ? crop.nameHi : crop.name;

  return (
    <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_280px]">
      {/* main */}
      <div className="min-w-0 space-y-6">
        {/* header card */}
        <header className="rounded-3xl border border-emerald-900/10 bg-white p-6 sm:p-8 dark:border-emerald-400/10 dark:bg-[#0d140c]">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-600/10 text-5xl dark:bg-emerald-400/10">
              {crop.emoji}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-300">
                {crop.family} · {crop.categoryName}
              </p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-emerald-950 sm:text-4xl dark:text-emerald-50">
                {name}
              </h1>
              <p className="mt-1 text-sm italic text-emerald-950/60 dark:text-emerald-100/60">
                {crop.scientificName}
              </p>
            </div>
          </div>

          <dl className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-emerald-900/10 bg-emerald-50/50 p-4 dark:border-emerald-400/10 dark:bg-emerald-500/5">
              <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-emerald-950/50 dark:text-emerald-100/50">
                <FlaskConical size={13} /> {lang === "hi" ? "कुल" : "Family"}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-emerald-950 dark:text-emerald-50">
                {crop.family}
              </dd>
            </div>
            <div className="rounded-2xl border border-emerald-900/10 bg-emerald-50/50 p-4 dark:border-emerald-400/10 dark:bg-emerald-500/5">
              <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-emerald-950/50 dark:text-emerald-100/50">
                <Clock size={13} /> {lang === "hi" ? "अवधि" : "Duration"}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-emerald-950 dark:text-emerald-50">
                {crop.duration}
              </dd>
            </div>
            <div className="rounded-2xl border border-emerald-900/10 bg-emerald-50/50 p-4 sm:col-span-1 dark:border-emerald-400/10 dark:bg-emerald-500/5">
              <dt className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-emerald-950/50 dark:text-emerald-100/50">
                <MapPin size={13} /> {lang === "hi" ? "प्रमुख राज्य" : "Major states"}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-emerald-950 dark:text-emerald-50">
                {crop.states.slice(0, 4).join(", ")}
              </dd>
            </div>
          </dl>

          {/* ideal conditions */}
          <div className="mt-5 rounded-2xl border border-emerald-900/10 p-4 dark:border-emerald-400/10">
            <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-950/60 dark:text-emerald-100/60">
              {lang === "hi" ? "आदर्श परिस्थितियाँ" : "Ideal conditions"}
            </h2>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {CONDITIONS.map((c) => {
                const r = crop.conditions[c.key];
                return (
                  <div
                    key={c.key}
                    className="rounded-lg bg-emerald-600/5 px-2 py-1.5 text-center dark:bg-emerald-400/5"
                  >
                    <p className="text-[10px] font-medium text-emerald-950/50 dark:text-emerald-100/50">
                      {c.label}
                    </p>
                    <p className="text-xs font-bold text-emerald-950 dark:text-emerald-50">
                      {Number.isInteger(r.min) && Number.isInteger(r.max)
                        ? `${r.min}–${r.max}`
                        : `${r.min}–${r.max}`}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </header>

        {/* 15 sections */}
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-emerald-950 dark:text-emerald-50">
            <ListTree size={20} className="text-emerald-600 dark:text-emerald-300" />
            {lang === "hi" ? "15 प्रमुख विवरण" : "15 key details"} · {name}
          </h2>
          <div className="mt-5 space-y-4">
            {crop.details.map((section, i) => (
              <article
                key={section.id}
                id={section.id}
                className="scroll-mt-24 rounded-3xl border border-emerald-900/10 bg-white p-6 sm:p-8 dark:border-emerald-400/10 dark:bg-[#0d140c]"
              >
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-green-700 text-xs font-bold text-white">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-lg font-bold text-emerald-950 dark:text-emerald-50">
                    {section.title}
                  </h3>
                </div>
                <div className="prose-agri mt-4 text-emerald-950 dark:text-emerald-50">
                  <p>{section.content}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>

      {/* sticky section nav */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 rounded-3xl border border-emerald-900/10 bg-white p-5 dark:border-emerald-400/10 dark:bg-[#0d140c]">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-950/60 dark:text-emerald-100/60">
            {lang === "hi" ? "15 प्रमुख विवरण" : "15 key details"}
          </p>
          <nav className="mt-3 space-y-1 border-l border-emerald-900/10 dark:border-emerald-400/10">
            {crop.details.map((s, i) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="flex items-center gap-2 border-l-2 border-transparent py-1 pl-3 text-[13px] leading-snug text-emerald-950/60 transition hover:border-emerald-600/40 hover:text-emerald-700 dark:text-emerald-100/60 dark:hover:text-emerald-200"
              >
                <span className="text-[10px] font-bold text-emerald-600/60">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s.title}
              </a>
            ))}
          </nav>
        </div>
      </aside>
    </div>
  );
}