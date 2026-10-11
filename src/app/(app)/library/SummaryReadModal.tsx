"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";

/** "Özeti oku" — opens the saved summary in a centered, blurred-backdrop modal. */
export function SummaryReadModal({
  html,
  title,
  label = "📖 Özeti oku",
  className = "btn-ghost rounded-full px-4 py-2 text-sm font-semibold",
  loadHtml,
}: {
  html: string;
  title?: string;
  label?: string;
  /** Trigger button styling — callers size it to their surrounding row. */
  className?: string;
  /**
   * Loads the full summary on open. Lists pass an image-stripped `html` for
   * a light payload and fetch the complete one (with images) only when read.
   */
  loadHtml?: () => Promise<string>;
}) {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState<string | null>(null);
  const hasContent = Boolean(html && html.replace(/<[^>]*>/g, "").trim());

  function handleOpen() {
    setOpen(true);
    if (loadHtml && full === null) {
      loadHtml()
        .then((h) => setFull(h || html))
        .catch(() => setFull(html));
    }
  }

  // Show the light copy instantly; swap in the full one when it arrives.
  const shown = full ?? html;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={!hasContent}
        className={`${className} disabled:opacity-50`}
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
          dangerouslySetInnerHTML={{ __html: shown }}
        />
      </Modal>
    </>
  );
}
