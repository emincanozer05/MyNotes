"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createQuickNote } from "./actions";

/**
 * "+ Yeni Not" trigger + quick-capture modal. Opens a centred card over a
 * blurred backdrop; nothing is saved while typing. The note is written only
 * when the user clicks "Yapıştır", after which it appears on the board.
 */
export function NewPostitButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 40);
    }
  }, [open]);

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
  }

  async function paste() {
    if (!content.trim()) {
      setError("Yapıştırmadan önce bir şeyler yazın.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await createQuickNote({ title, content });
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
              rows={7}
              className="w-full resize-none rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm outline-none"
            />

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
