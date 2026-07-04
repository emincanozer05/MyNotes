"use client";

import { useEffect, useState } from "react";
import { addBook } from "./actions";

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500";

/** Compact top-right "add book" trigger that opens a centered modal form. */
export function AddBookModal() {
  const [open, setOpen] = useState(false);

  // Close on Escape and lock body scroll while the modal is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-gradient shrink-0 rounded-full px-4 py-2 text-sm font-semibold"
      >
        + Kitap Ekle
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="animate-pop glass-card relative z-10 w-full max-w-lg rounded-2xl p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold">Kitap ekle</h2>
                <p className="mt-0.5 text-xs text-stone-500">
                  Kapak, kitap adından otomatik bulunur.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Kapat"
                className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-stone-400 transition-colors hover:bg-stone-500/10 hover:text-stone-600"
              >
                ×
              </button>
            </div>

            <form
              action={async (fd) => {
                await addBook(fd);
                setOpen(false);
              }}
              className="grid gap-3 sm:grid-cols-2"
            >
              <div className="space-y-1 sm:col-span-2">
                <label htmlFor="bk-title" className="text-sm font-medium">
                  Kitap adı *
                </label>
                <input id="bk-title" name="title" required className={inputCls} />
              </div>
              <div className="space-y-1 sm:col-span-2">
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
                  <span className="font-normal text-stone-400">(boşsa otomatik)</span>
                </label>
                <input
                  id="bk-cover"
                  name="cover_url"
                  type="url"
                  placeholder="https://…"
                  className={inputCls}
                />
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <button className="btn-gradient rounded-full px-5 py-2 text-sm font-semibold">
                  Rafa Ekle
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
          </div>
        </div>
      )}
    </>
  );
}
