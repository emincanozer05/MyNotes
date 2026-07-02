"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addHighlight } from "../actions";

/**
 * Wraps note content; selecting a passage shows a floating
 * "add to highlights" button.
 */
export function HighlightCapture({
  noteId,
  children,
}: {
  noteId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);
  const [selection, setSelection] = useState<{
    text: string;
    top: number;
    left: number;
  } | null>(null);

  function handleMouseUp() {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (!sel || sel.rangeCount === 0 || text.length < 3) {
      setSelection(null);
      return;
    }
    const range = sel.getRangeAt(0);
    if (!containerRef.current?.contains(range.commonAncestorContainer)) {
      setSelection(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    setSelection({ text, top: rect.top - 44, left: rect.left });
  }

  async function saveHighlight() {
    if (!selection) return;
    setPending(true);
    await addHighlight(noteId, selection.text);
    setPending(false);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
    router.refresh();
  }

  return (
    <div ref={containerRef} onMouseUp={handleMouseUp} className="relative">
      {children}
      {selection && (
        <button
          onClick={saveHighlight}
          disabled={pending}
          style={{ position: "fixed", top: selection.top, left: selection.left }}
          className="z-50 rounded-md bg-stone-900 dark:bg-stone-100 px-3 py-1.5 text-xs font-semibold text-white dark:text-stone-900 shadow-lg disabled:opacity-50"
        >
          {pending ? "Ekleniyor…" : "❝ Alıntıya ekle"}
        </button>
      )}
    </div>
  );
}
