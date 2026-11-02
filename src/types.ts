export type Lang = "en" | "hi";

export interface CourseSummary {
  slug: string;
  title: string;
  category: string;
  source: string;
  description: string;
  topics: string[];
  topicCount: number;
  words: number;
  bytes: number;
}

export interface CropConditions {
  n: { min: number; max: number };
  p: { min: number; max: number };
  k: { min: number; max: number };
  temperature: { min: number; max: number };
  humidity: { min: number; max: number };
  ph: { min: number; max: number };
  rainfall: { min: number; max: number };
}

export interface CropDetailSection {
  id: string;
  title: string;
  content: string;
}

export interface Crop {
  id: string;
  slug: string;
  name: string;
  nameHi: string;
  emoji: string;
  scientificName: string;
  family: string;
  category: string;
  categoryName: string;
  states: string[];
  duration: string;
  conditions: CropConditions;
  details: CropDetailSection[];
}

/* ------------------------------------------------- structured course topics */
export type TopicSectionType =
  | "text"
  | "list"
  | "number"
  | "formula"
  | "table"
  | "image";

export interface TopicSection {
  heading: string;
  type: TopicSectionType;
  text?: string;
  items?: string[];
  rows?: string[][];
  src?: string;
}

export interface TopicArticle {
  id: string;
  slug: string;
  title: string;
  category: string;
  definition: string;
  chapter: string;
  sections: TopicSection[];
  related: string[];
  source: string;
}

export interface CourseTopics {
  slug: string;
  title: string;
  category: string;
  description: string;
  source: string;
  topics: TopicArticle[];
}

export interface CropHit {
  id: string;
  slug: string;
  name: string;
  nameHi: string;
  emoji: string;
  categoryName: string;
  confidence: number;
  rawProbability?: number | null;
  scores: Record<string, number>;
}

export interface RecommendInput {
  n: number;
  p: number;
  k: number;
  temperature: number;
  humidity: number;
  ph: number;
  rainfall: number;
  location: string;
  language: Lang;
}

export interface RecommendResponse {
  recommendations: CropHit[];
  modelVersion: string;
  generatedAt: string;
  coverage?: number | null;
  warnings: string[];
}

export interface ChatSource {
  course: string;
  courseSlug: string;
  section: string;
  link: string;
  snippet: string;
}

export interface ChatResponse {
  session_id: string;
  reply: string;
  sources: ChatSource[];
  fallback: boolean;
  grounded: boolean;
}

export interface ChatbotChunk {
  id: string;
  course: string;
  courseSlug: string;
  category: string;
  section: string;
  text: string;
  link: string;
}

export interface APIError {
  error?: string;
  message?: string;
  status?: number;
}