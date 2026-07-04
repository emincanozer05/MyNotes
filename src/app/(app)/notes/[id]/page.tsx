import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NoteContent } from "@/components/NoteContent";
import { HighlightCapture } from "./HighlightCapture";
import { FeynmanPanel } from "./FeynmanPanel";
import { deleteNote } from "../actions";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";

export default async function NoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: note }, { data: allNotes }] = await Promise.all([
    supabase
      .from("notes")
      .select("*, note_tags(tags(name))")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("notes").select("id, title"),
  ]);

  if (!note) notFound();

  const linkMap = new Map(
    (allNotes ?? []).map((n) => [n.title.toLocaleLowerCase("tr"), n.id]),
  );
  const titleById = new Map((allNotes ?? []).map((n) => [n.id, n.title]));

  const [{ data: outLinks }, { data: backLinks }, { data: highlights }] =
    await Promise.all([
      supabase.from("note_links").select("to_note").eq("from_note", id),
      supabase.from("note_links").select("from_note").eq("to_note", id),
      supabase
        .from("highlights")
        .select("id, text, created_at")
        .eq("note_id", id)
        .order("created_at", { ascending: false }),
    ]);

  const tags = (note.note_tags as { tags: { name: string } | null }[])
    .map((t) => t.tags?.name)
    .filter((n): n is string => Boolean(n));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{note.title}</h1>
          {note.source_title && (
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              {note.source_author}
              {note.source_year && ` (${note.source_year})`}
              {(note.source_author || note.source_year) && " — "}
              <em>{note.source_title}</em>
              {note.source_page && `, s. ${note.source_page}`}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href={`/notes/${id}/edit`}
            className="rounded-md border border-stone-300 dark:border-stone-700 px-3 py-1.5 text-sm font-medium hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            Düzenle
          </Link>
          <form action={deleteNote}>
            <input type="hidden" name="id" value={id} />
            <ConfirmSubmit
              message="Bu not silinsin mi?"
              className="rounded-md border border-red-300 dark:border-red-900 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            >
              Sil
            </ConfirmSubmit>
          </form>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <Link
              key={t}
              href={`/notes?tag=${encodeURIComponent(t)}`}
              className="rounded-full bg-sky-50 dark:bg-sky-950 px-2.5 py-0.5 text-xs font-medium text-sky-700 dark:text-sky-300 hover:bg-sky-100"
            >
              #{t}
            </Link>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 p-5">
        {note.content ? (
          <HighlightCapture noteId={id}>
            <NoteContent content={note.content} linkMap={linkMap} />
          </HighlightCapture>
        ) : (
          <p className="text-sm text-stone-500">Bu not henüz boş.</p>
        )}
        <p className="mt-4 border-t border-stone-100 dark:border-stone-900 pt-2 text-xs text-stone-400">
          İpucu: metinde bir pasaj seçince ❝ Alıntıya ekle düğmesi çıkar.
        </p>
      </div>

      <FeynmanPanel noteId={id} />

      {(outLinks?.length || backLinks?.length) ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-stone-200 dark:border-stone-800 p-4">
            <h2 className="text-sm font-semibold">Bağlantılar →</h2>
            <ul className="mt-2 space-y-1">
              {(outLinks ?? []).map((l) => (
                <li key={l.to_note}>
                  <Link
                    href={`/notes/${l.to_note}`}
                    className="text-sm text-amber-700 dark:text-amber-400 hover:underline"
                  >
                    {titleById.get(l.to_note) ?? "?"}
                  </Link>
                </li>
              ))}
              {!outLinks?.length && (
                <li className="text-sm text-stone-400">Giden bağlantı yok</li>
              )}
            </ul>
          </div>
          <div className="rounded-lg border border-stone-200 dark:border-stone-800 p-4">
            <h2 className="text-sm font-semibold">← Buraya bağlananlar</h2>
            <ul className="mt-2 space-y-1">
              {(backLinks ?? []).map((l) => (
                <li key={l.from_note}>
                  <Link
                    href={`/notes/${l.from_note}`}
                    className="text-sm text-amber-700 dark:text-amber-400 hover:underline"
                  >
                    {titleById.get(l.from_note) ?? "?"}
                  </Link>
                </li>
              ))}
              {!backLinks?.length && (
                <li className="text-sm text-stone-400">Gelen bağlantı yok</li>
              )}
            </ul>
          </div>
        </div>
      ) : null}

      {highlights && highlights.length > 0 && (
        <div className="rounded-lg border border-stone-200 dark:border-stone-800 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Bu nottaki alıntılar</h2>
            <Link
              href="/highlights"
              className="text-xs text-amber-700 dark:text-amber-400 hover:underline"
            >
              Tüm Öne Çıkanlar →
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {highlights.map((h) => (
              <li
                key={h.id}
                className="border-l-2 border-amber-400 pl-3 text-sm italic text-stone-600 dark:text-stone-400"
              >
                “{h.text}”
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
