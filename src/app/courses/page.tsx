import type { Metadata } from "next";

import CourseSearch from "@/components/CourseSearch";
import { getCourseIndex } from "@/lib/server-data";

export const metadata: Metadata = {
  title: "All Courses",
  description: "36 agriculture course modules extracted from the AgriMitra library.",
};

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ cat?: string }>;
}) {
  const { cat } = await searchParams;
  const courses = getCourseIndex();
  const initialCat = typeof cat === "string" && cat.length > 0 ? cat : "All";

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-extrabold tracking-tight text-emerald-950 dark:text-emerald-50">
        All Courses
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-emerald-950/60 dark:text-emerald-100/60">
        36 modules extracted from the AgriMitra PDF library —{" "}
        {courses.reduce((s, c) => s + c.topicCount, 0).toLocaleString()} topics,
        searchable and filterable by category.
      </p>

      <div className="mt-8">
        <CourseSearch courses={courses} initialCat={initialCat} />
      </div>
    </div>
  );
}