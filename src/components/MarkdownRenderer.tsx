"use client";

import {
  ArrowUp,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  List,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { useLang } from "@/components/providers";
import { anchor } from "@/lib/utils";

interface Heading {
  id: string;
  text: string;
}

export default function MarkdownRenderer({ markdown }: { markdown: string }) {
  const { t, lang } = useLang();
  const [active, setActive] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  /* Unique ids per heading text — repeated headings (e.g. "IRDP" twice) get
     numbered suffixes so anchors/keys never collide. */
  const headingIds = useMemo(() => {
    const map = new Map<string, string>();
    const used = new Map<string, number>();
    for (const line of markdown.split("\n")) {
      const m = line.match(/^##\s+(.+)$/);
      if (!m) continue;
      const text = m[1].trim();
      const base = anchor(text);
      const count = (used.get(base) ?? 0) + 1;
      used.set(base, count);
      map.set(text, count === 1 ? base : `${base}-${count}`);
    }
    return map;
  }, [markdown]);

  const headings = useMemo<Heading[]>(
    () => Array.from(headingIds.entries(), ([text, id]) => ({ id, text })),
    [headingIds]
  );

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const onScroll = () => {
      const max = scroller.scrollHeight - scroller.clientHeight;
      setProgress(max > 0 ? (scroller.scrollTop / max) * 100 : 0);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { root: scroller, threshold: 0.1, rootMargin: "-60px 0px -70% 0px" }
    );
    for (const h of headings) {
      const el = scroller.querySelector(`#${CSS.escape(h.id)}`);
      if (el) observer.observe(el);
    }
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      scroller.removeEventListener("scroll", onScroll);
    };
  }, [headings]);

  function scrollToTop() {
    scrollerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
      {/* article */}
      <div
        ref={scrollerRef}
        className="relative max-h-[calc(100vh-8rem)] overflow-y-auto rounded-3xl border border-emerald-900/10 bg-white p-6 sm:p-10 dark:border-emerald-400/10 dark:bg-[#0d140c]"
      >
        {progress > 0 && (
          <div
            className="sticky top-0 z-10 -mt-6 h-1 rounded-full bg-emerald-600 transition-all sm:-mt-10"
            style={{ width: `${progress}%` }}
          />
        )}
        <div className="prose-agri text-emerald-950 dark:text-emerald-50">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h2: ({ children }) => {
                const text = String(children).trim();
                return <h2 id={headingIds.get(text) ?? anchor(text)}>{children}</h2>;
              },
              h3: ({ children }) => <h3>{children}</h3>,
            }}
          >
            {markdown}
          </ReactMarkdown>
        </div>
        <button
          type="button"
          onClick={scrollToTop}
          className="sticky bottom-4 mt-6 ml-auto flex items-center gap-1.5 rounded-lg border border-emerald-700/25 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50 dark:border-emerald-400/20 dark:bg-[#0e150d] dark:text-emerald-300"
        >
          <ArrowUp size={13} /> {lang === "hi" ? "ऊपर" : "Top"}
        </button>
      </div>

      {/* TOC sidebar */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 rounded-3xl border border-emerald-900/10 bg-white p-5 dark:border-emerald-400/10 dark:bg-[#0d140c]">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-950/60 dark:text-emerald-100/60">
            <List size={14} />
            {t("course_topics")}
          </p>
          <nav className="mt-3 space-y-1 border-l border-emerald-900/10 dark:border-emerald-400/10">
            {headings.map((h) => (
              <a
                key={h.id}
                href={`#${h.id}`}
                className={`block border-l-2 py-1 pl-3 text-[13px] leading-snug transition ${
                  active === h.id
                    ? "border-emerald-600 font-semibold text-emerald-700 dark:border-emerald-400 dark:text-emerald-300"
                    : "border-transparent text-emerald-950/60 hover:border-emerald-600/40 hover:text-emerald-700 dark:text-emerald-100/60 dark:hover:text-emerald-200"
                }`}
              >
                {h.text}
              </a>
            ))}
          </nav>
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-600/10 px-3 py-2 text-[11px] text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
            <BookOpen size={13} /> {headings.length} {t("course_topics")} ·{" "}
            {Math.ceil(markdown.split(/\s+/).length * 0.16)} min {t("stats_words").toLowerCase()}
          </div>
        </div>
      </aside>
    </div>
  );
}

export function PrevNext({
  slug,
  courses,
}: {
  slug: string;
  courses: { slug: string; title: string }[];
}) {
  const { t } = useLang();
  const idx = courses.findIndex((c) => c.slug === slug);
  const prev = idx > 0 ? courses[idx - 1] : null;
  const next = idx >= 0 && idx < courses.length - 1 ? courses[idx + 1] : null;
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      {prev ? (
        <a
          href={`/courses/${prev.slug}`}
          className="group flex items-center gap-3 rounded-2xl border border-emerald-900/10 bg-white p-4 text-sm transition hover:border-emerald-600/40 dark:border-emerald-400/10 dark:bg-[#0d140c]"
        >
          <ChevronLeft size={18} className="shrink-0 text-emerald-600" />
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-emerald-950/50 dark:text-emerald-100/50">
              {t("course_prev")}
            </p>
            <p className="truncate font-medium text-emerald-950 dark:text-emerald-50">
              {prev.title}
            </p>
          </div>
        </a>
      ) : (
        <div />
      )}
      {next && (
        <a
          href={`/courses/${next.slug}`}
          className="group flex items-center justify-end gap-3 rounded-2xl border border-emerald-900/10 bg-white p-4 text-right text-sm transition hover:border-emerald-600/40 dark:border-emerald-400/10 dark:bg-[#0d140c]"
        >
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-emerald-950/50 dark:text-emerald-100/50">
              {t("course_next")}
            </p>
            <p className="truncate font-medium text-emerald-950 dark:text-emerald-50">
              {next.title}
            </p>
          </div>
          <ChevronRight size={18} className="shrink-0 text-emerald-600" />
        </a>
      )}
    </div>
  );
}