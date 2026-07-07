"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { CATEGORIES, normalizeCategory } from "@/lib/categories";
import { COURSE_STATUSES, STATUS_META } from "@/lib/status";
import { addBook } from "./actions";

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500";

/** Compact top-right "add book" trigger that opens a centered modal form. */
export function AddBookModal({ category }: { category?: string }) {
  const defaultCategory = normalizeCategory(category);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [cover, setCover] = useState("");
  const [pending, startTransition] = useTransition();

  function reset() {
    setCover("");
    formRef.current?.reset();
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setCover(String(reader.result));
    reader.readAsDataURL(file);
  }

  function handleSubmit(fd: FormData) {
    // Uploaded image (data URL) takes precedence; else the typed URL is used.
    if (cover) fd.set("cover_url", cover);
    startTransition(async () => {
      await addBook(fd);
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-gradient shrink-0 rounded-full px-4 py-2 text-sm font-semibold"
      >
        + Kitap Ekle
      </button>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="add-book-title">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 id="add-book-title" className="text-lg font-bold">
              Kitap ekle
            </h2>
            <p className="mt-0.5 text-xs text-stone-500">
              Kapak, kitap adından otomatik bulunur — ya da kendiniz ekleyin.
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

        <form ref={formRef} action={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="bk-category" className="text-sm font-medium">
              Kategori *
            </label>
            <select
              id="bk-category"
              name="category"
              defaultValue={defaultCategory}
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
            <label htmlFor="bk-status" className="text-sm font-medium">
              Durum
            </label>
            <select id="bk-status" name="status" defaultValue="planned" className={inputCls}>
              {COURSE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
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
              value={cover.startsWith("data:") ? "" : cover}
              onChange={(e) => setCover(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Cover image upload */}
          <div className="flex items-center gap-3 sm:col-span-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold transition-colors hover:bg-stone-500/10"
            >
              🖼 Görsel ekle
            </button>
            {cover.startsWith("data:") && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover}
                alt="Kapak önizleme"
                className="h-16 w-11 rounded border border-[var(--border)] object-cover"
              />
            )}
            {cover.startsWith("data:") && (
              <button
                type="button"
                onClick={() => setCover("")}
                className="text-xs text-stone-400 hover:text-rose-500"
              >
                Kaldır
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </div>

          <div className="flex gap-2 sm:col-span-2">
            <button
              disabled={pending}
              className="btn-gradient rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {pending ? "Ekleniyor…" : "Rafa Ekle"}
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
