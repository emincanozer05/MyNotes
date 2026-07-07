"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { pastelize } from "@/lib/color";

export interface PassageData {
  key: string;
  text: string;
  tagName: string;
  tagColor: string | null;
  sourceLabel: string;
  href: string;
  tilt: string;
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
        <span
          className="ml-3.5 self-start rounded-full px-2 py-0.5 text-[9px] font-semibold text-white"
          style={{ background: passage.tagColor ?? "#78716c" }}
        >
          <span className="opacity-70"># </span>
          {passage.tagName}
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

            <span
              className="ml-3.5 self-start rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
              style={{ background: passage.tagColor ?? "#78716c" }}
            >
              <span className="opacity-70"># </span>
              {passage.tagName}
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
