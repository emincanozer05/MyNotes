"use client";

import { Icon } from "@/components/Icon";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteNote } from "./actions";

interface Tag {
  name: string;
  color?: string | null;
}

/**
 * Post-its saved from the PDF reader store the quote as
 * `<blockquote data-pdf-page="…">quote</blockquote>` (+ optional comment) and
 * a title that is just the quote's first 60 characters. They are rendered like
 * the other passage post-its: tag chips, the quote, the source line.
 */
function parsePdfQuote(content: string): { quote: string; rest: string } | null {
  const m = /^\s*<blockquote data-pdf-page="\d+"[^>]*>([\s\S]*?)<\/blockquote>([\s\S]*)$/.exec(
    content,
  );
  if (!m) return null;
  const quote = m[1]
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
  return quote ? { quote, rest: m[2].trim() } : null;
}

function TagChips({ tags, size }: { tags: Tag[]; size: "sm" | "lg" }) {
  if (tags.length === 0) return null;
  return (
    <span className={`ml-3.5 flex flex-wrap self-start ${size === "lg" ? "gap-1.5" : "gap-1"}`}>
      {tags.map((t) => (
        <span
          key={t.name}
          className={`rounded-full font-semibold text-white ${
            size === "lg" ? "px-2.5 py-0.5 text-[11px]" : "px-2 py-0.5 text-[9px]"
          }`}
          style={{ background: t.color ?? "#78716c" }}
        >
          {t.name}
        </span>
      ))}
    </span>
  );
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
  tags: Tag[];
  cls: string;
  tilt: string;
  /** Soft pastel colour derived from a tagged passage's tag; overrides `cls`. */
  color: string | null;
}

export function PostitCard({ note }: { note: PostitData }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);

  // Content may be rich HTML; show a clean text preview on the card.
  const preview = note.content
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const pdf = parsePdfQuote(note.content);

  const sourceLine = note.source_title
    ? `${note.source_author}${note.source_year ? ` (${note.source_year})` : ""}${
        note.source_author || note.source_year ? " — " : ""
      }${note.source_title}`
    : "";

  // Close the expanded view on Escape.
  useEffect(() => {
    if (!expanded) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setExpanded(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded]);

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
        className={`postit group ${note.cls}`}
        style={{
          transform: `rotate(${note.tilt})`,
          ...(note.color ? { background: note.color } : {}),
        }}
      >
        <span className="postit-pin" aria-hidden />

        {/* Delete (top-right X) */}
        <form action={deleteNote} className="absolute right-1.5 top-1.5 z-10">
          <input type="hidden" name="id" value={note.id} />
          <button
            type="submit"
            title="Notu sil"
            aria-label="Notu sil"
            onClick={(e) => {
              e.stopPropagation();
              if (!window.confirm("Bu not silinsin mi?")) e.preventDefault();
            }}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-xs font-bold leading-none text-stone-700/70 touch-show opacity-0 transition-all hover:bg-rose-500 hover:text-white group-hover:opacity-100"
          >
            ×
          </button>
        </form>

        {pdf ? (
          <>
            <TagChips tags={note.tags} size="sm" />
            <p className="mt-2 flex-1 whitespace-pre-wrap text-[12px] font-medium leading-snug line-clamp-6">
              “{pdf.quote}”
            </p>
            {sourceLine && (
              <p className="mt-2 line-clamp-1 text-[10px] italic opacity-70">{sourceLine}</p>
            )}
          </>
        ) : (
          <>
            <h3 className="pl-3.5 pr-5 text-[13px] font-bold leading-snug line-clamp-2">
              {note.title}
            </h3>
            {preview && (
              <p className="mt-1.5 flex-1 whitespace-pre-wrap text-[11px] leading-snug line-clamp-4 opacity-90">
                {preview.slice(0, 160)}
              </p>
            )}
            <div className="mt-2 space-y-1">
              {sourceLine && (
                <p className="line-clamp-1 text-[10px] italic opacity-70">{sourceLine}</p>
              )}
              {note.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {note.tags.slice(0, 3).map((t) => (
                    <span
                      key={t.name}
                      className="rounded-full bg-black/10 px-1.5 py-0.5 text-[9px] font-medium"
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Expanded, centered view with a blurred backdrop. */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/50 p-4 backdrop-blur-xl"
          onClick={() => setExpanded(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`postit-expand postit ${note.color ? "" : note.cls} relative flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden`}
            style={note.color ? { background: note.color } : undefined}
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

            {pdf ? (
              <>
                <TagChips tags={note.tags} size="lg" />
                <p className="mt-3 overflow-y-auto whitespace-pre-wrap pr-1 text-lg font-medium leading-relaxed">
                  “{pdf.quote}”
                </p>
                {pdf.rest && (
                  <div
                    className="note-html mt-2 text-sm leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: pdf.rest }}
                  />
                )}
                {sourceLine && (
                  <p className="mt-3 border-t border-black/10 pt-2.5 text-xs italic opacity-70">
                    {sourceLine}
                  </p>
                )}
              </>
            ) : (
              <>
                <h2 className="pl-3.5 pr-8 text-xl font-bold leading-snug">{note.title}</h2>

                <div
                  className="note-html mt-3 overflow-y-auto pr-1 text-[11pt] leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: note.content || "<p>—</p>" }}
                />

                <div className="mt-3 space-y-1.5 border-t border-black/10 pt-2.5">
                  {sourceLine && (
                    <p className="text-xs italic opacity-70">{sourceLine}</p>
                  )}
                  {note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {note.tags.map((t) => (
                        <span
                          key={t.name}
                          className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-medium"
                        >
                          {t.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {note.sourceHref && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                router.push(note.sourceHref!);
              }}
              className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-stone-700 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-white"
            >
              Kaynağa git <Icon name="arrow-right" />
            </button>
          )}
        </div>
      )}
    </>
  );
}
