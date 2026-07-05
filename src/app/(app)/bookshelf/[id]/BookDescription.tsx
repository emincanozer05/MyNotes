"use client";

import { useState } from "react";
import { saveBookDescription } from "../actions";

/** Short free-text description shown under the book's title/author/year. */
export function BookDescription({
  bookId,
  initial,
}: {
  bookId: string;
  initial: string;
}) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);

  const dirty = value.trim() !== saved.trim();

  async function save() {
    setSaving(true);
    const res = await saveBookDescription(bookId, value);
    setSaving(false);
    if (!res?.error) setSaved(value);
  }

  return (
    <div className="mt-3">
      <label className="text-xs font-semibold text-stone-500 dark:text-stone-400">
        Açıklama
      </label>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Kitap hakkında kısa bilgi…"
        rows={3}
        className="mt-1 w-full resize-y rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none"
      />
      {dirty && (
        <div className="mt-1.5 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-full bg-[var(--brand-1)] px-3 py-1 text-xs font-semibold text-white transition-[filter] hover:brightness-105 disabled:opacity-60"
          >
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
          <button
            type="button"
            onClick={() => setValue(saved)}
            className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium transition-colors hover:bg-stone-500/10"
          >
            Geri al
          </button>
        </div>
      )}
    </div>
  );
}
