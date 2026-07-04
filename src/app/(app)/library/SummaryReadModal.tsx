"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";

/** "Özeti oku" — opens the saved summary in a centered, blurred-backdrop modal. */
export function SummaryReadModal({
  html,
  title,
  label = "📖 Özeti oku",
}: {
  html: string;
  title?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const hasContent = Boolean(html && html.replace(/<[^>]*>/g, "").trim());

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!hasContent}
        className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold transition-colors hover:bg-amber-500/10 disabled:opacity-50"
        title={hasContent ? "Özeti oku" : "Önce bir özet yazıp kaydet"}
      >
        {label}
      </button>

      <Modal open={open} onClose={() => setOpen(false)} maxWidth="max-w-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold italic">{title ?? "Özet"}</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Kapat"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg text-stone-400 transition-colors hover:bg-stone-500/10 hover:text-stone-600"
          >
            ×
          </button>
        </div>
        <div
          className="rte max-h-[70vh] overflow-y-auto pr-1 text-[15px]"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </Modal>
    </>
  );
}
