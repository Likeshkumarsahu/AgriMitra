import type { Crop, RecommendResponse, RecommendInput } from "@/types";

/** Fetch with an AbortController timeout → predictable error envelope. */
export async function fetchWithTimeout<T>(
  url: string,
  options: RequestInit = {},
  timeoutMs = 12000
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    throw payloadError(err, true);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body?.message || body?.detail || message;
    } catch {
      /* keep generic message */
    }
    throw payloadError(new Error(message), false, res.status);
  }
  return (await res.json()) as T;
}

function payloadError(err: unknown, isTimeoutLike: boolean, status = 0) {
  const e = err as Error;
  const message = e.name === "AbortError" ? "Request timed out. Please try again." : e.message;
  return Object.assign(new Error(message), { status, timedOut: isTimeoutLike && e.name === "AbortError" });
}

/** Tiny client-side rule-based recommender mirroring the backend contract.
 *  Used as an offline fallback so the demo still works without FastAPI. */
export async function localRecommend(inputs: RecommendInput): Promise<RecommendResponse> {
  const crops: Crop[] = await (await fetch("/data/crops.json")).json();
  const keys = ["n", "p", "k", "temperature", "humidity", "ph", "rainfall"] as const;
  const weights: Record<(typeof keys)[number], number> = {
    n: 0.15,
    p: 0.1,
    k: 0.1,
    temperature: 0.2,
    humidity: 0.15,
    ph: 0.1,
    rainfall: 0.2,
  };
  const ranked = crops
    .map((crop) => {
      const scores: Record<string, number> = {};
      for (const key of keys) {
        const r = crop.conditions[key];
        const value = inputs[key];
        const span = Math.max(r.max - r.min, 1e-6);
        scores[key] =
          value >= r.min && value <= r.max
            ? 100
            : Math.max(0, 100 - ((value < r.min ? r.min - value : value - r.max) / (span * 2)) * 100);
      }
      const confidence = keys.reduce((acc, key) => acc + weights[key] * scores[key], 0);
      const loc = inputs.location.toLowerCase();
      const regionBonus =
        loc && crop.states.some((s: string) => s.toLowerCase().includes(loc) || loc.includes(s.toLowerCase()))
          ? 8
          : 0;
      return {
        crop,
        confidence: Math.min(100, confidence + regionBonus),
        scores,
      };
    })
    .sort((a, b) => b.confidence - a.confidence);

  return {
    recommendations: ranked.slice(0, 6).map(({ crop, confidence, scores }) => ({
      id: crop.id,
      slug: crop.slug,
      name: crop.name,
      nameHi: crop.nameHi,
      emoji: crop.emoji,
      categoryName: crop.categoryName,
      confidence: Math.round(confidence * 10) / 10,
      scores: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, Math.round((v as number) * 10) / 10])),
    })),
    modelVersion: "local-rule-based-v1",
    generatedAt: new Date().toISOString(),
    coverage: null,
    warnings: ["Backend offline — results from the in-browser recommendation engine."],
  };
}