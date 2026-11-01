import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, FileText } from "lucide-react";

import MarkdownRenderer, { PrevNext } from "@/components/MarkdownRenderer";
import TopicReader from "@/components/TopicReader";
import {
  getCourseIndex,
  getCourseMarkdown,
  getCourseTopics,
} from "@/lib/server-data";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const course = getCourseIndex().find((c) => c.slug === slug);
  if (!course) return { title: "Course not found" };
  const topics = getCourseTopics(slug);
  return {
    title: topics?.title || course.title,
    description: topics?.description || course.description,
  };
}

export async function generateStaticParams() {
  return getCourseIndex().map((c) => ({ slug: c.slug }));
}

export const dynamicParams = false;

export default async function CoursePage({ params }: Props) {
  const { slug } = await params;
  const index = getCourseIndex();
  const course = index.find((c) => c.slug === slug);
  if (!course) notFound();

  const topics = getCourseTopics(slug);
  const markdown = getCourseMarkdown(slug);
  if (!topics && !markdown) notFound();

  const title = topics?.title || course.title;
  const description = topics?.description || course.description;
  const category = topics?.category || course.category;
  const topicCount = topics?.topics.length ?? course.topicCount;
  const topicChips = topics
    ? topics.topics.slice(0, 12).map((topic) => topic.title)
    : course.topics;
  const readMins = Math.max(1, Math.ceil(course.words / 175));

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <nav aria-label="breadcrumb" className="text-xs text-emerald-950/50 dark:text-emerald-100/50">
        <Link href="/" className="hover:text-emerald-600 dark:hover:text-emerald-300">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link href="/courses" className="hover:text-emerald-600 dark:hover:text-emerald-300">
          Courses
        </Link>
        <span className="mx-2">/</span>
        <span className="text-emerald-600 dark:text-emerald-300">{title}</span>
      </nav>

      <header className="mt-4 rounded-3xl border border-emerald-900/10 bg-white p-6 sm:p-8 dark:border-emerald-400/10 dark:bg-[#0d140c]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-emerald-600/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
            {category}
          </span>
          {topics && (
            <span className="rounded-full border border-emerald-900/15 px-3 py-1 text-[11px] font-medium text-emerald-950/60 dark:border-emerald-400/15 dark:text-emerald-100/60">
              Structured topic guide
            </span>
          )}
        </div>
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-emerald-950 sm:text-4xl dark:text-emerald-50">
          {title}
        </h1>
        <p className="mt-3 max-w-3xl leading-relaxed text-emerald-950/70 dark:text-emerald-100/70">
          {description}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-emerald-950/60 dark:text-emerald-100/60">
          {!topics && (
            <span className="inline-flex items-center gap-1.5">
              <Clock size={14} /> {readMins} min read
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <FileText size={14} /> {course.words.toLocaleString()} words
          </span>
          <span>{topicCount} topics</span>
        </div>
        {topicChips.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {topicChips.map((topic) => (
              <span
                key={topic}
                className="rounded-full border border-emerald-900/15 px-3 py-1 text-[11px] text-emerald-950/70 dark:border-emerald-400/15 dark:text-emerald-100/70"
              >
                {topic}
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="mt-8">
        {topics ? (
          <TopicReader course={topics} />
        ) : (
          markdown && <MarkdownRenderer markdown={markdown} />
        )}
        <PrevNext
          slug={slug}
          courses={index.map((c) => ({ slug: c.slug, title: c.title }))}
        />
      </div>
    </div>
  );
}