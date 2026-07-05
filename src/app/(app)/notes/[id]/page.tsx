import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NoteContent } from "@/components/NoteContent";
import { FeynmanPanel } from "./FeynmanPanel";
import { deleteNote } from "../actions";
import { deleteTagAction } from "@/app/(app)/tagsActions";
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
      .select("*, note_tags(tags(id, name))")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("notes").select("id, title"),
  ]);

  if (!note) notFound();

  const linkMap = new Map(
    (allNotes ?? []).map((n) => [n.title.toLocaleLowerCase("tr"), n.id]),
  );
  const titleById = new Map((allNotes ?? []).map((n) => [n.id, n.title]));

  const [{ data: outLinks }, { data: backLinks }] = await Promise.all([
    supabase.from("note_links").select("to_note").eq("from_note", id),
    supabase.from("note_links").select("from_note").eq("to_note", id),
  ]);

  const tags = (note.note_tags as { tags: { id: string; name: string } | null }[])
    .map((t) => t.tags)
    .filter((t): t is { id: string; name: string } => Boolean(t));

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
        <div className="flex flex-wrap gap-1.5 pt-1.5 pr-1.5">
          {tags.map((t) => (
            <span key={t.id} className="group relative inline-flex">
              <Link
                href={`/notes?tag=${encodeURIComponent(t.name)}`}
                className="rounded-full bg-sky-50 dark:bg-sky-950 px-2.5 py-0.5 text-xs font-medium text-sky-700 dark:text-sky-300 hover:bg-sky-100"
              >
                #{t.name}
              </Link>
              <form action={deleteTagAction} className="absolute -right-1.5 -top-1.5">
                <input type="hidden" name="id" value={t.id} />
                <ConfirmSubmit
                  message={`"${t.name}" etiketi tüm notlardan silinsin mi?`}
                  title="Etiketi sil"
                  ariaLabel={`${t.name} etiketini sil`}
                  className="flex h-4 w-4 items-center justify-center rounded-full border border-[var(--surface)] bg-stone-500 text-[9px] leading-none text-white opacity-0 transition-opacity hover:bg-rose-600 group-hover:opacity-100"
                >
                  ×
                </ConfirmSubmit>
              </form>
            </span>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 p-5">
        {note.content ? (
          <NoteContent content={note.content} linkMap={linkMap} />
        ) : (
          <p className="text-sm text-stone-500">Bu not henüz boş.</p>
        )}
        <p className="mt-4 border-t border-stone-100 dark:border-stone-900 pt-2 text-xs text-stone-400">
          İpucu: <Link href={`/notes/${id}/edit`} className="underline">Düzenle</Link>&apos;de
          bir pasaj seçince 🏷 Etiket ekle düğmesi çıkar; etiketlediğin
          metinlere göre post-it&apos;in rengi de yumuşak bir tona döner.
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
    </div>
  );
}
