"use client";

import { ChevronLeft, ChevronRight, ListTree, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { useLang } from "@/components/providers";
import type { CourseTopics, TopicArticle, TopicSection } from "@/types";

function currentHash() {
  return decodeURIComponent(window.location.hash.replace(/^#/, ""));
}

function serverHash() {
  return "";
}

/* --------------------------------------------------------------- section view */
function SectionBody({ section }: { section: TopicSection }) {
  switch (section.type) {
    case "table": {
      const rows = section.rows ?? [];
      if (rows.length === 0) return null;
      const [head, ...body] = rows;
      return (
        <div className="overflow-x-auto rounded-xl border border-emerald-900/10 dark:border-emerald-400/10">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-emerald-600/5 dark:bg-emerald-400/5">
              <tr>
                {head.map((cell, i) => (
                  <th
                    key={i}
                    className="border-b border-emerald-900/10 px-3 py-2 font-semibold text-emerald-950 dark:border-emerald-400/10 dark:text-emerald-50"
                  >
                    {cell}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, r) => (
                <tr key={r} className="odd:bg-emerald-600/[0.02] dark:odd:bg-emerald-400/[0.03]">
                  {row.map((cell, c) => (
                    <td
                      key={c}
                      className="border-b border-emerald-900/10 px-3 py-2 align-top text-emerald-950/80 dark:border-emerald-400/10 dark:text-emerald-100/80"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case "image":
      if (!section.src) return null;
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={section.src}
          alt={section.heading || "Course illustration"}
          className="max-h-[28rem] w-auto rounded-xl border border-emerald-900/10 dark:border-emerald-400/10"
        />
      );

    case "formula":
      return (
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-emerald-950/90 px-4 py-3 font-mono text-xs leading-relaxed text-emerald-50 dark:bg-black/40">
          {(section.items ?? (section.text ? [section.text] : [])).join("\n")}
        </pre>
      );

    case "number":
      return (
        <ol className="list-decimal space-y-2 pl-5 leading-relaxed text-emerald-950/85 dark:text-emerald-100/85">
          {(section.items ?? (section.text ? [section.text] : [])).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ol>
      );

    case "list":
      return (
        <ul className="list-disc space-y-2 pl-5 leading-relaxed text-emerald-950/85 dark:text-emerald-100/85">
          {(section.items ?? (section.text ? [section.text] : [])).map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );

    default:
      return (
        <p className="whitespace-pre-line leading-relaxed text-emerald-950/85 dark:text-emerald-100/85">
          {section.text}
        </p>
      );
  }
}

/* ------------------------------------------------------------------ topic view */
export default function TopicReader({ course }: { course: CourseTopics }) {
  const { lang, t } = useLang();
  const [chosen, setChosen] = useState("");
  const [query, setQuery] = useState("");
  const articleRef = useRef<HTMLElement>(null);
  const firstScroll = useRef(true);

  // Deep links: /courses/<slug>#<topic-id>. The URL is the source of truth until
  // the reader clicks a topic; a hashchange (back/forward, new link) clears the
  // local choice so the address bar wins again.
  const subscribe = useCallback((callback: () => void) => {
    const onHash = () => {
      setChosen("");
      callback();
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const hash = useSyncExternalStore(subscribe, currentHash, serverHash);

  const active = useMemo(() => {
    const wanted = chosen || hash;
    return course.topics.find((topic) => topic.id === wanted) ?? course.topics[0];
  }, [course.topics, chosen, hash]);

  const choose = useCallback((id: string) => {
    setChosen(id);
    window.history.replaceState(window.history.state, "", `#${id}`);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return course.topics;
    return course.topics.filter(
      (topic) =>
        topic.title.toLowerCase().includes(q) ||
        topic.definition.toLowerCase().includes(q) ||
        topic.sections.some((section) => section.heading.toLowerCase().includes(q))
    );
  }, [course.topics, query]);

  const groups = useMemo(() => {
    const map = new Map<string, TopicArticle[]>();
    for (const topic of filtered) {
      const key = topic.chapter || "";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(topic);
    }
    return Array.from(map.entries());
  }, [filtered]);

  /* Keep the address bar in sync and bring a newly selected topic into view. */
  useEffect(() => {
    if (!active) return;
    if (!window.location.hash) {
      window.history.replaceState(window.history.state, "", `#${active.id}`);
    }
    if (firstScroll.current) {
      firstScroll.current = false;
      return;
    }
    articleRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [active]);

  if (!active) return null;

  const index = course.topics.findIndex((topic) => topic.id === active.id);
  const previous = index > 0 ? course.topics[index - 1] : null;
  const next = index >= 0 && index < course.topics.length - 1 ? course.topics[index + 1] : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <section className="min-w-0">
        {/* mobile picker */}
        <label className="mb-4 block lg:hidden">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-emerald-950/50 dark:text-emerald-100/50">
            {lang === "hi" ? "विषय चुनें" : "Choose a topic"} · {course.topics.length}
          </span>
          <select
            value={active.id}
            onChange={(event) => choose(event.target.value)}
            className="w-full rounded-xl border border-emerald-900/15 bg-white px-3 py-2.5 text-sm text-emerald-950 dark:border-emerald-400/15 dark:bg-[#0d140c] dark:text-emerald-50"
          >
            {groups.map(([chapter, topics]) => (
              <optgroup key={chapter || "topics"} label={chapter || (lang === "hi" ? "विषय" : "Topics")}>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <article
          ref={articleRef}
          key={active.id}
          className="scroll-mt-24 rounded-3xl border border-emerald-900/10 bg-white p-6 sm:p-10 dark:border-emerald-400/10 dark:bg-[#0d140c]"
        >
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            {active.chapter && (
              <span className="rounded-full bg-emerald-600/10 px-3 py-1 font-semibold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
                {active.chapter}
              </span>
            )}
            <span className="rounded-full border border-emerald-900/15 px-3 py-1 text-emerald-950/60 dark:border-emerald-400/15 dark:text-emerald-100/60">
              {index + 1} / {course.topics.length}
            </span>
            {active.category && (
              <span className="text-emerald-950/45 dark:text-emerald-100/45">{active.category}</span>
            )}
          </div>

          <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-emerald-950 sm:text-3xl dark:text-emerald-50">
            {active.title}
          </h2>

          {active.definition && (
            <p className="mt-4 rounded-2xl border border-emerald-600/15 bg-emerald-50/60 px-4 py-3 text-sm leading-relaxed text-emerald-950/80 dark:border-emerald-400/15 dark:bg-emerald-500/5 dark:text-emerald-100/80">
              {active.definition}
            </p>
          )}

          <div className="mt-7 space-y-7">
            {active.sections.map((section, i) => (
              <section key={i}>
                {section.heading && (
                  <h3 className="mb-2.5 text-base font-bold text-emerald-950 dark:text-emerald-50">
                    {section.heading}
                  </h3>
                )}
                <SectionBody section={section} />
              </section>
            ))}
          </div>

          {active.source && (
            <p className="mt-8 border-t border-emerald-900/10 pt-3 text-[11px] text-emerald-950/45 dark:border-emerald-400/10 dark:text-emerald-100/45">
              {t("course_source")}: {active.source}
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            {previous ? (
              <button
                type="button"
                onClick={() => choose(previous.id)}
                className="inline-flex max-w-[48%] items-center gap-2 rounded-xl border border-emerald-900/15 px-3 py-2 text-left text-xs font-medium text-emerald-950/70 transition hover:border-emerald-600/40 hover:text-emerald-700 dark:border-emerald-400/15 dark:text-emerald-100/70 dark:hover:text-emerald-300"
              >
                <ChevronLeft size={15} className="shrink-0 text-emerald-600" />
                <span className="min-w-0">
                  <span className="block text-[10px] uppercase tracking-wide opacity-60">
                    {t("course_prev")}
                  </span>
                  <span className="block truncate">{previous.title}</span>
                </span>
              </button>
            ) : (
              <span />
            )}
            {next ? (
              <button
                type="button"
                onClick={() => choose(next.id)}
                className="inline-flex max-w-[48%] items-center justify-end gap-2 rounded-xl border border-emerald-900/15 px-3 py-2 text-right text-xs font-medium text-emerald-950/70 transition hover:border-emerald-600/40 hover:text-emerald-700 dark:border-emerald-400/15 dark:text-emerald-100/70 dark:hover:text-emerald-300"
              >
                <span className="min-w-0">
                  <span className="block text-[10px] uppercase tracking-wide opacity-60">
                    {t("course_next")}
                  </span>
                  <span className="block truncate">{next.title}</span>
                </span>
                <ChevronRight size={15} className="shrink-0 text-emerald-600" />
              </button>
            ) : (
              <span />
            )}
          </div>
        </article>
      </section>

      {/* topic sidebar */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 rounded-3xl border border-emerald-900/10 bg-white p-5 dark:border-emerald-400/10 dark:bg-[#0d140c]">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-950/60 dark:text-emerald-100/60">
            <ListTree size={14} />
            {t("course_topics")} · {course.topics.length}
          </p>

          <label className="relative mt-3 block">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-emerald-700/50 dark:text-emerald-300/50"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={lang === "hi" ? "विषय खोजें…" : "Search topics…"}
              className="w-full rounded-lg border border-emerald-900/15 bg-emerald-50/40 py-2 pl-8 pr-3 text-xs text-emerald-950 placeholder:text-emerald-950/40 focus:border-emerald-600/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-emerald-400/15 dark:bg-emerald-500/5 dark:text-emerald-50 dark:placeholder:text-emerald-100/40"
            />
          </label>

          <nav className="mt-3 max-h-[calc(100vh-18rem)] overflow-y-auto border-l border-emerald-900/10 pr-1 dark:border-emerald-400/10">
            {groups.length === 0 && (
              <p className="py-4 pl-3 text-xs text-emerald-950/50 dark:text-emerald-100/50">
                {lang === "hi" ? "कोई विषय नहीं मिला।" : "No topics match your search."}
              </p>
            )}
            {groups.map(([chapter, topics]) => (
              <div key={chapter || "topics"} className="mb-2">
                {chapter && (
                  <p className="pl-3 pt-2 text-[10px] font-bold uppercase tracking-wider text-emerald-950/40 dark:text-emerald-100/40">
                    {chapter}
                  </p>
                )}
                {topics.map((topic) => (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => choose(topic.id)}
                    aria-current={topic.id === active.id ? "true" : undefined}
                    className={`block w-full border-l-2 py-1.5 pl-3 pr-2 text-left text-[13px] leading-snug transition ${
                      topic.id === active.id
                        ? "border-emerald-600 font-semibold text-emerald-700 dark:border-emerald-400 dark:text-emerald-300"
                        : "border-transparent text-emerald-950/60 hover:border-emerald-600/40 hover:text-emerald-700 dark:text-emerald-100/60 dark:hover:text-emerald-200"
                    }`}
                  >
                    {topic.title}
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </div>
      </aside>
    </div>
  );
}
