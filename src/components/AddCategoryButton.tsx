"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addCategory } from "@/app/(app)/categoriesActions";
import type { Category } from "@/lib/categories";

/**
 * "+" pill that sits at the end of the category tab row. Clicking it reveals an
 * inline input; submitting creates a user category (shared by the Bookshelf and
 * the Post-it board) and calls `onAdded` so the board can switch to it. The
 * router is refreshed so the freshly persisted category is reflected on the
 * other board too.
 */
export function AddCategoryButton({
  onAdded,
}: {
  onAdded: (category: Category) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  function close() {
    setOpen(false);
    setLabel("");
    setError(null);
  }

  async function submit() {
    const value = label.trim();
    if (!value) {
      setError("Kategori adı boş olamaz.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await addCategory(value);
    setSaving(false);
    if (res.error || !res.category) {
      setError(res.error ?? "Kategori eklenemedi.");
      return;
    }
    onAdded(res.category);
    close();
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Kategori ekle"
        title="Kategori ekle"
        className="flex items-center gap-1 rounded-full bg-stone-500/10 px-3 py-1.5 text-sm font-semibold text-stone-600 transition-colors hover:bg-stone-500/20 dark:text-stone-400"
      >
        <span className="text-base leading-none">+</span>
        Kategori
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            } else if (e.key === "Escape") {
              close();
            }
          }}
          placeholder="Yeni kategori…"
          maxLength={40}
          disabled={saving}
          className="w-40 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-500"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={saving}
          className="btn-gradient rounded-full px-3 py-1.5 text-sm font-semibold disabled:opacity-60"
        >
          {saving ? "…" : "Ekle"}
        </button>
        <button
          type="button"
          onClick={close}
          aria-label="Vazgeç"
          className="flex h-7 w-7 items-center justify-center rounded-full text-stone-500 hover:bg-stone-500/10"
        >
          ×
        </button>
      </div>
      {error && (
        <span className="text-xs text-rose-600 dark:text-rose-400">{error}</span>
      )}
    </div>
  );
}
