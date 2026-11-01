import type { ChatbotChunk, CourseSummary, Lang } from "@/types";

/** Slugify (server & client safe). */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/—|–/g, "-")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** Format an id/header for in-page anchors. */
export function anchor(text: string): string {
  return slugify(text);
}

/** Number formatting with locale. */
export function fmt(n: number, lang: Lang = "en"): string {
  return n.toLocaleString(lang === "hi" ? "en-IN" : "en-US");
}

export function clampToRange(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function fitInRange(value: number, r: { min: number; max: number }): boolean {
  return value >= r.min && value <= r.max;
}

/** Client-side lazy loader for the chatbot search index. */
export async function loadChatbotIndex(): Promise<ChatbotChunk[]> {
  const res = await fetch("/data/chatbot-index.json");
  if (!res.ok) return [];
  return (await res.json()) as ChatbotChunk[];
}

export function totalWords(courses: CourseSummary[]): number {
  return courses.reduce((sum, c) => sum + c.words, 0);
}

export function categoryCounts(courses: CourseSummary[]): Record<string, number> {
  return courses.reduce<Record<string, number>>((acc, c) => {
    acc[c.category] = (acc[c.category] || 0) + 1;
    return acc;
  }, {});
}