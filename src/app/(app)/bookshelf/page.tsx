import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, categoryLabel, normalizeCategory } from "@/lib/categories";
import { deleteBook } from "./actions";
import { AddBookModal } from "./AddBookModal";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";

const SPINE_COLORS = [
  "from-amber-600 to-orange-700",
  "from-emerald-600 to-teal-700",
  "from-sky-600 to-indigo-700",
  "from-rose-600 to-pink-700",
  "from-violet-600 to-fuchsia-700",
  "from-stone-600 to-stone-800",
];
function spineColor(title: string) {
  let h = 0;
  for (const c of title) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return SPINE_COLORS[h % SPINE_COLORS.length];
}

interface BookRow {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  cover_url: string | null;
  metadata: {
    category?: string;
    summary?: string;
    notes?: { html?: string }[];
  } | null;
}

function hasAnyNote(meta: BookRow["metadata"]): boolean {
  if (Array.isArray(meta?.notes)) {
    return meta.notes.some((n) => (n.html ?? "").replace(/<[^>]*>/g, "").trim());
  }
  return Boolean(meta?.summary?.replace(/<[^>]*>/g, "").trim());
}

export default async function BookshelfPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: categoryParam } = await searchParams;
  const category = normalizeCategory(categoryParam);
  const supabase = await createClient();

  const [{ data: booksData }, { data: noteCounts }] = await Promise.all([
    supabase
      .from("sources")
      .select("id, title, authors, year, cover_url, metadata")
      .eq("kind", "book")
      .order("created_at", { ascending: false }),
    supabase.from("notes").select("source_id"),
  ]);

  // Category lives in metadata; legacy books without one fall back to default.
  const books = ((booksData ?? []) as BookRow[]).filter(
    (b) => normalizeCategory(b.metadata?.category) === category,
  );
  const countBySource = new Map<string, number>();
  for (const n of noteCounts ?? []) {
    if (n.source_id) {
      countBySource.set(n.source_id, (countBySource.get(n.source_id) ?? 0) + 1);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex items-start justify-between gap-4 animate-in">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">
            <span className="gradient-text">Kitap Rafı</span>
          </h1>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
            {categoryLabel(category)} rafı — her kategorinin kitapları ayrı
            tutulur. Her kitap için zengin metin özeti yazın, görsel ekleyin.
          </p>
        </div>
        <AddBookModal category={category} />
      </div>

      {/* Kategori sekmeleri */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => {
          const active = c.slug === category;
          return (
            <Link
              key={c.slug}
              href={`/bookshelf?category=${c.slug}`}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                active
                  ? "bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow"
                  : "bg-stone-500/10 text-stone-600 hover:bg-stone-500/20 dark:text-stone-400"
              }`}
            >
              <span aria-hidden className="mr-1">
                {c.icon}
              </span>
              {c.label}
            </Link>
          );
        })}
      </div>

      {books.length > 0 ? (
        <div className="stagger grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {books.map((b) => {
            const noteCount = countBySource.get(b.id) ?? 0;
            const hasSummary = hasAnyNote(b.metadata);
            return (
              <div
                key={b.id}
                className="glass-card group relative flex flex-col overflow-hidden rounded-2xl p-2.5"
              >
                <form action={deleteBook} className="absolute right-1.5 top-1.5 z-10">
                  <input type="hidden" name="id" value={b.id} />
                  <ConfirmSubmit
                    ariaLabel="Kitabı sil"
                    title="Sil"
                    message={`"${b.title}" kitabı ve notları silinsin mi?`}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-black/30 text-sm leading-none text-white/80 opacity-0 backdrop-blur-sm transition-all hover:bg-rose-500 hover:text-white group-hover:opacity-100"
                  >
                    ×
                  </ConfirmSubmit>
                </form>

                <Link href={`/bookshelf/${b.id}`} className="block">
                  {b.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.cover_url}
                      alt={`${b.title} kapağı`}
                      className="aspect-[2/3] w-full rounded-lg border border-[var(--border)] object-cover shadow-md transition-transform group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div
                      className={`flex aspect-[2/3] w-full items-center justify-center rounded-lg bg-gradient-to-br p-2 text-center shadow-md transition-transform group-hover:scale-[1.03] ${spineColor(b.title)}`}
                    >
                      <span className="line-clamp-5 text-[11px] font-semibold leading-tight text-white">
                        {b.title}
                      </span>
                    </div>
                  )}
                </Link>

                <div className="mt-2 flex min-w-0 flex-1 flex-col">
                  <Link href={`/bookshelf/${b.id}`} className="min-w-0">
                    <h3 className="line-clamp-2 text-xs font-bold leading-snug hover:text-amber-600">
                      {b.title}
                    </h3>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-stone-500">
                      {b.authors.join(", ")}
                      {b.year ? ` · ${b.year}` : ""}
                    </p>
                  </Link>
                  <div className="mt-auto flex flex-wrap items-center gap-1 pt-1.5">
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                        hasSummary
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-stone-500/10 text-stone-500"
                      }`}
                    >
                      {hasSummary ? "✓ Özet" : "Özet yok"}
                    </span>
                    {noteCount > 0 && (
                      <Link
                        href={`/notes?source=${b.id}`}
                        className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-500/25 dark:text-amber-400"
                      >
                        {noteCount} not
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-stone-300 p-10 text-center text-sm text-stone-500 dark:border-stone-700">
          Rafınız henüz boş. Sağ üstteki{" "}
          <b className="text-amber-600">+ Kitap Ekle</b> ile ilk kitabınızı
          ekleyin.
        </p>
      )}
    </div>
  );
}
