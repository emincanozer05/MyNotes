import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deleteCourse } from "./actions";
import { AddCourseModal } from "./AddCourseModal";
import { STATUS_META, normalizeStatus } from "./status";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";

interface CourseRow {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  cover_url: string | null;
  url: string | null;
  meta_status: string | null;
}

const GRAD = [
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-teal-600",
  "from-sky-500 to-indigo-600",
  "from-rose-500 to-pink-600",
  "from-violet-500 to-fuchsia-600",
];
function grad(title: string) {
  let h = 0;
  for (const c of title) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return GRAD[h % GRAD.length];
}

export default async function CoursesPage() {
  const supabase = await createClient();

  // Only the status key is read from metadata — selecting the whole jsonb
  // would ship every course's rich-text notes (with embedded base64 images)
  // just to render the card grid, which is what made this page slow.
  const { data } = await supabase
    .from("sources")
    .select(
      "id, title, authors, year, cover_url, url, meta_status:metadata->>status",
    )
    .eq("kind", "other")
    .contains("metadata", { category: "course" })
    .order("created_at", { ascending: false });

  const courses = (data ?? []) as CourseRow[];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">
            <span className="gradient-text">Kurslar ve Eğitimler (S&C)</span>
          </h1>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
            Kurs, sertifika ve eğitimlerini kapak görselleriyle topla; her biri
            için not/özet yaz.
          </p>
        </div>
        <AddCourseModal />
      </div>

      {courses.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {courses.map((c) => {
            const status = normalizeStatus(c.meta_status);
            const meta = STATUS_META[status];
            return (
              <div
                key={c.id}
                className="glass-card group relative flex flex-col overflow-hidden rounded-2xl"
              >
                <form
                  action={deleteCourse}
                  className="absolute right-2 top-2 z-10"
                >
                  <input type="hidden" name="id" value={c.id} />
                  <ConfirmSubmit
                    ariaLabel="Sil"
                    title="Sil"
                    message={`"${c.title}" silinsin mi?`}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-sm leading-none text-white/80 opacity-0 backdrop-blur-sm transition-all hover:bg-rose-500 hover:text-white group-hover:opacity-100"
                  >
                    ×
                  </ConfirmSubmit>
                </form>

                <Link href={`/courses/${c.id}`} className="block">
                  {c.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.cover_url}
                      alt={c.title}
                      className="aspect-[16/10] w-full object-cover"
                    />
                  ) : (
                    <div
                      className={`flex aspect-[16/10] w-full items-center justify-center bg-gradient-to-br p-3 text-center ${grad(c.title)}`}
                    >
                      <span className="line-clamp-3 text-sm font-black uppercase tracking-wide text-white">
                        {c.title}
                      </span>
                    </div>
                  )}
                </Link>

                <div className="flex flex-1 flex-col p-3">
                  <Link href={`/courses/${c.id}`}>
                    <h3 className="line-clamp-2 text-sm font-bold leading-snug hover:text-amber-600">
                      {c.title}
                    </h3>
                  </Link>
                  {(c.authors.length > 0 || c.year) && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-stone-500">
                      {c.authors.join(", ")}
                      {c.authors.length > 0 && c.year ? " · " : ""}
                      {c.year ?? ""}
                    </p>
                  )}
                  <div className="mt-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.pill}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-stone-300 p-10 text-center text-sm text-stone-500 dark:border-stone-700">
          Henüz kurs/eğitim eklemedin. Sağ üstteki{" "}
          <b className="text-amber-600">+ Ekle</b> ile başla.
        </p>
      )}
    </div>
  );
}
