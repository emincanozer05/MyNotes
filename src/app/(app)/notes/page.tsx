import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { pastelize } from "@/lib/color";
import { extractTaggedPassages, type TaggedPassage } from "@/lib/wiki";

// Deterministic post-it tilt from a stable key so cards don't jump on refresh.
const TILTS = ["-2deg", "1.5deg", "-1deg", "2deg", "0.5deg", "-1.5deg"];
function tiltFor(key: string) {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TILTS[h % TILTS.length];
}

/** A tagged passage promoted to a post-it, with a link back to its source. */
interface BoardItem extends TaggedPassage {
  key: string;
  sourceLabel: string;
  href: string;
}

interface SourceRow {
  id: string;
  kind: string;
  title: string;
  metadata: {
    summary?: string;
    notes?: { id: string; title: string; html: string }[];
  } | null;
}

function sourceHref(kind: string, id: string): string {
  if (kind === "book") return `/bookshelf/${id}`;
  if (kind === "other") return `/courses/${id}`;
  return `/library/${id}`; // article
}

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ tag?: string; q?: string }>;
}) {
  const { tag, q } = await searchParams;
  const supabase = await createClient();

  const [{ data: notes }, { data: sources }] = await Promise.all([
    supabase.from("notes").select("id, title, content"),
    supabase.from("sources").select("id, kind, title, metadata"),
  ]);

  // Collect every tagged passage across notes, article summaries and
  // book/course notes — each highlight becomes its own post-it card.
  const items: BoardItem[] = [];

  for (const n of (notes ?? []) as { id: string; title: string; content: string }[]) {
    extractTaggedPassages(n.content).forEach((p, i) =>
      items.push({
        ...p,
        key: `note-${n.id}-${i}`,
        sourceLabel: n.title || "Not",
        href: `/notes/${n.id}`,
      }),
    );
  }

  for (const s of (sources ?? []) as SourceRow[]) {
    const href = sourceHref(s.kind, s.id);
    extractTaggedPassages(s.metadata?.summary).forEach((p, i) =>
      items.push({
        ...p,
        key: `src-${s.id}-sum-${i}`,
        sourceLabel: s.title,
        href,
      }),
    );
    for (const tn of s.metadata?.notes ?? []) {
      extractTaggedPassages(tn.html).forEach((p, i) =>
        items.push({
          ...p,
          key: `src-${s.id}-${tn.id}-${i}`,
          sourceLabel: tn.title ? `${s.title} › ${tn.title}` : s.title,
          href,
        }),
      );
    }
  }

  // Distinct tags (name + colour) present across all passages, for the filter.
  const tagColorByName = new Map<string, string | null>();
  for (const it of items) {
    if (!tagColorByName.has(it.tagName)) tagColorByName.set(it.tagName, it.tagColor);
  }
  const allTags = [...tagColorByName.entries()]
    .map(([name, color]) => ({ name, color }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));

  // Apply the active tag / search filters.
  const needle = q?.trim().toLocaleLowerCase("tr") ?? "";
  const shown = items.filter(
    (it) =>
      (!tag || it.tagName === tag) &&
      (!needle ||
        it.text.toLocaleLowerCase("tr").includes(needle) ||
        it.sourceLabel.toLocaleLowerCase("tr").includes(needle)),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4 animate-in">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">
            <span className="gradient-text">Post-it Notlar</span>
          </h1>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
            Metinlerinde etiketlediğin cümleler burada renkli post-it&apos;ler olur.
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
          placeholder="Post-it'lerde ara…"
          className="flex-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
        />
        {tag && <input type="hidden" name="tag" value={tag} />}
        <button className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-medium transition-colors hover:bg-stone-500/10">
          Ara
        </button>
      </form>

      {allTags.length > 0 && (
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
          {allTags.map((t) => {
            const active = tag === t.name;
            return (
              <Link
                key={t.name}
                href={`/notes?tag=${encodeURIComponent(t.name)}`}
                className="rounded-full px-3 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{
                  background: t.color ?? "#78716c",
                  opacity: active ? 1 : 0.55,
                }}
              >
                #{t.name}
              </Link>
            );
          })}
        </div>
      )}

      {shown.length > 0 ? (
        <div className="stagger grid grid-cols-2 gap-4 pt-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((it) => (
            <Link
              key={it.key}
              href={it.href}
              className="postit group"
              style={{
                transform: `rotate(${tiltFor(it.key)})`,
                background: pastelize(it.tagColor),
              }}
            >
              <span className="postit-pin" aria-hidden />
              <span
                className="ml-3.5 self-start rounded-full px-2 py-0.5 text-[9px] font-semibold text-white"
                style={{ background: it.tagColor ?? "#78716c" }}
              >
                🏷 {it.tagName}
              </span>
              <p className="mt-2 flex-1 whitespace-pre-wrap text-[12px] font-medium leading-snug line-clamp-6">
                “{it.text}”
              </p>
              <p className="mt-2 line-clamp-1 text-[10px] italic opacity-70">
                {it.sourceLabel}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-stone-300 dark:border-stone-700 p-10 text-center text-sm text-stone-500">
          {tag || q
            ? "Bu filtreye uyan post-it bulunamadı."
            : "Henüz etiketli cümlen yok. Bir notu düzenlerken bir cümle seçip 🏷 Etiket ekle ile etiketle; burada post-it olarak belirir."}
        </p>
      )}
    </div>
  );
}
