import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PostitCard, type PostitNote } from "./PostitCard";

interface NoteRow extends PostitNote {
  updated_at: string;
}

// Deterministic post-it colour + slight tilt from the note id
const POSTIT = ["postit-y", "postit-p", "postit-g", "postit-b", "postit-o", "postit-v"];
const TILTS = ["-2deg", "1.5deg", "-1deg", "2deg", "0.5deg", "-1.5deg"];
function postitStyle(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return { cls: POSTIT[h % POSTIT.length], tilt: TILTS[h % TILTS.length] };
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
    .select("id, title, content, source_title, source_author, source_year, updated_at, note_tags(tags(name))")
    .order("updated_at", { ascending: false });

  if (noteIdsForTag !== null) query = query.in("id", noteIdsForTag);
  if (source) query = query.eq("source_id", source);
  if (q) query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`);

  const [{ data: notes }, { data: allTags }] = await Promise.all([
    query,
    supabase.from("tags").select("name").order("name"),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4 animate-in">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">
            <span className="gradient-text">Post-it Notlar</span>
          </h1>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
            Renkli post-it panonuz. <code>[[bağlantı]]</code> ve{" "}
            <code>#etiket</code> destekli.
          </p>
        </div>
        <Link
          href="/notes/new"
          className="btn-gradient shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold"
        >
          + Yeni Not
        </Link>
      </div>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Notlarda ara…"
          className="flex-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
        />
        {tag && <input type="hidden" name="tag" value={tag} />}
        <button className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-stone-500/10">
          Ara
        </button>
      </form>

      {allTags && allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Link
            href="/notes"
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !tag
                ? "bg-gradient-to-r from-amber-500 to-rose-500 text-white"
                : "bg-stone-500/10 text-stone-600 hover:bg-stone-500/20 dark:text-stone-400"
            }`}
          >
            Tümü
          </Link>
          {allTags.map((t) => (
            <Link
              key={t.name}
              href={`/notes?tag=${encodeURIComponent(t.name)}`}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                tag === t.name
                  ? "bg-sky-600 text-white"
                  : "bg-sky-500/10 text-sky-700 hover:bg-sky-500/20 dark:text-sky-300"
              }`}
            >
              #{t.name}
            </Link>
          ))}
        </div>
      )}

      {notes && notes.length > 0 ? (
        <div className="stagger grid grid-cols-1 gap-6 pt-3 sm:grid-cols-2 lg:grid-cols-3">
          {(notes as unknown as NoteRow[]).map((n) => {
            const { cls, tilt } = postitStyle(n.id);
            return <PostitCard key={n.id} note={n} cls={cls} tilt={tilt} />;
          })}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-stone-300 dark:border-stone-700 p-10 text-center text-sm text-stone-500">
          {tag || q
            ? "Bu filtreye uyan not bulunamadı."
            : "Henüz notunuz yok. İlk post-it'inizi oluşturun."}
        </p>
      )}
    </div>
  );
}
