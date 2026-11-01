import type { Metadata } from "next";

import RecommendationForm from "@/components/RecommendationForm";

export const metadata: Metadata = {
  title: "Crop Recommendation System",
  description:
    "Enter soil NPK, temperature, humidity, pH, rainfall and location to get the 5-6 most suitable crops.",
};

export default function RecommendPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="mb-8">
        <span className="rounded-full bg-emerald-600/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
          RandomForest ML · REST API · local fallback
        </span>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-emerald-950 sm:text-4xl dark:text-emerald-50">
          Crop Recommendation System
        </h1>
        <p className="mt-3 max-w-2xl text-emerald-950/70 dark:text-emerald-100/70">
          Enter your field parameters and get the 5–6 crops most likely to thrive.
        </p>
      </div>
      <RecommendationForm />
    </div>
  );
}