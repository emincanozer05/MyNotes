import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addBook, deleteBook } from "./actions";

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500";

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
  metadata: { summary?: string } | null;
}

export default async function BookshelfPage() {
  const supabase = await createClient();

  const [{ data: booksData }, { data: noteCounts }] = await Promise.all([
    supabase
      .from("sources")
      .select("id, title, authors, year, cover_url, metadata")
      .eq("kind", "book")
      .order("created_at", { ascending: false }),
    supabase.from("notes").select("source_id"),
  ]);

  const books = (booksData ?? []) as BookRow[];
  const countBySource = new Map<string, number>();
  for (const n of noteCounts ?? []) {
    if (n.source_id) {
      countBySource.set(n.source_id, (countBySource.get(n.source_id) ?? 0) + 1);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="animate-in">
        <h1 className="text-4xl font-extrabold tracking-tight">
          <span className="gradient-text">Kitap Rafı</span>
        </h1>
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
          Kapak görselleriyle dijital kütüphaneniz. Her kitap için zengin metin
          özeti yazın, görsel ekleyin.
        </p>
      </div>

      {books.length > 0 ? (
        <div className="stagger space-y-3">
          {books.map((b) => {
            const noteCount = countBySource.get(b.id) ?? 0;
            const hasSummary = Boolean(b.metadata?.summary?.trim());
            return (
              <div
                key={b.id}
                className="glass-card accent-bar group flex gap-4 rounded-2xl p-3"
              >
                <Link href={`/bookshelf/${b.id}`} className="shrink-0">
                  {b.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.cover_url}
                      alt={`${b.title} kapağı`}
                      className="h-28 w-20 rounded-md border border-[var(--border)] object-cover shadow-md transition-transform group-hover:scale-105"
                    />
                  ) : (
                    <div
                      className={`flex h-28 w-20 items-center justify-center rounded-md bg-gradient-to-br p-2 text-center shadow-md transition-transform group-hover:scale-105 ${spineColor(b.title)}`}
                    >
                      <span className="line-clamp-4 text-[10px] font-semibold leading-tight text-white">
                        {b.title}
                      </span>
                    </div>
                  )}
                </Link>

                <div className="flex min-w-0 flex-1 flex-col">
                  <Link href={`/bookshelf/${b.id}`} className="min-w-0">
                    <h3 className="font-bold leading-snug hover:text-amber-600">
                      {b.title}
                    </h3>
                    <p className="mt-0.5 text-sm text-stone-500">
                      {b.authors.join(", ")}
                      {b.year ? ` · ${b.year}` : ""}
                    </p>
                  </Link>
                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-xs">
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${
                        hasSummary
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-stone-500/10 text-stone-500"
                      }`}
                    >
                      {hasSummary ? "✓ Özet var" : "Özet yok"}
                    </span>
                    {noteCount > 0 && (
                      <Link
                        href={`/notes?source=${b.id}`}
                        className="rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-700 hover:bg-amber-500/25 dark:text-amber-400"
                      >
                        {noteCount} not
                      </Link>
                    )}
                    <Link
                      href={`/bookshelf/${b.id}`}
                      className="text-amber-700 hover:underline dark:text-amber-500"
                    >
                      Özeti düzenle →
                    </Link>
                  </div>
                </div>

                <form action={deleteBook} className="shrink-0">
                  <input type="hidden" name="id" value={b.id} />
                  <button className="text-xs text-stone-400 opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100">
                    Sil
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-stone-300 p-10 text-center text-sm text-stone-500 dark:border-stone-700">
          Rafınız henüz boş. Aşağıdan ilk kitabınızı ekleyin.
        </p>
      )}

      <section className="glass-card rounded-2xl p-5">
        <h2 className="text-lg font-bold">Kitap ekle</h2>
        <p className="mb-3 mt-1 text-xs text-stone-500">
          Kapak, kitap adından otomatik bulunur.
        </p>
        <form action={addBook} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="bk-title" className="text-sm font-medium">
              Kitap adı *
            </label>
            <input id="bk-title" name="title" required className={inputCls} />
          </div>
          <div className="space-y-1">
            <label htmlFor="bk-authors" className="text-sm font-medium">
              Yazar(lar) *{" "}
              <span className="font-normal text-stone-400">(virgülle)</span>
            </label>
            <input id="bk-authors" name="authors" required className={inputCls} />
          </div>
          <div className="space-y-1">
            <label htmlFor="bk-year" className="text-sm font-medium">
              Yıl
            </label>
            <input id="bk-year" name="year" type="number" className={inputCls} />
          </div>
          <div className="space-y-1">
            <label htmlFor="bk-cover" className="text-sm font-medium">
              Kapak URL{" "}
              <span className="font-normal text-stone-400">
                (isteğe bağlı — boşsa otomatik)
              </span>
            </label>
            <input
              id="bk-cover"
              name="cover_url"
              type="url"
              placeholder="https://…"
              className={inputCls}
            />
          </div>
          <div className="sm:col-span-2">
            <button className="btn-gradient rounded-full px-5 py-2 text-sm font-semibold">
              Rafa Ekle
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
