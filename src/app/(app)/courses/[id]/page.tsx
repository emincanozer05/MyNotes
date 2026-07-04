import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CourseEditor } from "./CourseEditor";
import { CourseControls } from "./CourseControls";
import { SummaryReadModal } from "../../library/SummaryReadModal";
import { normalizeStatus } from "../status";

interface CourseRow {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  cover_url: string | null;
  url: string | null;
  metadata: { status?: string; summary?: string } | null;
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("sources")
    .select("id, title, authors, year, cover_url, url, metadata")
    .eq("id", id)
    .eq("kind", "other")
    .maybeSingle();

  if (!data) notFound();
  const course = data as CourseRow;
  const summary = course.metadata?.summary ?? "";
  const status = normalizeStatus(course.metadata?.status);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/courses" className="text-sm text-stone-500 hover:text-amber-600">
        ← Kurslar & Eğitimler
      </Link>

      <div className="glass-card overflow-hidden rounded-2xl">
        {course.cover_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.cover_url}
            alt={course.title}
            className="max-h-56 w-full object-cover"
          />
        )}
        <div className="p-5">
          <h1 className="text-2xl font-bold leading-tight">{course.title}</h1>
          {(course.authors.length > 0 || course.year) && (
            <p className="mt-1 text-sm text-stone-500">
              {course.authors.join(", ")}
              {course.authors.length > 0 && course.year ? " · " : ""}
              {course.year ?? ""}
            </p>
          )}
          <div className="mt-3">
            <CourseControls courseId={course.id} status={status} />
          </div>
          {course.url && (
            <a
              href={course.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-xs font-semibold text-amber-700 hover:underline dark:text-amber-400"
            >
              Kursa git ↗
            </a>
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-bold">Notların</h2>
        <p className="mb-3 text-sm text-stone-500">
          Kurstan/eğitimden çıkardığın bilgileri buraya yaz — biçimlendir, görsel
          ekleyip boyutlandır.
        </p>
        <CourseEditor courseId={course.id} initialHtml={summary} />
        <div className="mt-3">
          <SummaryReadModal html={summary} title={course.title} />
        </div>
      </div>
    </div>
  );
}
