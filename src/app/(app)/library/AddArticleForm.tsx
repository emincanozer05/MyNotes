"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addOwnArticle } from "./actions";

const inputCls =
  "w-full rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-lime-500";

/** Form for manually adding an article the user found themselves. */
export function AddArticleForm({ onAdded }: { onAdded?: () => void }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const res = await addOwnArticle(formData);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(true);
        formRef.current?.reset();
        router.refresh();
        onAdded?.();
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3">
      <input
        name="title"
        required
        placeholder="Makale başlığı *"
        className={inputCls}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          name="authors"
          placeholder="Yazarlar (virgülle ayır: Bompa T, Haff G)"
          className={inputCls}
        />
        <input name="journal" placeholder="Dergi" className={inputCls} />
        <input
          name="year"
          type="number"
          min={1900}
          max={2100}
          placeholder="Yıl"
          className={inputCls}
        />
        <input
          name="doi"
          placeholder="DOI (opsiyonel, 10.xxxx/…)"
          className={inputCls}
        />
      </div>
      <input
        name="topic"
        placeholder="Konu başlığı (örn. Kuvvet & Güç) — boşsa 'Diğer'"
        className={inputCls}
      />
      <textarea
        name="abstract"
        rows={3}
        placeholder="Özet (opsiyonel)"
        className={inputCls}
      />
      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className="rounded-full bg-lime-400 px-5 py-2 text-xs font-bold text-stone-900 transition-colors hover:bg-lime-300 disabled:opacity-50"
        >
          {pending ? "Ekleniyor…" : "Kütüphaneye Ekle"}
        </button>
        {error && (
          <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}
        {success && (
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            ✓ Eklendi — Kaydedilenler sekmesinde.
          </p>
        )}
      </div>
    </form>
  );
}
