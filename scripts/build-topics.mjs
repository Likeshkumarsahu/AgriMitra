#!/usr/bin/env node
/**
 * AgriMitra — build data/topics.json
 *
 * The PDF→topic exports in data/ use several different schemas:
 *   • flat article lists            (structured_topics.json, Crop-Production-Technology-.json, ...)
 *   • nested { title, chapters, topics: [...] }  (*_topic_level_short_points.json, ...)
 *
 * This script normalises all of them into one shape the course reader can render:
 *
 *   [{ slug, title, category, description, source,
 *      topics: [{ id, slug, title, category, definition, chapter?, sections:[...], related, source }] }]
 *
 * It also de-duplicates sources: when a course has both a dedicated export and a
 * slice of structured_topics.json, the richer dedicated export wins.
 *
 * Usage: node scripts/build-topics.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const DATA = path.join(ROOT, "data");
const OUT = path.join(DATA, "topics.json");

const SKIP = new Set(["crops.json", "index.json", "chatbot-index.json", "topics.json"]);

const index = JSON.parse(fs.readFileSync(path.join(DATA, "index.json"), "utf8"));
const indexBySlug = new Map(index.map((c) => [c.slug, c]));

/* ------------------------------------------------------------------ text utils */
function cleanText(value) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function normaliseKey(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function prettyFromSlug(slug) {
  return cleanText(slug)
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function cleanItem(value) {
  if (typeof value === "string") return cleanText(value);
  if (value == null) return "";
  if (typeof value === "object") {
    return cleanText(
      value.text ?? value.title ?? value.name ?? value.content ?? JSON.stringify(value)
    );
  }
  return cleanText(value);
}

function stringifySource(value) {
  if (typeof value === "string") return cleanText(value);
  if (value && typeof value === "object") {
    const file = cleanText(value.file ?? value.filename ?? value.name ?? "");
    const pages = cleanText(value.pages ?? value.page ?? "");
    const chapter = cleanText(value.chapter ?? "");
    if (file && pages) return `${file}, p.${pages}`;
    if (file) return file;
    if (chapter && pages) return `Chapter ${chapter}, p.${pages}`;
    if (chapter) return `Chapter ${chapter}`;
  }
  return "";
}

/* ------------------------------------------------------- source → course slug */
const sourceToSlug = new Map();
for (const course of index) {
  const base = path.basename(course.source || "").replace(/\.pdf$/i, "");
  sourceToSlug.set(normaliseKey(base), course.slug);
  sourceToSlug.set(normaliseKey(course.slug), course.slug);
}

function matchSlug(raw) {
  const key = normaliseKey(String(raw || "").split(",")[0]);
  if (!key) return null;
  if (sourceToSlug.has(key)) return sourceToSlug.get(key);
  for (const [candidate, slug] of sourceToSlug) {
    if (key.startsWith(candidate) || candidate.startsWith(key)) return slug;
  }
  return null;
}

function fileStemSlug(file) {
  let stem = path.basename(file).replace(/\.json$/i, "");
  stem = stem
    .replace(/_(topic_level_short_points|topic_level_detailed|detailed_topic_level)$/i, "")
    .replace(/-topic-level.*$/i, "");
  return matchSlug(stem);
}

/* ------------------------------------------------------------- section clean-up */
function normaliseSection(raw) {
  if (!raw || typeof raw !== "object") return null;

  const heading = cleanText(raw.heading);
  const rawType = cleanText(raw.type).toLowerCase();

  let text = "";
  let items = [];
  let rows = [];
  let src = "";

  if (Array.isArray(raw.content)) {
    items = raw.content.map(cleanItem).filter(Boolean);
  } else if (typeof raw.content === "string") {
    text = cleanText(raw.content);
  } else if (raw.content && typeof raw.content === "object") {
    text = cleanText(raw.content.text ?? raw.content.content ?? JSON.stringify(raw.content));
  }

  if (Array.isArray(raw.items)) {
    items = [...items, ...raw.items.map(cleanItem).filter(Boolean)];
  }

  if (Array.isArray(raw.rows)) {
    rows = raw.rows
      .map((row) => (Array.isArray(row) ? row.map(cleanText) : [cleanText(row)]))
      .filter((row) => row.some(Boolean));
  }

  let type = "text";
  if (rows.length || rawType === "table") type = "table";
  else if (rawType === "formula") type = "formula";
  else if (rawType === "number") type = "number";
  else if (rawType === "image") type = "image";
  else if (["list", "points"].includes(rawType) || rawType.includes("short point")) type = "list";
  else if (items.length) type = "list";

  if (type === "image") {
    src = cleanText(raw.src ?? raw.url ?? (typeof raw.content === "string" ? raw.content : ""));
    if (!src) return null;
  }
  if (type === "table" && !rows.length) return null;
  if (type === "text" && !text) return null;
  if ((type === "list" || type === "number" || type === "formula") && !items.length && !text) {
    return null;
  }
  if ((type === "list" || type === "number" || type === "formula") && !items.length && text) {
    items = [text];
    text = "";
  }

  return {
    heading,
    type,
    ...(text ? { text } : {}),
    ...(items.length ? { items } : {}),
    ...(rows.length ? { rows } : {}),
    ...(src ? { src } : {}),
  };
}

function chapterFromTopic(raw) {
  const direct = cleanText(raw.chapter ?? "");
  if (direct) return /^chapter\s/i.test(direct) ? direct : `Chapter ${direct}`;
  const match = cleanText(raw._topic ?? "").match(/chapter\s+(\d+)/i);
  return match ? `Chapter ${match[1]}` : "";
}

function normaliseTopic(raw, usedIds) {
  const title = cleanText(raw.title) || "Untitled topic";
  const baseId = slugify(raw.slug || title) || "topic";
  let id = baseId;
  let suffix = 2;
  while (usedIds.has(id)) id = `${baseId}-${suffix++}`;
  usedIds.add(id);

  const sections = (Array.isArray(raw.sections) ? raw.sections : [])
    .map(normaliseSection)
    .filter(Boolean);

  let definition = cleanText(raw.definition);
  if (!definition) {
    const first = sections.find((section) => section.text) ?? sections[0];
    definition = first ? cleanText(first.text ?? first.items?.[0] ?? "") : "";
  }

  return {
    id,
    slug: id,
    title,
    category: cleanText(raw.category),
    definition: definition.slice(0, 420),
    chapter: chapterFromTopic(raw),
    sections,
    related: Array.isArray(raw.related) ? raw.related.map(cleanText).filter(Boolean) : [],
    source: stringifySource(raw.source),
  };
}

/* ------------------------------------------------------------ course metadata */
const TITLE_OVERRIDES = {
  "a-competitive-book-of-agriculture-pdf-by-nemi-raj-sunda":
    "A Competitive Book of Agriculture",
  "livestock-poultry-management": "Livestock & Poultry Management",
  "soil-and-water-conservation-engineering-1": "Soil and Water Conservation Engineering",
};

const DESCRIPTION_OVERRIDES = {
  "a-competitive-book-of-agriculture-pdf-by-nemi-raj-sunda":
    "A 566-topic competitive-exam reference spanning agronomy, soils, plant protection, animal husbandry and agricultural economics.",
};

function cleanCourseTitle(rawTitle, slug) {
  if (TITLE_OVERRIDES[slug]) return TITLE_OVERRIDES[slug];

  let title = cleanText(rawTitle);
  if (title) {
    title = title
      .replace(/\s*[—–-]\s*Topic[- ]Level.*$/i, "")
      .replace(/\s*[—–-]\s*Detailed Knowledge Base.*$/i, "")
      .replace(/\s*[—–-]\s*Short[- ]Points.*$/i, "")
      .replace(/\s*:\s*/g, ": ")
      .trim();
    if (title.length > 2) return title;
  }

  const indexed = cleanText(indexBySlug.get(slug)?.title ?? "");
  const looksRaw =
    !indexed ||
    /\.pdf|__|--|^[^a-z]*$/.test(indexed) ||
    (indexed.match(/-/g) || []).length > 3 ||
    indexed.length > 90;
  if (indexed && !looksRaw) return indexed;

  return prettyFromSlug(slug);
}

function buildDescription(description, topics) {
  const explicit = cleanText(description);
  const looksLikeExtractionNote =
    /topic[- ]level|json extraction|knowledge base|extracted from|short bullet|source terminology|grouped into conceptual/i.test(
      explicit
    );
  if (explicit.length > 20 && !looksLikeExtractionNote) return explicit.slice(0, 280);

  const titles = topics.slice(0, 3).map((topic) => topic.title).filter(Boolean);
  if (!titles.length) return "";
  const suffix = topics.length > titles.length ? " and more" : "";
  return `${topics.length} topics covering ${titles.join(", ")}${suffix}.`;
}

/* --------------------------------------------------------------- collect sources */
const candidates = [];

for (const file of fs.readdirSync(DATA).filter((f) => f.endsWith(".json") && !SKIP.has(f))) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(path.join(DATA, file), "utf8"));
  } catch (err) {
    console.warn(`  ! skipped ${file}: ${err.message}`);
    continue;
  }

  if (Array.isArray(data)) {
    if (file === "structured_topics.json") {
      // A merged export: split it back into one candidate per source PDF.
      const groups = new Map();
      for (const topic of data) {
        const slug = matchSlug(topic.source);
        if (!slug) continue;
        if (!groups.has(slug)) groups.set(slug, []);
        groups.get(slug).push(topic);
      }
      for (const [slug, topics] of groups) {
        candidates.push({ kind: "structured", slug, topics, title: "", description: "", file });
      }
    } else {
      const slug = fileStemSlug(file) ?? matchSlug(data[0]?.source);
      if (slug) {
        candidates.push({ kind: "flat", slug, topics: data, title: "", description: "", file });
      }
    }
    continue;
  }

  const topics = Array.isArray(data.topics)
    ? data.topics
    : data.topics && typeof data.topics === "object"
      ? Object.values(data.topics)
      : [];
  const slug = matchSlug(data.source_file) ?? fileStemSlug(file);
  if (slug) {
    candidates.push({
      kind: "nested",
      slug,
      topics,
      title: data.title ?? "",
      description: data.description ?? "",
      file,
    });
  }
}

/* ------------------------------------------------------ choose one per course */
function richness(candidate) {
  const chars = candidate.topics.reduce((total, topic) => {
    const sections = Array.isArray(topic.sections) ? topic.sections : [];
    return (
      total +
      cleanText(topic.definition).length +
      sections.reduce((sum, section) => sum + JSON.stringify(section).length, 0)
    );
  }, 0);
  // Prefer a dedicated export over a slice of the merged structured_topics file.
  return candidate.kind === "structured" ? chars * 0.55 : chars;
}

const chosen = new Map();
for (const candidate of candidates) {
  const current = chosen.get(candidate.slug);
  if (!current || richness(candidate) > richness(current)) chosen.set(candidate.slug, candidate);
}

/* ------------------------------------------------------------------- build output */
const courses = [];
const report = [];

for (const course of index) {
  const source = chosen.get(course.slug);
  if (!source || !source.topics.length) continue;

  const usedIds = new Set();
  const topics = source.topics
    .map((topic) => normaliseTopic(topic, usedIds))
    .filter((topic) => topic.sections.length > 0 || topic.definition);

  if (!topics.length) continue;

  courses.push({
    slug: course.slug,
    title: cleanCourseTitle(source.title, course.slug),
    category: course.category,
    description:
      DESCRIPTION_OVERRIDES[course.slug] ?? buildDescription(source.description, topics),
    source: course.source,
    topics,
  });

  report.push({
    slug: course.slug,
    from: source.file,
    kind: source.kind,
    topics: topics.length,
    sections: topics.reduce((sum, topic) => sum + topic.sections.length, 0),
  });
}

fs.writeFileSync(OUT, JSON.stringify(courses, null, 2), "utf8");

const totalTopics = courses.reduce((sum, course) => sum + course.topics.length, 0);
console.log(`✓ data/topics.json — ${courses.length} courses · ${totalTopics} topics`);
for (const row of report) {
  console.log(
    `   ${String(row.topics).padStart(4)} topics  ${String(row.sections).padStart(5)} sections  ${row.slug}  ← ${row.from}`
  );
}

const unused = [...chosen.keys()].filter((slug) => !courses.some((course) => course.slug === slug));
if (unused.length) {
  console.log(`\n   (${unused.length} source groups not used: ${unused.join(", ")})`);
}
