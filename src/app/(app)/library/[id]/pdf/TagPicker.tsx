"use client";

import { useState } from "react";
import { TAG_COLOR_SWATCHES } from "@/lib/color";
import { categoryLabel } from "@/lib/categories";
import { createOrGetTag, deleteTag, type UserTag } from "../../../tagsActions";

/**
 * Tag panel shared with the note editor's look: coloured tag pills, colour
 * palette, "new tag" input. Picking (or creating) a tag calls `onPick(name)`.
 */
export function TagPicker({
  tags,
  setTags,
  category,
  onPick,
  onBack,
}: {
  tags: UserTag[];
  setTags: React.Dispatch<React.SetStateAction<UserTag[]>>;
  category: string;
  onPick: (tagName: string) => void | Promise<void>;
  onBack?: () => void;
}) {
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState<string>(TAG_COLOR_SWATCHES[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createAndPick() {
    const name = newTagName.trim();
    if (!name || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await createOrGetTag(name, newTagColor, category);
      if (!res.tag) {
        setError(res.error ?? "Etiket oluşturulamadı.");
        return;
      }
      const created = res.tag;
      setTags((prev) =>
        prev.some((t) => t.id === created.id)
          ? prev
          : [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "tr")),
      );
      await onPick(created.name);
    } finally {
      setBusy(false);
    }
  }

  async function removeTag(tagId: string) {
    if (!window.confirm("Bu etiket tamamen silinsin mi? Tüm notlardan kaldırılır.")) return;
    await deleteTag(tagId);
    setTags((prev) => prev.filter((t) => t.id !== tagId));
  }

  return (
    <div className="w-72 max-w-[calc(100vw-2rem)] p-1.5">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-stone-400">
        {categoryLabel(category)} etiketleri
      </p>
      {tags.length > 0 && (
        <div className="mb-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto pr-1.5 pt-1.5">
          {tags.map((t) => (
            <span key={t.id} className="relative inline-flex">
              <button
                type="button"
                onClick={() => void onPick(t.name)}
                title="Bu etiketi seç"
                className="rounded-full px-2 py-0.5 text-xs font-medium text-white shadow-sm"
                style={{ background: t.color ?? "#78716c" }}
              >
                {t.name}
              </button>
              <button
                type="button"
                onClick={() => void removeTag(t.id)}
                title="Etiketi sil"
                aria-label={`${t.name} etiketini sil`}
                className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-[var(--surface)] bg-stone-500 text-[9px] leading-none text-white hover:bg-rose-600"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="mb-1.5 flex flex-wrap gap-1 border-t border-[var(--border)] pt-2">
        {TAG_COLOR_SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => setNewTagColor(c)}
            className={`h-5 w-5 rounded-full ${newTagColor === c ? "ring-2 ring-stone-500 ring-offset-1" : ""}`}
            style={{ background: c }}
          />
        ))}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <input
            type="color"
            value={newTagColor}
            onChange={(e) => setNewTagColor(e.target.value)}
            className="h-7 w-7 shrink-0 cursor-pointer border-0 bg-transparent p-0"
            title="Özel renk"
          />
          <input
            autoFocus
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void createAndPick();
              }
            }}
            placeholder="Yeni etiket adı…"
            className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-transparent px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <button
          type="button"
          disabled={busy || !newTagName.trim()}
          onClick={() => void createAndPick()}
          className="w-full rounded-md bg-stone-900 px-2 py-1.5 text-xs font-semibold text-white disabled:opacity-60 dark:bg-stone-100 dark:text-stone-900"
        >
          {busy ? "Oluşturuluyor…" : "Etiket oluştur"}
        </button>
        {error && (
          <p className="text-[11px] leading-snug text-rose-600 dark:text-rose-400">{error}</p>
        )}
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="w-full text-[11px] text-stone-500 hover:underline"
          >
            ← Geri
          </button>
        )}
      </div>
    </div>
  );
}
