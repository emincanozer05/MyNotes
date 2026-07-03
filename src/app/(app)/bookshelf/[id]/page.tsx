import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BookEditor } from "./BookEditor";
import { refreshCover } from "../actions";

interface BookRow {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  cover_url: string | null;
  metadata: { summary?: string } | null;
}

export default async function BookDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: bookData }, { count: noteCount }] = await Promise.all([
    supabase
      .from("sources")
      .select("id, title, authors, year, cover_url, metadata")
      .eq("id", id)
      .eq("kind", "book")
      .maybeSingle(),
    supabase
      .from("notes")
      .select("*", { count: "exact", head: true })
      .eq("source_id", id),
  ]);

  if (!bookData) notFound();
  const book = bookData as BookRow;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/bookshelf" className="text-sm text-stone-500 hover:text-amber-600">
        ← Kitap Rafı
      </Link>

      <div className="glass-card flex gap-5 rounded-2xl p-5">
        {book.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={book.cover_url}
            alt={`${book.title} kapağı`}
            className="h-40 w-28 shrink-0 rounded-md border border-[var(--border)] object-cover shadow-lg"
          />
        ) : (
          <div className="flex h-40 w-28 shrink-0 flex-col items-center justify-center gap-2 rounded-md bg-gradient-to-br from-stone-600 to-stone-800 p-3 text-center shadow-lg">
            <span className="text-xs font-semibold text-white">{book.title}</span>
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-tight">{book.title}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {book.authors.join(", ")}
            {book.year ? ` · ${book.year}` : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {(noteCount ?? 0) > 0 && (
              <Link
                href={`/notes?source=${book.id}`}
                className="rounded-full bg-amber-500/15 px-3 py-1 font-medium text-amber-700 hover:bg-amber-500/25 dark:text-amber-400"
              >
                {noteCount} bağlı not
              </Link>
            )}
            {!book.cover_url && (
              <form action={refreshCover}>
                <input type="hidden" name="id" value={book.id} />
                <button className="rounded-full border border-[var(--border)] px-3 py-1 font-medium hover:bg-stone-500/10">
                  Kapağı otomatik bul
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-bold">Kitap Özeti</h2>
        <p className="mb-3 text-sm text-stone-500">
          Kitaptan aldığınız bilgileri buraya yazın — yazı tipini, boyutunu ve
          rengini ayarlayabilir, görsel ekleyebilirsiniz.
        </p>
        <BookEditor bookId={book.id} initialHtml={book.metadata?.summary ?? ""} />
      </div>
    </div>
  );
}
