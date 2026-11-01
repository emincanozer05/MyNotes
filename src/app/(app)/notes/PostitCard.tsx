"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteNote } from "./actions";
import {
  accentStyle,
  CardDeleteButton,
  ExpandedPostit,
  TagList,
  type PostitTag,
} from "./postitUi";

/** Strips tags and decodes the few entities stored notes use. */
function toText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Post-its saved from the PDF reader store the quote as
 * `<blockquote data-pdf-page="…">quote</blockquote>` (+ optional comment) and
 * a title that is just the quote's first 60 characters. They are rendered like
 * the other passage post-its: the quote, the source line and the tags.
 */
function parsePdfQuote(content: string): { quote: string; rest: string } | null {
  const m = /^\s*<blockquote data-pdf-page="\d+"[^>]*>([\s\S]*?)<\/blockquote>([\s\S]*)$/.exec(
    content,
  );
  if (!m) return null;
  const quote = toText(m[1]);
  return quote ? { quote, rest: m[2].trim() } : null;
}

export interface PostitData {
  id: string;
  title: string;
  content: string;
  category: string;
  source_title: string;
  source_author: string;
  source_year: number | null;
  /** Link back to the note's source, if it has one. */
  sourceHref: string | null;
  tags: PostitTag[];
  /** Fallback accent class for notes without a coloured tag. */
  cls: string;
  /** First coloured tag's colour; tints the card's accent bar over `cls`. */
  color: string | null;
}

export function PostitCard({ note }: { note: PostitData }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  const pdf = parsePdfQuote(note.content);
  // Content may be rich HTML; show a clean text preview on the card.
  const preview = toText(note.content);

  const sourceLine = note.source_title
    ? `${note.source_author}${note.source_year ? ` (${note.source_year})` : ""}${
        note.source_author || note.source_year ? " — " : ""
      }${note.source_title}`
    : "";

  function open() {
    setExpanded(true);
    // Warm the source page while the note is being read, so "Kaynağa git"
    // lands instantly.
    if (note.sourceHref) router.prefetch(note.sourceHref);
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
        className={`postit group ${note.color ? "" : note.cls}`}
        style={accentStyle(note.color)}
      >
        <form action={deleteNote} className="absolute right-1.5 top-1.5 z-10">
          <input type="hidden" name="id" value={note.id} />
          <CardDeleteButton
            title="Notu sil"
            onConfirm={() => window.confirm("Bu not silinsin mi?")}
          />
        </form>

        {pdf ? (
          <p className="flex-1 pr-5 text-[13px] leading-snug line-clamp-6">
            “{pdf.quote}”
          </p>
        ) : (
          <>
            <h3 className="pr-5 text-[13px] font-semibold leading-snug line-clamp-2">
              {note.title}
            </h3>
            {preview && (
              <p className="mt-1 flex-1 text-xs leading-snug text-[var(--muted)] line-clamp-4">
                {preview.slice(0, 180)}
              </p>
            )}
          </>
        )}
        <div className="mt-2.5 space-y-1">
          {sourceLine && (
            <p className="line-clamp-1 text-[11px] text-[var(--muted)]">{sourceLine}</p>
          )}
          <TagList tags={note.tags} max={3} />
        </div>
      </div>

      {expanded && (
        <ExpandedPostit
          accent={note.color}
          className={note.color ? "" : note.cls}
          onClose={() => setExpanded(false)}
          onGoToSource={
            note.sourceHref ? () => router.push(note.sourceHref!) : undefined
          }
        >
          {pdf ? (
            <>
              <p className="overflow-y-auto whitespace-pre-wrap pr-8 text-base leading-relaxed">
                “{pdf.quote}”
              </p>
              {pdf.rest && (
                <div
                  className="note-html mt-2 text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: pdf.rest }}
                />
              )}
            </>
          ) : (
            <>
              <h2 className="pr-8 text-lg font-semibold leading-snug">{note.title}</h2>
              <div
                className="note-html mt-2 overflow-y-auto pr-1 text-[11pt] leading-relaxed"
                dangerouslySetInnerHTML={{ __html: note.content || "<p>—</p>" }}
              />
            </>
          )}
          {(sourceLine || note.tags.length > 0) && (
            <div className="mt-3 space-y-1.5 border-t border-[var(--border)] pt-2.5">
              {sourceLine && <p className="text-xs text-[var(--muted)]">{sourceLine}</p>}
              <TagList tags={note.tags} size="lg" />
            </div>
          )}
        </ExpandedPostit>
      )}
    </>
  );
}
