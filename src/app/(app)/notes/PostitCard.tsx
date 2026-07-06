"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteNote } from "./actions";

interface Tag {
  name: string;
}

export interface PostitData {
  id: string;
  title: string;
  content: string;
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
            className="flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-xs font-bold leading-none text-stone-700/70 opacity-0 transition-all hover:bg-rose-500 hover:text-white group-hover:opacity-100"
          >
            ×
          </button>
        </form>

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
                  #{t.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expanded, centered view with a blurred backdrop. */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/40 p-4 backdrop-blur-sm"
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
                      #{t.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
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
              Kaynağa git →
            </button>
          )}
        </div>
      )}
    </>
  );
}
