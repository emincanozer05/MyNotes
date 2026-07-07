"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { CATEGORIES, normalizeCategory } from "@/lib/categories";
import { COURSE_STATUSES, STATUS_META, normalizeStatus } from "@/lib/status";
import { updateBookInfo } from "../actions";

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500";

/**
 * "Düzelt" button on the book detail page: opens a modal pre-filled with the
 * book's info (title, authors, year, category) so typos can be fixed in place.
 * The cover keeps its own dedicated upload control next to the title.
 */
export function EditBookModal({
  book,
}: {
  book: {
    id: string;
    title: string;
    authors: string[];
    year: number | null;
    category: string;
    status: string;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(fd: FormData) {
    fd.set("id", book.id);
    setError(null);
    startTransition(async () => {
      const res = await updateBookInfo(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Kitap bilgilerini düzelt"
        className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium transition-colors hover:bg-stone-500/10"
      >
        ✎ Düzelt
      </button>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="edit-book-title">
        <div className="mb-4 flex items-start justify-between">
          <h2 id="edit-book-title" className="text-lg font-bold">
            Kitap bilgilerini düzelt
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Kapat"
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-stone-400 transition-colors hover:bg-stone-500/10 hover:text-stone-600"
          >
            ×
          </button>
        </div>

        <form action={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="eb-title" className="text-sm font-medium">
              Kitap adı *
            </label>
            <input
              id="eb-title"
              name="title"
              required
              defaultValue={book.title}
              className={inputCls}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="eb-authors" className="text-sm font-medium">
              Yazar(lar) *{" "}
              <span className="font-normal text-stone-400">(virgülle)</span>
            </label>
            <input
              id="eb-authors"
              name="authors"
              required
              defaultValue={book.authors.join(", ")}
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="eb-year" className="text-sm font-medium">
              Yıl
            </label>
            <input
              id="eb-year"
              name="year"
              type="number"
              defaultValue={book.year ?? ""}
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="eb-category" className="text-sm font-medium">
              Kategori
            </label>
            <select
              id="eb-category"
              name="category"
              defaultValue={normalizeCategory(book.category)}
              className={inputCls}
            >
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="eb-status" className="text-sm font-medium">
              Durum
            </label>
            <select
              id="eb-status"
              name="status"
              defaultValue={normalizeStatus(book.status)}
              className={inputCls}
            >
              {COURSE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-xs text-rose-600 dark:text-rose-400 sm:col-span-2">
              {error}
            </p>
          )}

          <div className="flex gap-2 sm:col-span-2">
            <button
              disabled={pending}
              className="btn-gradient rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {pending ? "Kaydediliyor…" : "Kaydet"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-[var(--border)] px-5 py-2 text-sm font-semibold transition-colors hover:bg-stone-500/10"
            >
              Vazgeç
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
