"use client";

import { BarChart3, Loader2, RotateCcw, Sprout, Wand2 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";

import { ErrorState, SkeletonCard } from "@/components/Status";
import { useLang } from "@/components/providers";
import { fetchWithTimeout, localRecommend } from "@/lib/api";
import type { CropHit, Lang, RecommendInput, RecommendResponse } from "@/types";

const INITIAL = {
  n: 90,
  p: 50,
  k: 50,
  temperature: 27,
  humidity: 75,
  ph: 6.5,
  rainfall: 1200,
  location: "Punjab",
};

const BATCHES = [
  { label: "🌾 Punjab (Rice Belt)", values: INITIAL },
  { label: "🥜 Maharashtra (Pulses)", values: { n: 60, p: 45, k: 35, temperature: 30, humidity: 55, ph: 6.8, rainfall: 700, location: "Maharashtra" } },
  { label: "🌿 Bihar (Veg & Monsoon)", values: { n: 80, p: 60, k: 55, temperature: 26, humidity: 85, ph: 6.2, rainfall: 1500, location: "Bihar" } },
  { label: "☕ Karnataka (Rains)", values: { n: 75, p: 40, k: 45, temperature: 24, humidity: 90, ph: 5.8, rainfall: 2200, location: "Karnataka" } },
];

const RANGE: Record<FieldKey, [number, number]> = {
  n: [0, 300],
  p: [0, 300],
  k: [0, 300],
  temperature: [0, 50],
  humidity: [0, 100],
  ph: [0, 14],
  rainfall: [0, 3000],
};
const STEP: Record<FieldKey, number> = { n: 1, p: 1, k: 1, temperature: 0.5, humidity: 1, ph: 0.1, rainfall: 25 };

type FieldKey = "n" | "p" | "k" | "temperature" | "humidity" | "ph" | "rainfall";
type FormValues = Record<FieldKey, number> & { location: string };

export default function RecommendationForm() {
  const { lang, t } = useLang();
  const [values, setValues] = useState<FormValues>(INITIAL);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [result, setResult] = useState<RecommendResponse | null>(null);

  const coverage = result?.coverage ?? null;
  const warnings = result?.warnings ?? [];
  // The API already emits a coverage warning, but keep a UI fallback so a stale
  // or cached response can never hide low coverage from the user.
  const showCoverageWarning =
    coverage != null &&
    coverage < 50 &&
    !warnings.some((w) => /coverage|probability mass/i.test(w));

  const fields = useMemo<{ key: FieldKey; placeholder: string }[]>(
    () => [
      { key: "n", placeholder: t("placeholder_n") },
      { key: "p", placeholder: t("placeholder_p") },
      { key: "k", placeholder: t("placeholder_k") },
      { key: "temperature", placeholder: t("placeholder_temp") },
      { key: "humidity", placeholder: t("placeholder_hum") },
      { key: "ph", placeholder: t("placeholder_ph") },
      { key: "rainfall", placeholder: t("placeholder_rain") },
    ],
    [t]
  );

  const valid = useMemo(
    () =>
      fields.every(
        (f) =>
          !Number.isNaN(Number(values[f.key])) &&
          Number(values[f.key]) >= RANGE[f.key][0] &&
          Number(values[f.key]) <= RANGE[f.key][1]
      ) && String(values.location ?? "").trim().length > 0,
    [values, fields]
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid || loading) return;
    setLoading(true);
    setFailed(false);
    setResult(null);

    const payload: RecommendInput = { ...values, language: lang };

    try {
      const res = await fetchWithTimeout<RecommendResponse>(
        "/api/recommend",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
        20000
      );
      setResult(res);
    } catch {
      // Fallback to in-browser rule engine when backend is unreachable.
      setFailed(true);
      try {
        setResult(await localRecommend(payload));
      } catch {
        setResult(null);
        setFailed(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[380px_1fr]">
      {/* ============================== FORM ============================== */}
      <form
        onSubmit={submit}
        className="h-fit space-y-4 rounded-3xl border border-emerald-900/10 bg-white p-6 lg:sticky lg:top-24 dark:border-emerald-400/10 dark:bg-[#0d140c]"
      >
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300">
            <BarChart3 size={18} />
          </span>
          <h2 className="font-semibold text-emerald-950 dark:text-emerald-50">
            {t("recommend_sub")}
          </h2>
        </div>

        {fields.map((f) => (
          <label key={f.key} className="block">
            <span className="mb-1 block text-xs font-medium text-emerald-950/60 dark:text-emerald-100/60">
              {f.placeholder}
            </span>
            <input
              type="number"
              min={RANGE[f.key][0]}
              max={RANGE[f.key][1]}
              step={STEP[f.key]}
              value={values[f.key]}
              onChange={(e) =>
                setValues((v) => ({ ...v, [f.key]: Number(e.target.value) }))
              }
              className="w-full rounded-xl border border-emerald-900/15 bg-emerald-50/40 px-3 py-2.5 text-sm text-emerald-950 focus:border-emerald-600/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-emerald-400/15 dark:bg-emerald-500/5 dark:text-emerald-50"
            />
          </label>
        ))}

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-emerald-950/60 dark:text-emerald-100/60">
            {t("placeholder_location")}
          </span>
          <input
            type="text"
            value={values.location}
            onChange={(e) => setValues((v) => ({ ...v, location: e.target.value }))}
            className="w-full rounded-xl border border-emerald-900/15 bg-emerald-50/40 px-3 py-2.5 text-sm text-emerald-950 focus:border-emerald-600/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 dark:border-emerald-400/15 dark:bg-emerald-500/5 dark:text-emerald-50"
          />
        </label>

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={!valid || loading}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
            {t("submit_recommend")}
          </button>
          <button
            type="button"
            onClick={() => { setValues(INITIAL); setResult(null); setFailed(false); }}
            className="inline-flex items-center justify-center rounded-xl border border-emerald-900/15 px-3 text-emerald-950/60 transition hover:border-emerald-600/40 hover:text-emerald-700 dark:border-emerald-400/15 dark:text-emerald-100/60 dark:hover:text-emerald-300"
            title={t("reset_form")}
          >
            <RotateCcw size={17} />
          </button>
        </div>

        <div className="space-y-2 pt-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-950/50 dark:text-emerald-100/50">
            {lang === "hi" ? "त्वरित पूर्व-निर्धारित" : "Quick presets"}
          </p>
          <div className="flex flex-wrap gap-2">
            {BATCHES.map((b) => (
              <button
                key={b.label}
                type="button"
                onClick={() => setValues((v) => ({ ...v, ...b.values }))}
                className="rounded-full border border-emerald-900/15 px-3 py-1.5 text-[11px] font-medium text-emerald-950/70 transition hover:border-emerald-600/40 hover:bg-emerald-50 hover:text-emerald-700 dark:border-emerald-400/15 dark:text-emerald-100/70 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300"
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          {t("recommend_note")}
        </p>
      </form>

      {/* ============================== RESULTS ============================== */}
      <section>
        {loading && (
          <>
            <h2 className="mb-4 text-lg font-semibold text-emerald-950 dark:text-emerald-50">
              {t("results_title")}
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          </>
        )}

        {failed && !loading && !result && (
          <ErrorState onRetry={() => submit} />
        )}

        {!loading && result && (
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-emerald-950 dark:text-emerald-50">
                {t("crop_header_add")} · {result.recommendations.length}{" "}
                {t("results_title").toLowerCase()}
              </h2>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-900/15 px-3 py-1 text-[11px] text-emerald-950/60 dark:border-emerald-400/15 dark:text-emerald-100/60">
                <Sprout size={12} className="text-emerald-600" />
                {t("model_version")}: {result.modelVersion}
                {result.coverage != null && ` · coverage ${result.coverage.toFixed(1)}%`}
              </span>
            </div>

            {warnings.map((w, i) => (
              <p
                key={i}
                className="mt-3 rounded-xl border border-amber-600/30 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
              >
                ⚠ {w}
              </p>
            ))}

            {showCoverageWarning && coverage != null && (
              <p className="mt-3 rounded-xl border border-amber-600/30 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                ⚠{" "}
                {lang === "hi"
                  ? `मॉडल की केवल ${coverage.toFixed(1)}% संभावना उन फसलों पर है जिनकी पूरी गाइड उपलब्ध है — इन सुझावों को केवल सलाह मानें, निश्चितता नहीं।`
                  : `Only ${coverage.toFixed(1)}% of the model's probability mass maps to crops with a full guide — treat these picks as suggestions, not certainty.`}
              </p>
            )}

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {result.recommendations.map((hit, i) => (
                <CropResultCard key={hit.slug} hit={hit} rank={i + 1} lang={lang} />
              ))}
            </div>
          </div>
        )}

        {!loading && !failed && !result && (
          <div className="flex h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-emerald-900/15 bg-white px-6 text-center dark:border-emerald-400/15 dark:bg-[#0d140c]">
            <span className="text-4xl">🧑‍🌾</span>
            <p className="mt-3 text-sm text-emerald-950/60 dark:text-emerald-100/60">
              {lang === "hi"
                ? "अपने खेत के मान दर्ज करें और 5–6 सर्वोत्तम फसलों की सूची देखें।"
                : "Enter your field parameters above to see the top 5–6 recommended crops."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function CropResultCard({ hit, rank, lang }: { hit: CropHit; rank: number; lang: Lang }) {
  const scoreKeys: [string, string][] = [
    ["n", "N"],
    ["p", "P"],
    ["k", "K"],
    ["temperature", "Temp"],
    ["humidity", "Hum"],
    ["ph", "pH"],
    ["rainfall", "Rain"],
  ];
  const color =
    rank === 1
      ? "from-emerald-600 to-lime-600"
      : rank === 2
        ? "from-emerald-500 to-green-600"
        : rank <= 3
          ? "from-lime-500 to-emerald-600"
          : "from-green-500 to-emerald-600";

  return (
    <div className="flex flex-col rounded-3xl border border-emerald-900/10 bg-white p-5 transition hover:shadow-lg dark:border-emerald-400/10 dark:bg-[#0d140c]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-600/10 text-4xl dark:bg-emerald-400/10">
            {hit.emoji}
          </span>
          <div>
            <p className="font-bold text-emerald-950 dark:text-emerald-50">
              {lang === "hi" ? hit.nameHi : hit.name}
            </p>
            <p className="text-xs text-emerald-950/50 dark:text-emerald-100/50">
              {hit.categoryName}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-300">
            {hit.confidence.toFixed(1)}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-emerald-950/50 dark:text-emerald-100/50">
            {lang === "hi" ? "विश्वसनीयता" : "confidence"}
          </p>
          {hit.rawProbability != null && (
            <p className="text-[10px] text-emerald-950/40 dark:text-emerald-100/40">
              raw p={hit.rawProbability.toFixed(3)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-600/10 dark:bg-emerald-400/10">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color}`}
          style={{ width: `${hit.confidence}%` }}
        />
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {scoreKeys.map(([key, label]) => (
          <div
            key={key}
            className="rounded-lg border border-emerald-900/10 px-2 py-1.5 text-center dark:border-emerald-400/10"
            title={key}
          >
            <p className="text-[10px] font-medium text-emerald-950/50 dark:text-emerald-100/50">
              {label}
            </p>
            <p className="text-sm font-bold text-emerald-950 dark:text-emerald-50">
              {hit.scores[key]?.toFixed(0) ?? "--"}
            </p>
          </div>
        ))}
      </div>

      <a
        href={`/crop/${hit.slug}`}
        className="mt-4 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600/10 px-4 py-2.5 text-center text-sm font-semibold text-emerald-700 transition hover:bg-emerald-600 hover:text-white dark:bg-emerald-400/10 dark:text-emerald-300 dark:hover:bg-emerald-500 dark:hover:text-white"
      >
        {lang === "hi" ? "15-बिंदु गाइड देखें →" : "View 15-point guide →"}
      </a>
    </div>
  );
}