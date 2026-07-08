"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { pastelize } from "@/lib/color";
import { deletePassageHighlight } from "./actions";

export interface PassageData {
  key: string;
  text: string;
  tagName: string;
  tagColor: string | null;
  /** Every tag on the passage (a highlight can carry several). */
  tags: { name: string; color: string | null }[];
  sourceLabel: string;
  href: string;
  tilt: string;
  /** Source + location the highlight lives in, so it can be un-highlighted. */
  sourceId: string;
  /** Titled note id the passage sits in, or "" for the legacy summary. */
  noteRef: string;
  /** Passage index within its note/summary (extractTaggedPassages order). */
  passageIndex: number;
}

/**
 * A tagged passage promoted to a post-it. Clicking it grows the post-it to the
 * centre of the screen over a blurred backdrop, with a "Kaynağa git" button
 * that navigates to the passage's source.
 */
export function PassagePostitCard({ passage }: { passage: PassageData }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const bg = pastelize(passage.tagColor);

  useEffect(() => {
    if (!expanded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setExpanded(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded]);

  return (
    <>
      <div
        onClick={() => setExpanded(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") setExpanded(true);
        }}
        role="button"
        tabIndex={0}
        className="postit group"
        style={{ transform: `rotate(${passage.tilt})`, background: bg }}
      >
        <span className="postit-pin" aria-hidden />

        {/* Delete (top-right X) — un-highlights the passage in its source. */}
        <form
          action={deletePassageHighlight}
          className="absolute right-1.5 top-1.5 z-10"
        >
          <input type="hidden" name="sourceId" value={passage.sourceId} />
          <input type="hidden" name="noteRef" value={passage.noteRef} />
          <input type="hidden" name="index" value={passage.passageIndex} />
          <button
            type="submit"
            title="Vurguyu kaldır"
            aria-label="Vurguyu kaldır"
            onClick={(e) => {
              e.stopPropagation();
              if (!window.confirm("Bu vurgu kaldırılsın mı? (metin kaynakta kalır)"))
                e.preventDefault();
            }}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-xs font-bold leading-none text-stone-700/70 opacity-0 transition-all hover:bg-rose-500 hover:text-white group-hover:opacity-100"
          >
            ×
          </button>
        </form>

        <span className="ml-3.5 flex flex-wrap gap-1 self-start">
          {passage.tags.map((t) => (
            <span
              key={t.name}
              className="rounded-full px-2 py-0.5 text-[9px] font-semibold text-white"
              style={{ background: t.color ?? "#78716c" }}
            >
              <span className="opacity-70"># </span>
              {t.name}
            </span>
          ))}
        </span>
        <p className="mt-2 flex-1 whitespace-pre-wrap text-[12px] font-medium leading-snug line-clamp-6">
          “{passage.text}”
        </p>
        <p className="mt-2 line-clamp-1 text-[10px] italic opacity-70">
          {passage.sourceLabel}
        </p>
      </div>

      {expanded && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setExpanded(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="postit-expand postit relative flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden"
            style={{ background: bg }}
          >
            <span className="postit-pin" aria-hidden />
            <button
              type="button"
              onClick={() => setExpanded(false)}
              title="Kapat"
              aria-label="Kapat"
              className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/10 text-base font-bold leading-none text-stone-700/80 transition-colors hover:bg-black/20"
            >
              ×
            </button>

            <span className="ml-3.5 flex flex-wrap gap-1.5 self-start">
              {passage.tags.map((t) => (
                <span
                  key={t.name}
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
                  style={{ background: t.color ?? "#78716c" }}
                >
                  <span className="opacity-70"># </span>
                  {t.name}
                </span>
              ))}
            </span>
            <p className="mt-3 overflow-y-auto whitespace-pre-wrap pr-1 text-lg font-medium leading-relaxed">
              “{passage.text}”
            </p>
            <p className="mt-3 border-t border-black/10 pt-2.5 text-xs italic opacity-70">
              {passage.sourceLabel}
            </p>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              router.push(passage.href);
            }}
            className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
          >
            Kaynağa git →
          </button>
        </div>
      )}
    </>
  );
}
