"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CATEGORIES,
  categoryLabel,
  normalizeCategory,
  type Category,
} from "@/lib/categories";
import { STATUS_META, type CourseStatus } from "@/lib/status";
import { CategoryIcon } from "@/components/CategoryIcon";
import { AddCategoryButton } from "@/components/AddCategoryButton";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { deleteBook } from "./actions";
import { AddBookModal } from "./AddBookModal";

export interface BookCardData {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  cover_url: string | null;
  category: string;
  status: CourseStatus;
  noteCount: number;
  spineCls: string;
}

/**
 * Client-side bookshelf board: all books arrive pre-fetched, so switching
 * category tabs filters instantly instead of round-tripping to the server.
 * The URL query is kept in sync for shareable/back-button-friendly links.
 */
export function BookshelfBoard({
  books,
  initialCategory,
  categories: initialCategories = CATEGORIES,
}: {
  books: BookCardData[];
  initialCategory: string;
  categories?: readonly Category[];
}) {
  const [category, setCategory] = useState(normalizeCategory(initialCategory));
  // Optimistically-added categories are merged with the server list so a new
  // tab shows instantly; router.refresh() then reconciles the two.
  const [added, setAdded] = useState<Category[]>([]);
  const categories = useMemo(() => {
    const seen = new Set<string>();
    const out: Category[] = [];
    for (const c of [...initialCategories, ...added]) {
      if (!seen.has(c.slug)) {
        seen.add(c.slug);
        out.push(c);
      }
    }
    return out;
  }, [initialCategories, added]);

  function switchCategory(slug: string) {
    setCategory(slug);
    window.history.replaceState(null, "", `/bookshelf?category=${slug}`);
  }

  function handleAdded(c: Category) {
    setAdded((prev) => (prev.some((x) => x.slug === c.slug) ? prev : [...prev, c]));
    switchCategory(c.slug);
  }

  const shown = books.filter((b) => b.category === category);

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">
            <span className="gradient-text">Kitap Rafı</span>
          </h1>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
            {categoryLabel(category, categories)} rafı — her kategorinin kitapları
            ayrı tutulur. Her kitap için zengin metin özeti yazın, görsel ekleyin.
          </p>
        </div>
        <AddBookModal category={category} categories={categories} />
      </div>

      {/* Kategori sekmeleri */}
      <div className="flex flex-wrap items-center gap-1.5">
        {categories.map((c) => {
          const active = c.slug === category;
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => switchCategory(c.slug)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                active
                  ? "bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow"
                  : "bg-stone-500/10 text-stone-600 hover:bg-stone-500/20 dark:text-stone-400"
              }`}
            >
              <CategoryIcon slug={c.slug} />
              {c.label}
            </button>
          );
        })}
        <AddCategoryButton onAdded={handleAdded} />
      </div>

      {shown.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {shown.map((b) => {
            const status = STATUS_META[b.status];
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
                      className={`flex aspect-[2/3] w-full items-center justify-center rounded-lg bg-gradient-to-br p-2 text-center shadow-md transition-transform group-hover:scale-[1.03] ${b.spineCls}`}
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
                    {/* Kitabın türü (kategorisi) ve okuma durumu */}
                    <span className="flex items-center gap-1 rounded-full bg-stone-500/10 px-1.5 py-0.5 text-[10px] font-medium text-stone-600 dark:text-stone-400">
                      <CategoryIcon slug={b.category} className="h-2.5 w-2.5" />
                      {categoryLabel(b.category, categories)}
                    </span>
                    <span
                      className={`flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${status.pill}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                      {status.label}
                    </span>
                    {b.noteCount > 0 && (
                      <Link
                        href={`/notes?source=${b.id}`}
                        className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-500/25 dark:text-amber-400"
                      >
                        {b.noteCount} not
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
          Bu rafta henüz kitap yok. Sağ üstteki{" "}
          <b className="text-amber-600">+ Kitap Ekle</b> ile ekleyin.
        </p>
      )}
    </div>
  );
}
