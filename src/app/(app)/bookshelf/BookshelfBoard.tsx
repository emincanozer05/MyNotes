"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LinkPendingOverlay } from "@/components/LinkPending";
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
import { PageHeader } from "@/components/PageHeader";

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
    <div className="space-y-5">
      <PageHeader
        title="Kitap Rafı"
        description={`${categoryLabel(category, categories)} rafı — her kitap için zengin metin özeti yaz, görsel ekle.`}
        actions={<AddBookModal category={category} categories={categories} />}
      />

      {/* Kategori sekmeleri */}
      <div className="cat-tabs">
        {categories.map((c) => {
          const active = c.slug === category;
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => switchCategory(c.slug)}
              aria-pressed={active}
              className="cat-tab"
            >
              <CategoryIcon slug={c.slug} />
              {c.label}
            </button>
          );
        })}
        <AddCategoryButton onAdded={handleAdded} />
      </div>

      {shown.length > 0 ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {shown.map((b) => {
            const status = STATUS_META[b.status];
            return (
              <div key={b.id} className="group relative flex flex-col">
                <form action={deleteBook} className="absolute right-1.5 top-1.5 z-10">
                  <input type="hidden" name="id" value={b.id} />
                  <ConfirmSubmit
                    ariaLabel="Kitabı sil"
                    title="Sil"
                    message={`"${b.title}" kitabı ve notları silinsin mi?`}
                    className="flex h-6 w-6 items-center justify-center rounded-md bg-black/40 text-sm leading-none text-white/90 touch-show opacity-0 transition-all hover:bg-rose-500 hover:text-white group-hover:opacity-100"
                  >
                    ×
                  </ConfirmSubmit>
                </form>

                <Link
                  href={`/bookshelf/${b.id}`}
                  className="relative block"
                >
                  <LinkPendingOverlay />
                  {b.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.cover_url}
                      alt={`${b.title} kapağı`}
                      className="aspect-[2/3] w-full rounded-md border border-[var(--border)] object-cover transition-[filter] group-hover:brightness-95"
                    />
                  ) : (
                    <div
                      className={`flex aspect-[2/3] w-full items-center justify-center rounded-md p-2 text-center ${b.spineCls}`}
                    >
                      <span className="line-clamp-5 text-[11px] font-semibold leading-tight text-white">
                        {b.title}
                      </span>
                    </div>
                  )}
                </Link>

                <Link href={`/bookshelf/${b.id}`} className="mt-2 min-w-0">
                  <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug group-hover:text-[var(--accent-text)]">
                    {b.title}
                  </h3>
                </Link>
                <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--muted)]">
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${status.dot}`}
                    title={status.label}
                    aria-label={status.label}
                  />
                  <span className="truncate">
                    {b.authors.join(", ") || status.label}
                    {b.year ? ` · ${b.year}` : ""}
                  </span>
                </p>
                {b.noteCount > 0 && (
                  <Link
                    href={`/notes?source=${b.id}`}
                    className="mt-0.5 w-fit text-[11px] text-[var(--muted)] hover:text-[var(--accent-text)]"
                  >
                    {b.noteCount} not
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-[var(--border-strong)] p-10 text-center text-sm text-[var(--muted)]">
          Bu rafta henüz kitap yok. Sağ üstteki{" "}
          <b className="text-amber-600">+ Kitap Ekle</b> ile ekleyin.
        </p>
      )}
    </div>
  );
}
