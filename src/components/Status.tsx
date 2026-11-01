"use client";

import { SearchX, TriangleAlert } from "lucide-react";

import { useLang } from "@/components/providers";

export function EmptyState({ onReset }: { onReset?: () => void }) {
  const { t } = useLang();
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-emerald-900/15 bg-white px-6 py-16 text-center dark:border-emerald-400/15 dark:bg-[#0e150d]">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300">
        <SearchX size={26} />
      </span>
      <h3 className="mt-4 text-lg font-semibold text-emerald-950 dark:text-emerald-50">
        {t("empty_title")}
      </h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-emerald-950/60 dark:text-emerald-100/60">
        {t("empty_body")}
      </p>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="mt-5 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
        >
          {t("empty_action")}
        </button>
      )}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  const { t } = useLang();
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-red-300/40 bg-red-50 px-6 py-14 text-center dark:border-red-500/25 dark:bg-red-950/30">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-red-600 dark:text-red-400">
        <TriangleAlert size={26} />
      </span>
      <h3 className="mt-4 text-lg font-semibold text-red-700 dark:text-red-300">
        {t("error_title")}
      </h3>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-500"
      >
        {t("retry")}
      </button>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-emerald-900/10 bg-white p-5 dark:border-emerald-400/10 dark:bg-[#0e150d]">
      <div className="h-8 w-8 rounded-lg bg-emerald-600/10 dark:bg-emerald-400/10" />
      <div className="mt-4 h-4 w-3/4 rounded bg-emerald-600/10 dark:bg-emerald-400/10" />
      <div className="mt-3 h-3 w-full rounded bg-emerald-600/10 dark:bg-emerald-400/10" />
      <div className="mt-2 h-3 w-5/6 rounded bg-emerald-600/10 dark:bg-emerald-400/10" />
    </div>
  );
}