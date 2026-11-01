/**
 * AgriMitra — build data/chatbot-index.json.
 * Chunks course content (course + section + link) for keyword fallback search
 * and quick answers in the chatbot widget.
 *
 * Courses with a structured guide (data/topics.json) are indexed from their
 * clean topics/sections; the remaining courses fall back to their markdown.
 *
 * Usage: node scripts/build-chatbot-index.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const COURSES_DIR = path.join(ROOT, "data", "courses");
const INDEX_FILE = path.join(ROOT, "data", "index.json");
const TOPICS_FILE = path.join(ROOT, "data", "topics.json");

const index = JSON.parse(fs.readFileSync(INDEX_FILE, "utf8"));

const structured = new Map();
if (fs.existsSync(TOPICS_FILE)) {
  for (const course of JSON.parse(fs.readFileSync(TOPICS_FILE, "utf8"))) {
    structured.set(course.slug, course);
  }
}

const chunks = [];

function pushChunk({ course, courseTitle, section, text, link, key }) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (clean.length < 80) return;
  chunks.push({
    id: `${course.slug}:${Buffer.from(key).toString("base64url").slice(0, 12)}`,
    course: courseTitle,
    courseSlug: course.slug,
    category: course.category,
    section: section || "Overview",
    text: clean.slice(0, 1100),
    link,
  });
}

for (const course of index) {
  const guide = structured.get(course.slug);
  if (guide) {
    const courseTitle = guide.title || course.title;
    for (const topic of guide.topics) {
      const body = topic.sections
        .flatMap((section) => [
          section.heading,
          section.text,
          ...(section.items ?? []),
          ...(section.rows ?? []).flat(),
        ])
        .filter(Boolean)
        .join(" ");
      pushChunk({
        course,
        courseTitle,
        section: topic.title,
        text: [topic.definition, body].filter(Boolean).join(" "),
        link: `/courses/${course.slug}#${topic.id}`,
        key: topic.id,
      });
    }
    continue;
  }

  const file = path.join(COURSES_DIR, `${course.slug}.md`);
  if (!fs.existsSync(file)) continue;
  const raw = fs.readFileSync(file, "utf8");
  const body = raw.replace(/^---[\s\S]*?---\s*/, "");

  const lines = body.split("\n");
  let section = "Overview";
  let buffer = [];

  const flush = () => {
    const text = buffer.join(" ").replace(/\s+/g, " ").trim();
    if (text.length > 120) {
      chunks.push({
        id: `${course.slug}:${Buffer.from(section).toString("base64url").slice(0, 12)}`,
        course: course.title,
        courseSlug: course.slug,
        category: course.category,
        section,
        text: text.slice(0, 1100),
        link: `/courses/${course.slug}#${slugify(section)}`,
      });
    }
    buffer = [];
  };

  for (const line of lines) {
    const h = line.match(/^#{2,4}\s+(.+)$/);
    if (h) {
      flush();
      section = h[1].replace(/^\d+(\.\d+)*\.?\s*/, "").trim() || "Overview";
    } else {
      buffer.push(line);
    }
  }
  flush();
}

fs.writeFileSync(path.join(ROOT, "data", "chatbot-index.json"), JSON.stringify(chunks, null, 1), "utf8");
console.log(
  `✓ data/chatbot-index.json — ${chunks.length} chunks (${structured.size} structured courses)`
);

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}
