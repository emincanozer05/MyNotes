import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CourseControls } from "./CourseControls";
import { TitledNotes } from "@/components/TitledNotes";
import type { TitledNote } from "@/app/(app)/sourceNotesActions";
import { normalizeStatus } from "../status";

interface CourseRow {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  cover_url: string | null;
  url: string | null;
  metadata: { status?: string; summary?: string; notes?: TitledNote[] } | null;
}

/** Uses saved titled notes, or seeds one from a legacy single summary. */
function seedNotes(meta: CourseRow["metadata"]): TitledNote[] {
  if (Array.isArray(meta?.notes)) return meta.notes;
  const s = meta?.summary ?? "";
  return s.replace(/<[^>]*>/g, "").trim()
    ? [{ id: "legacy", title: "Genel", html: s }]
    : [];
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
  const status = normalizeStatus(course.metadata?.status);
  const seededNotes = seedNotes(course.metadata);

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
          Her başlık için ayrı bir not tut — biçimlendir, görsel ekleyip
          boyutlandır. Sağ üstten A4 çıktısı alabilirsin.
        </p>
        <TitledNotes
          sourceId={course.id}
          initialNotes={seededNotes}
          printHref={`/print/${course.id}`}
        />
      </div>
    </div>
  );
}
