"use client";

import { useState } from "react";
import { saveBookLink } from "../actions";

/**
 * External link for a book, rendered as a button under the cover. Clicking the
 * button opens the saved URL in a new tab; the pencil lets you set or change it.
 */
export function BookLink({
  bookId,
  initial,
}: {
  bookId: string;
  initial: string;
}) {
  const [url, setUrl] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = draft.trim();
    setSaving(true);
    const res = await saveBookLink(bookId, trimmed);
    setSaving(false);
    if (!res?.error) {
      // Reflect the server-side normalization (scheme prepended if missing).
      setUrl(trimmed && !/^https?:\/\//i.test(trimmed) ? `https://${trimmed}` : trimmed);
      setEditing(false);
    }
  }

  if (editing) {
    return (
      <div className="w-28 space-y-1.5">
        <input
          type="url"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
            if (e.key === "Escape") {
              setDraft(url);
              setEditing(false);
            }
          }}
          placeholder="https://…"
          className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs outline-none"
        />
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="flex-1 rounded-md bg-[var(--brand-1)] px-2 py-1 text-[11px] font-semibold text-white transition-[filter] hover:brightness-105 disabled:opacity-60"
          >
            {saving ? "…" : "Kaydet"}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(url);
              setEditing(false);
            }}
            className="rounded-md border border-[var(--border)] px-2 py-1 text-[11px] font-medium transition-colors hover:bg-stone-500/10"
          >
            İptal
          </button>
        </div>
      </div>
    );
  }

  if (!url) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft("");
          setEditing(true);
        }}
        className="w-28 rounded-md border border-dashed border-[var(--border)] px-2 py-1.5 text-xs font-medium text-stone-500 transition-colors hover:bg-stone-500/10"
      >
        🔗 Link ekle
      </button>
    );
  }

  return (
    <div className="flex w-28 items-center gap-1">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={url}
        className="flex-1 truncate rounded-md bg-[var(--brand-1)] px-2 py-1.5 text-center text-xs font-semibold text-white transition-[filter] hover:brightness-105"
      >
        🔗 Link
      </a>
      <button
        type="button"
        onClick={() => {
          setDraft(url);
          setEditing(true);
        }}
        title="Linki düzenle"
        className="rounded-md border border-[var(--border)] px-1.5 py-1.5 text-xs transition-colors hover:bg-stone-500/10"
      >
        ✎
      </button>
    </div>
  );
}
