/**
 * Copy build-time datasets into public/data so the client can fetch them
 * lazily (chatbot search fallback, crop/recommend fallback).
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.join(ROOT, "data");
const DST = path.join(ROOT, "public", "data");

fs.mkdirSync(DST, { recursive: true });
for (const file of ["crops.json", "chatbot-index.json"]) {
  fs.copyFileSync(path.join(SRC, file), path.join(DST, file));
  console.log(`✓ public/data/${file}`);
}