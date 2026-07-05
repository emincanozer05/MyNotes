"use client";

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
  tags: Tag[];
  cls: string;
  tilt: string;
  /** Soft pastel colour derived from a tagged passage's tag; overrides `cls`. */
  color: string | null;
}

export function PostitCard({ note }: { note: PostitData }) {
  const router = useRouter();

  // Content may be rich HTML; show a clean text preview on the card.
  const preview = note.content
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  function open() {
    router.push(`/notes/${note.id}`);
  }

  return (
    <div
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter") open();
      }}
      role="link"
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
        {note.source_title && (
          <p className="line-clamp-1 text-[10px] italic opacity-70">
            {note.source_author}
            {note.source_year ? ` (${note.source_year})` : ""}
            {note.source_author || note.source_year ? " — " : ""}
            {note.source_title}
          </p>
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
  );
}
