import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { addBook, deleteBook } from "./actions";

const inputCls =
  "w-full rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500";

// Deterministic spine color for books without a cover image
const SPINE_COLORS = [
  "bg-amber-700",
  "bg-emerald-800",
  "bg-sky-800",
  "bg-rose-800",
  "bg-violet-800",
  "bg-stone-700",
];
function spineColor(title: string) {
  let h = 0;
  for (const c of title) h = (h * 31 + c.charCodeAt(0)) % SPINE_COLORS.length;
  return SPINE_COLORS[h];
}

export default async function BookshelfPage() {
  const supabase = await createClient();

  const [{ data: books }, { data: noteCounts }] = await Promise.all([
    supabase
      .from("sources")
      .select("id, title, authors, year, cover_url")
      .eq("kind", "book")
      .order("created_at", { ascending: false }),
    supabase.from("notes").select("source_id"),
  ]);

  const countBySource = new Map<string, number>();
  for (const n of noteCounts ?? []) {
    if (n.source_id) {
      countBySource.set(n.source_id, (countBySource.get(n.source_id) ?? 0) + 1);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Kitap Rafı</h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Notlarınızın bağlı olduğu kaynak kitaplar — dijital kütüphaneniz.
        </p>
      </div>

      {books && books.length > 0 ? (
        <div className="grid grid-cols-3 gap-5 sm:grid-cols-4 md:grid-cols-5">
          {books.map((b) => {
            const noteCount = countBySource.get(b.id) ?? 0;
            return (
              <div key={b.id} className="group">
                <Link
                  href={`/notes?source=${b.id}`}
                  title={`${b.title} — ${noteCount} not`}
                  className="block"
                >
                  {b.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.cover_url}
                      alt={`${b.title} kapağı`}
                      className="aspect-[2/3] w-full rounded-md border border-stone-200 dark:border-stone-800 object-cover shadow-sm transition-transform group-hover:-translate-y-1"
                    />
                  ) : (
                    <div
                      className={`flex aspect-[2/3] w-full items-center justify-center rounded-md p-3 text-center shadow-sm transition-transform group-hover:-translate-y-1 ${spineColor(b.title)}`}
                    >
                      <span className="text-sm font-semibold leading-snug text-white">
                        {b.title}
                      </span>
                    </div>
                  )}
                </Link>
                <p className="mt-1.5 truncate text-xs font-medium" title={b.title}>
                  {b.title}
                </p>
                <div className="flex items-center justify-between">
                  <p className="truncate text-xs text-stone-500">
                    {b.authors.join(", ")}
                    {b.year ? ` · ${b.year}` : ""}
                  </p>
                  <form action={deleteBook}>
                    <input type="hidden" name="id" value={b.id} />
                    <button className="text-xs text-stone-400 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100">
                      Sil
                    </button>
                  </form>
                </div>
                <p className="text-xs text-amber-700 dark:text-amber-500">
                  {noteCount} not
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-stone-300 dark:border-stone-700 p-8 text-center text-sm text-stone-500">
          Rafınız henüz boş. Aşağıdan ilk kitabınızı ekleyin.
        </p>
      )}

      <section className="rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 p-5">
        <h2 className="text-lg font-semibold">Kitap ekle</h2>
        <form action={addBook} className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="bk-title" className="text-sm font-medium">
              Kitap adı *
            </label>
            <input id="bk-title" name="title" required className={inputCls} />
          </div>
          <div className="space-y-1">
            <label htmlFor="bk-authors" className="text-sm font-medium">
              Yazar(lar) * <span className="font-normal text-stone-400">(virgülle)</span>
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
            <label htmlFor="bk-isbn" className="text-sm font-medium">
              ISBN <span className="font-normal text-stone-400">(kapak otomatik bulunur)</span>
            </label>
            <input id="bk-isbn" name="isbn" placeholder="978-..." className={inputCls} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="bk-cover" className="text-sm font-medium">
              Kapak görseli URL <span className="font-normal text-stone-400">(isteğe bağlı, ISBN yerine)</span>
            </label>
            <input id="bk-cover" name="cover_url" type="url" className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <button className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
              Rafa Ekle
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
