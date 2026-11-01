#!/usr/bin/env node
/**
 * AgriMitra data pipeline — Step 1
 * Reads every PDF in agri-data/ with pdftotext, converts it into cleaned
 * Markdown, and emits data/courses/*.md + data/index.json (course catalogue).
 *
 * Usage: node scripts/extract.mjs
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC_DIR = path.join(ROOT, "agri-data");
const OUT_DIR = path.join(ROOT, "data");
const COURSES_DIR = path.join(OUT_DIR, "courses");

if (!fs.existsSync(SRC_DIR)) {
  console.error("✗ agri-data/ not found — cannot extract.");
  process.exit(1);
}
fs.mkdirSync(COURSES_DIR, { recursive: true });

/** Map source filenames to site categories (GeeksforGeeks style taxonomy). */
const CATEGORY_RULES = [
  { cat: "Foundations", tests: [/level\s*0/i, /agri-?informatics/i] },
  { cat: "Climate & Weather", tests: [/climate/i, /agrometeorology/i] },
  { cat: "Soil Science", tests: [/soil/i, /problematic/i] },
  {
    cat: "Crop Production",
    tests: [/know your crop/i, /crop growth/i, /crop-production/i, /plant-breeding/i, /plant-pathology/i],
  },
  { cat: "Farm Planning", tests: [/land selection/i, /farm planning/i, /farming system/i] },
  { cat: "Seed Technology", tests: [/seed/i] },
  { cat: "Field Operations", tests: [/land preparation/i, /sowing/i] },
  {
    cat: "Water & Irrigation",
    tests: [/water/i, /irrigation/i, /conservation engineering/i],
  },
  { cat: "Plant Nutrition", tests: [/nutrition/i, /fertilizer/i, /manure/i] },
  { cat: "Plant Protection", tests: [/weed/i, /pest/i, /disease/i, /health diagnosis/i, /pathology/i] },
  { cat: "Horticulture", tests: [/fruit/i, /pp_veg/i, /vegetable/i, /protected/i, /horticultural/i] },
  { cat: "Animal Husbandry", tests: [/livestock/i, /poultry/i] },
  { cat: "Agribusiness", tests: [/finance/i, /co-operation/i] },
  { cat: "Sustainable Agriculture", tests: [/renewable/i, /green-technology/i] },
  { cat: "Reference Books", tests: [/competitive/i, /pop2016/i, /^package/i] },
];

function pickCategory(filename) {
  for (const { cat, tests } of CATEGORY_RULES) {
    if (tests.some((t) => t.test(filename))) return cat;
  }
  return "General Agriculture";
}

function toSlug(filename) {
  return filename
    .replace(/\.pdf$/i, "")
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, " ")
    .replace(/[_.\s]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function toTitle(filename) {
  const base = filename.replace(/\.pdf$/i, "").replace(/\s+/g, " ").trim();
  const renamed = {
    pp_veg: "Package of Practices · Cultivation of Vegetables",
    pop2016: "Population of India 2016",
    "Crop-Production-Technology-": "Crop Production Technology",
    "A-Competitive-Book-of-Agriculture-PDF--by-Nemi-Raj-Sunda": "A Competitive Book of Agriculture",
    "Level 0 · Understanding Agriculture": "Level 0 · Understanding Agriculture",
  };
  if (renamed[base]) return renamed[base];
  return base.replace(/—/g, "·");
}

/** Extract raw text for one PDF. */
function pdftotext(file) {
  try {
    return execFileSync("pdftotext", [file, "-"], { encoding: "utf8", maxBuffer: 1024 * 1024 * 256 });
  } catch (err) {
    console.warn(`  ! pdftotext failed for ${path.basename(file)}: ${err.message}`);
    return "";
  }
}

/**
 * Turn linearised pdftotext output into readable Markdown.
 * Detects numbered section headings, sub-headings, bullets and tables-ish lines.
 */
function toMarkdown(raw) {
  const lines = raw.replace(/\f/g, "\n").split(/\r?\n/);
  const out = [];
  let prevWasContent = false;

  for (let rawLine of lines) {
    let line = rawLine.replace(/\t/g, " ").replace(/ +/g, " ").trim();
    if (!line) {
      if (prevWasContent) out.push("");
      prevWasContent = false;
      continue;
    }

    // page numbers / artefacts
    if (/^\d{1,4}$/.test(line)) continue;
    if (/^(page|chapter)?\s*\d{1,4}\s*(of\s*\d{1,4})?$/i.test(line)) continue;
    if (/^agrimoon\.com$/i.test(line)) continue;
    if (/^\s*([·•▪◦-]\s*){3,}$/.test(line)) continue;

    // numbered top-level heading:  1. Introduction  /  1.1 What is a fertilizer?
    const numMatch = line.match(/^(\d+(?:\.\d+)*\.?)\s+([A-Z][A-Za-z0-9&()\/%'":*+,#.-]{2,75})$/);
    if (numMatch && /[a-z]/.test(numMatch[2]) && !/\d\.\d/.test(numMatch[2].trim())) {
      const depth = numMatch[1].split(".").filter(Boolean).length;
      const heading = numMatch[2].replace(/\s+/g, " ").trim();
      out.push(`${depth <= 1 ? "##" : "###"} ${numMatch[1]} ${heading}`);
      prevWasContent = false;
      continue;
    }

    // ALL-CAPS standalone heading (short)
    if (
      line.length <= 70 &&
      line === line.toUpperCase() &&
      /[A-Z]{4}/.test(line) &&
      !/^\d+$/.test(line) &&
      !line.endsWith(".")
    ) {
      const t = titleCase(line);
      out.push(`## ${t}`);
      prevWasContent = false;
      continue;
    }

    // bullets from pdftotext (•, -, o)
    const bulletMatch = line.match(/^([•▪◦o]|-\s)\s*(.+)$/);
    if (bulletMatch && bulletMatch[2] && bulletMatch[2].length < 200) {
      out.push(`- ${bulletMatch[2].trim()}`);
      prevWasContent = true;
      continue;
    }

    out.push(line);
    prevWasContent = true;
  }

  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/^#{2,6} .*?(?=\n\n)/gm, (m) => m.trim())
    .trim();
}

function titleCase(s) {
  return s
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase())
    .replace(/^(Module|Chapter|Level)\b/, (m) => m);
}

/** Remove TeX/LaTeX residue left by pdftotext. */
function cleanLatex(text) {
  return text
    .replace(/\\\w+\{[^}]*\}/g, " ")
    .replace(/\\[a-zA-Z]+\s*/g, " ")
    .replace(/[{}]/g, " ")
    .replace(/[\$\^~`_]+/g, " ")
    .replace(/^-\s*-+\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function firstParagraph(md) {
  const text = md
    .replace(/^#{1,6}.*$/gm, " ")
    .replace(/^[-*>|].*$/gm, " ")
    .replace(/\*\*/g, "")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 240).trim();
}

function listTopics(md) {
  const topics = [];
  for (const m of md.matchAll(/^##\s+(.+)$/gm)) {
    const t = m[1].replace(/\s+/g, " ").trim();
    if (t && t.length < 90 && !topics.includes(t)) topics.push(t);
  }
  return topics;
}

function countWords(md) {
  return md.replace(/[#*`>|-]/g, " ").trim().split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------- main run
const files = fs
  .readdirSync(SRC_DIR)
  .filter((f) => f.toLowerCase().endsWith(".pdf"))
  .sort();

console.log(`Found ${files.length} PDFs in agri-data/\n`);

const index = [];
for (const file of files) {
  const full = path.join(SRC_DIR, file);
  const slug = toSlug(file);
  const title = toTitle(file);
  const category = pickCategory(file);
  process.stdout.write(`→ ${file} ... `);

  const raw = pdftotext(full);
  if (!raw || raw.trim().length < 200) {
    console.log("SKIP (no text)");
    continue;
  }

  let md = toMarkdown(raw);
  md = cleanLatex(md);
  // drop a first heading that merely repeats the module title
  md = md.replace(new RegExp(`^##\\s+${escapeRegExp(title.replace(/·/g, "."))}\\s*\\n+`, "m"), "");
  const header = `---\ntitle: "${title.replace(/"/g, "'}")}"\nslug: "${slug}"\ncategory: "${category}"\nsource: "agri-data/${file}"\n---\n\n`;
  fs.writeFileSync(path.join(COURSES_DIR, `${slug}.md`), header + md, "utf8");

  const topics = listTopics(md);
  const item = {
    slug,
    title,
    category,
    source: `agri-data/${file}`,
    description: firstParagraph(md),
    topics,
    topicCount: topics.length,
    words: countWords(md),
    bytes: Buffer.byteLength(md),
  };
  index.push(item);
  console.log(`ok · ${topics.length} topics · ${item.words.toLocaleString()} words`);
}

fs.writeFileSync(path.join(OUT_DIR, "index.json"), JSON.stringify(index, null, 2), "utf8");

const categories = [...new Set(index.map((i) => i.category))].sort();
console.log(`\n✓ ${index.length} courses written → data/courses/`);
console.log(`✓ catalogue → data/index.json`);
console.log(`✓ categories: ${categories.join(", ")}`);
