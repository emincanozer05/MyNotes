import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

interface NoteRow {
  id: string;
  title: string;
  source_title: string;
  source_author: string;
  source_year: number | null;
  updated_at: string;
  note_tags: { tags: { name: string } | null }[];
}

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; q?: string; source?: string }>;
}) {
  const { tag, q, source } = await searchParams;
  const supabase = await createClient();

  let noteIdsForTag: string[] | null = null;
  if (tag) {
    const { data: tagRow } = await supabase
      .from("tags")
      .select("id")
      .eq("name", tag)
      .maybeSingle();
    if (tagRow) {
      const { data: nt } = await supabase
        .from("note_tags")
        .select("note_id")
        .eq("tag_id", tagRow.id);
      noteIdsForTag = (nt ?? []).map((r) => r.note_id);
    } else {
      noteIdsForTag = [];
    }
  }

  let query = supabase
    .from("notes")
    .select("id, title, source_title, source_author, source_year, updated_at, note_tags(tags(name))")
    .order("updated_at", { ascending: false });

  if (noteIdsForTag !== null) query = query.in("id", noteIdsForTag);
  if (source) query = query.eq("source_id", source);
  if (q) query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`);

  const [{ data: notes }, { data: allTags }] = await Promise.all([
    query,
    supabase.from("tags").select("name").order("name"),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notlar</h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            Kaynak referanslı bilimsel notlarınız. <code>[[bağlantı]]</code> ve{" "}
            <code>#etiket</code> destekli.
          </p>
        </div>
        <Link
          href="/notes/new"
          className="shrink-0 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
        >
          + Yeni Not
        </Link>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Notlarda ara…"
          className="flex-1 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
        />
        {tag && <input type="hidden" name="tag" value={tag} />}
        <button className="rounded-md border border-stone-300 dark:border-stone-700 px-4 py-2 text-sm font-medium hover:bg-stone-100 dark:hover:bg-stone-800">
          Ara
        </button>
      </form>

      {allTags && allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Link
            href="/notes"
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              !tag
                ? "bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-900"
                : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200"
            }`}
          >
            Tümü
          </Link>
          {allTags.map((t) => (
            <Link
              key={t.name}
              href={`/notes?tag=${encodeURIComponent(t.name)}`}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                tag === t.name
                  ? "bg-sky-600 text-white"
                  : "bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-300 hover:bg-sky-100"
              }`}
            >
              #{t.name}
            </Link>
          ))}
        </div>
      )}

      {notes && notes.length > 0 ? (
        <div className="space-y-3">
          {(notes as unknown as NoteRow[]).map((n) => (
            <Link
              key={n.id}
              href={`/notes/${n.id}`}
              className="block rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 p-4 hover:border-amber-400 transition-colors"
            >
              <h3 className="font-semibold">{n.title}</h3>
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                {n.source_author}
                {n.source_year && ` (${n.source_year})`} — {n.source_title}
              </p>
              {n.note_tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {n.note_tags
                    .filter((t) => t.tags)
                    .map((t) => (
                      <span
                        key={t.tags!.name}
                        className="rounded-full bg-sky-50 dark:bg-sky-950 px-2 py-0.5 text-xs text-sky-700 dark:text-sky-300"
                      >
                        #{t.tags!.name}
                      </span>
                    ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-stone-300 dark:border-stone-700 p-8 text-center text-sm text-stone-500">
          {tag || q
            ? "Bu filtreye uyan not bulunamadı."
            : "Henüz notunuz yok. İlk bilimsel notunuzu oluşturun."}
        </p>
      )}
    </div>
  );
}
