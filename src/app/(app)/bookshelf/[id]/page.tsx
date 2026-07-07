import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CoverUpload } from "./CoverUpload";
import { BookDescription } from "./BookDescription";
import { TitledNotes } from "@/components/TitledNotes";
import type { TitledNote } from "@/app/(app)/sourceNotesActions";
import { refreshCover } from "../actions";

interface BookRow {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  cover_url: string | null;
  category: string;
  metadata: { summary?: string; description?: string; notes?: TitledNote[] } | null;
}

/** Uses saved titled notes, or seeds one from a legacy single summary. */
function seedNotes(meta: BookRow["metadata"]): TitledNote[] {
  if (Array.isArray(meta?.notes)) return meta.notes;
  const s = meta?.summary ?? "";
  return s.replace(/<[^>]*>/g, "").trim()
    ? [{ id: "legacy", title: "Özet", html: s }]
    : [];
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
      .select("id, title, authors, year, cover_url, category, metadata")
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
      <Link
        href={`/bookshelf?category=${book.category}`}
        className="text-sm text-stone-500 hover:text-amber-600"
      >
        ← Kitap Rafı
      </Link>

      <div className="glass-card flex gap-5 rounded-2xl p-5">
        <CoverUpload
          bookId={book.id}
          coverUrl={book.cover_url}
          title={book.title}
        />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-tight">{book.title}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {book.authors.join(", ")}
            {book.year ? ` · ${book.year}` : ""}
          </p>
          <BookDescription
            bookId={book.id}
            initial={book.metadata?.description ?? ""}
          />
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
        <h2 className="mb-2 text-lg font-bold">Kitap Notları</h2>
        <p className="mb-3 text-sm text-stone-500">
          Her başlık için ayrı bir not tut — yazı tipini, boyutunu ve rengini
          ayarlayabilir, görsel ekleyebilirsin. Sağ üstten A4 çıktısı alabilirsin.
        </p>
        <TitledNotes
          sourceId={book.id}
          initialNotes={seedNotes(book.metadata)}
          printHref={`/print/${book.id}`}
          tagCategory={book.category}
        />
      </div>
    </div>
  );
}
