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
}

export function PostitCard({ note }: { note: PostitData }) {
  const router = useRouter();

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
      style={{ transform: `rotate(${note.tilt})` }}
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
          className="flex h-6 w-6 items-center justify-center rounded-full bg-black/10 text-sm font-bold leading-none text-stone-700/70 opacity-0 transition-all hover:bg-rose-500 hover:text-white group-hover:opacity-100"
        >
          ×
        </button>
      </form>

      <h3 className="pr-6 font-bold leading-snug line-clamp-2">{note.title}</h3>
      {note.content && (
        <p className="mt-2 flex-1 whitespace-pre-wrap text-sm leading-snug line-clamp-6 opacity-90">
          {note.content.slice(0, 240)}
        </p>
      )}
      <div className="mt-3 space-y-1.5">
        {note.source_title && (
          <p className="text-[11px] italic opacity-70">
            {note.source_author}
            {note.source_year ? ` (${note.source_year})` : ""}
            {note.source_author || note.source_year ? " — " : ""}
            {note.source_title}
          </p>
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
  );
}
