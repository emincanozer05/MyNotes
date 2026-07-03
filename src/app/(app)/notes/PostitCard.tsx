"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteNote } from "./actions";

interface TagRef {
  tags: { name: string } | null;
}

export interface PostitNote {
  id: string;
  title: string;
  content: string;
  source_title: string;
  source_author: string;
  source_year: number | null;
  note_tags: TagRef[];
}

export function PostitCard({
  note,
  cls,
  tilt,
}: {
  note: PostitNote;
  cls: string;
  tilt: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const tags = note.note_tags.filter((t) => t.tags);

  function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm("Bu notu silmek istediğine emin misin?")) return;
    const fd = new FormData();
    fd.set("id", note.id);
    startTransition(async () => {
      await deleteNote(fd);
      router.refresh();
    });
  }

  return (
    <div
      className={`postit ${cls} ${pending ? "pointer-events-none opacity-40" : ""}`}
      style={{ transform: `rotate(${tilt})` }}
    >
      <span className="postit-pin" aria-hidden />

      <button
        type="button"
        onClick={handleDelete}
        title="Notu sil"
        aria-label="Notu sil"
        className="postit-close"
      >
        ×
      </button>

      <Link href={`/notes/${note.id}`} className="flex flex-1 flex-col">
        <h3 className="pr-5 font-bold leading-snug line-clamp-2">{note.title}</h3>
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
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((t) => (
                <span
                  key={t.tags!.name}
                  className="rounded-full bg-black/10 px-2 py-0.5 text-[10px] font-medium"
                >
                  #{t.tags!.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </div>
  );
}
