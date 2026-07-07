"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createQuickNote } from "./actions";
import {
  createOrGetTag,
  getUserTags,
  type UserTag,
} from "@/app/(app)/tagsActions";
import { TAG_COLOR_SWATCHES } from "@/lib/color";

/**
 * "+ Yeni Not" trigger + quick-capture modal. Opens a centred card over a
 * blurred backdrop; nothing is saved while typing. The note is written only
 * when the user clicks "Yapıştır", after which it appears on the board.
 * Below the note body, existing tags can be toggled and new ones created.
 */
export function NewPostitButton({ category }: { category?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Tagging
  const [tags, setTags] = useState<UserTag[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLOR_SWATCHES[0]);

  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 40);
      void getUserTags(category).then(setTags);
    }
  }, [open, category]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function close() {
    setOpen(false);
    setTitle("");
    setContent("");
    setError(null);
    setSelectedIds([]);
    setNewTagName("");
  }

  function toggleTag(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function addNewTag() {
    const name = newTagName.trim();
    if (!name) return;
    const res = await createOrGetTag(name, newTagColor, category);
    if (res.tag) {
      const created = res.tag;
      setTags((prev) =>
        prev.some((t) => t.id === created.id)
          ? prev
          : [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "tr")),
      );
      setSelectedIds((prev) =>
        prev.includes(created.id) ? prev : [...prev, created.id],
      );
      setNewTagName("");
    }
  }

  async function paste() {
    if (!content.trim()) {
      setError("Yapıştırmadan önce bir şeyler yazın.");
      return;
    }
    setSaving(true);
    setError(null);
    const tagNames = tags
      .filter((t) => selectedIds.includes(t.id))
      .map((t) => t.name)
      .join(", ");
    const res = await createQuickNote({ title, content, tags: tagNames, category });
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    close();
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-gradient shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold"
      >
        + Yeni Not
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-md"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Yeni Post-it</h2>
              <button
                type="button"
                onClick={close}
                aria-label="Kapat"
                className="flex h-7 w-7 items-center justify-center rounded-full text-stone-500 hover:bg-stone-500/10"
              >
                ×
              </button>
            </div>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Başlık (isteğe bağlı)"
              className="mb-2 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-semibold outline-none"
            />
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Notunu buraya yaz…"
              rows={6}
              className="w-full resize-none rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none"
            />

            {/* Etiket ekle */}
            <div className="mt-3 border-t border-[var(--border)] pt-3">
              <p className="mb-1.5 text-xs font-semibold text-stone-500 dark:text-stone-400">
                Etiket ekle
              </p>

              {tags.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {tags.map((t) => {
                    const on = selectedIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleTag(t.id)}
                        className="rounded-full px-2.5 py-0.5 text-xs font-medium transition-all"
                        style={
                          on
                            ? { background: t.color ?? "#78716c", color: "#fff" }
                            : {
                                border: `1px solid ${t.color ?? "#78716c"}`,
                                color: t.color ?? "#78716c",
                              }
                        }
                      >
                        {on ? "✓ " : ""}
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <div className="flex shrink-0 gap-1">
                  {TAG_COLOR_SWATCHES.slice(0, 6).map((c) => (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      onClick={() => setNewTagColor(c)}
                      className={`h-5 w-5 rounded-full ${
                        newTagColor === c ? "ring-2 ring-offset-1 ring-stone-500" : ""
                      }`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
                <input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void addNewTag();
                    }
                  }}
                  placeholder="Yeni etiket…"
                  className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs outline-none"
                />
                <button
                  type="button"
                  onClick={() => void addNewTag()}
                  className="shrink-0 rounded-md border border-[var(--border)] px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-stone-500/10"
                >
                  Ekle
                </button>
              </div>
            </div>

            {error && (
              <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>
            )}

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => void paste()}
                disabled={saving}
                className="btn-gradient rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {saving ? "Yapıştırılıyor…" : "Yapıştır"}
              </button>
              <button
                type="button"
                onClick={close}
                className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-stone-500/10"
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
