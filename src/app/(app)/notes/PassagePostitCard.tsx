"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deletePassageHighlight } from "./actions";
import { accentStyle, CardDeleteButton, ExpandedPostit, TagList } from "./postitUi";

export interface PassageData {
  key: string;
  text: string;
  tagName: string;
  tagColor: string | null;
  /** Every tag on the passage (a highlight can carry several). */
  tags: { name: string; color: string | null }[];
  sourceLabel: string;
  href: string;
  /** Source + location the highlight lives in, so it can be un-highlighted. */
  sourceId: string;
  /** Titled note id the passage sits in, or "" for the legacy summary. */
  noteRef: string;
  /** Passage index within its note/summary (extractTaggedPassages order). */
  passageIndex: number;
}

/**
 * A tagged passage promoted to a post-it. Clicking it opens the passage in a
 * centred panel with a "Kaynağa git" button that navigates to its source.
 */
export function PassagePostitCard({ passage }: { passage: PassageData }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  function open() {
    setExpanded(true);
    // Warm the source page so "Kaynağa git" lands instantly.
    router.prefetch(passage.href.split("#")[0]);
  }

  return (
    <>
      <div
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter") open();
        }}
        role="button"
        tabIndex={0}
        className="postit group"
        style={accentStyle(passage.tagColor)}
      >
        {/* Delete — un-highlights the passage in its source. */}
        <form
          action={deletePassageHighlight}
          className="absolute right-1.5 top-1.5 z-10"
        >
          <input type="hidden" name="sourceId" value={passage.sourceId} />
          <input type="hidden" name="noteRef" value={passage.noteRef} />
          <input type="hidden" name="index" value={passage.passageIndex} />
          <CardDeleteButton
            title="Vurguyu kaldır"
            onConfirm={() =>
              window.confirm("Bu vurgu kaldırılsın mı? (metin kaynakta kalır)")
            }
          />
        </form>

        <p className="flex-1 whitespace-pre-wrap pr-5 text-[13px] leading-snug line-clamp-6">
          “{passage.text}”
        </p>
        <div className="mt-2.5 space-y-1">
          <p className="line-clamp-1 text-[11px] text-[var(--muted)]">
            {passage.sourceLabel}
          </p>
          <TagList tags={passage.tags} max={3} />
        </div>
      </div>

      {expanded && (
        <ExpandedPostit
          accent={passage.tagColor}
          onClose={() => setExpanded(false)}
          onGoToSource={() => router.push(passage.href)}
        >
          <p className="overflow-y-auto whitespace-pre-wrap pr-8 text-base leading-relaxed">
            “{passage.text}”
          </p>
          <div className="mt-3 space-y-1.5 border-t border-[var(--border)] pt-2.5">
            <p className="text-xs text-[var(--muted)]">{passage.sourceLabel}</p>
            <TagList tags={passage.tags} size="lg" />
          </div>
        </ExpandedPostit>
      )}
    </>
  );
}
