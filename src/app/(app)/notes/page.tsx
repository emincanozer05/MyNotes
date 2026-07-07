import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { pastelize } from "@/lib/color";
import { extractTaggedPassages, type TaggedPassage } from "@/lib/wiki";
import { CATEGORIES, categoryLabel, normalizeCategory } from "@/lib/categories";
import { PostitCard, type PostitData } from "./PostitCard";
import { PassagePostitCard } from "./PassagePostitCard";
import { NewPostitButton } from "./NewPostitButton";

// Deterministic post-it tilt from a stable key so cards don't jump on refresh.
const TILTS = ["-2deg", "1.5deg", "-1deg", "2deg", "0.5deg", "-1.5deg"];
function tiltFor(key: string) {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TILTS[h % TILTS.length];
}

// Fallback pastel classes for notes that carry no coloured tag.
const CLASSES = ["postit-y", "postit-p", "postit-g", "postit-b", "postit-o", "postit-v"];
function clsFor(key: string) {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return CLASSES[h % CLASSES.length];
}

/** A tagged passage promoted to a post-it, with a link back to its source. */
interface BoardItem extends TaggedPassage {
  key: string;
  sourceLabel: string;
  href: string;
  category: string;
}

interface NoteRow {
  id: string;
  title: string;
  content: string;
  category?: string;
  source_id: string | null;
  source_title: string | null;
  source_author: string | null;
  source_year: number | null;
  note_tags: { tags: { name: string; color: string | null } | null }[];
}

interface SourceRow {
  id: string;
  kind: string;
  title: string;
  category?: string;
  metadata: {
    category?: string;
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
  searchParams: Promise<{ tag?: string; q?: string; category?: string }>;
}) {
  const { tag, q, category: categoryParam } = await searchParams;
  const category = normalizeCategory(categoryParam);
  const supabase = await createClient();

  const [notesRes, sourcesRes] = await Promise.all([
    supabase
      .from("notes")
      .select(
        "id, title, content, category, source_id, source_title, source_author, source_year, note_tags(tags(name, color))",
      )
      .order("created_at", { ascending: false }),
    supabase.from("sources").select("id, kind, title, category, metadata"),
  ]);

  // On a DB without the 0008 migration the `category` columns don't exist and
  // the selects above fail wholesale — retry without them so the board still
  // renders. Categories then come from `metadata` (books keep theirs there),
  // defaulting to "spor".
  const notes = notesRes.error
    ? (
        await supabase
          .from("notes")
          .select(
            "id, title, content, source_id, source_title, source_author, source_year, note_tags(tags(name, color))",
          )
          .order("created_at", { ascending: false })
      ).data
    : notesRes.data;
  const sources = sourcesRes.error
    ? (await supabase.from("sources").select("id, kind, title, metadata")).data
    : sourcesRes.data;

  // Map each source id to its kind so a note can link back to its source.
  const sourceKindById = new Map<string, string>(
    ((sources ?? []) as SourceRow[]).map((s) => [s.id, s.kind]),
  );

  // Each note is its own post-it card.
  const noteCards: PostitData[] = ((notes ?? []) as unknown as NoteRow[]).map((n) => {
    const tags = n.note_tags
      .map((t) => t.tags)
      .filter((t): t is { name: string; color: string | null } => Boolean(t));
    const firstColor = tags.find((t) => t.color)?.color ?? null;
    const kind = n.source_id ? sourceKindById.get(n.source_id) : undefined;
    return {
      id: n.id,
      title: n.title,
      content: n.content ?? "",
      category: normalizeCategory(n.category),
      source_title: n.source_title ?? "",
      source_author: n.source_author ?? "",
      source_year: n.source_year,
      sourceHref: n.source_id && kind ? sourceHref(kind, n.source_id) : null,
      tags: tags.map((t) => ({ name: t.name })),
      cls: clsFor(n.id),
      tilt: tiltFor(n.id),
      color: firstColor ? pastelize(firstColor) : null,
    };
  });

  // Tagged passages highlighted inside article summaries and book/course notes
  // also surface as post-its, linking back to their source.
  const passages: BoardItem[] = [];
  for (const s of (sources ?? []) as SourceRow[]) {
    const base = sourceHref(s.kind, s.id);
    // A book's category is managed in its `metadata` (see bookshelf actions),
    // so highlighted passages land on that category's board. The schema column
    // is the fallback for sources that don't keep it there (e.g. articles);
    // courses' metadata.category is the "course" marker, not a board slug, and
    // normalizes to the default "spor" — exactly where S&C content belongs.
    const srcCategory = normalizeCategory(s.metadata?.category ?? s.category);
    // Anchor each passage to its titled note (or the seeded legacy summary)
    // plus its index inside that note, so "Kaynağa git" scrolls straight to
    // the exact highlighted text.
    extractTaggedPassages(s.metadata?.summary).forEach((p, i) =>
      passages.push({
        ...p,
        key: `src-${s.id}-sum-${i}`,
        sourceLabel: s.title,
        href: `${base}#note-legacy~${i}`,
        category: srcCategory,
      }),
    );
    for (const tn of s.metadata?.notes ?? []) {
      extractTaggedPassages(tn.html).forEach((p, i) =>
        passages.push({
          ...p,
          key: `src-${s.id}-${tn.id}-${i}`,
          sourceLabel: tn.title ? `${s.title} › ${tn.title}` : s.title,
          href: `${base}#note-${tn.id}~${i}`,
          category: srcCategory,
        }),
      );
    }
  }

  // Everything shown on the board is scoped to the active category first, so
  // the tag chips below (and their colours) only reflect this category.
  const categoryNotes = noteCards.filter((n) => n.category === category);
  const categoryPassages = passages.filter((it) => it.category === category);

  // Distinct tags (name + colour) within this category, for the filter.
  const tagColorByName = new Map<string, string | null>();
  for (const n of categoryNotes) {
    for (const t of n.tags) if (!tagColorByName.has(t.name)) tagColorByName.set(t.name, null);
  }
  for (const it of categoryPassages) {
    if (!tagColorByName.has(it.tagName)) tagColorByName.set(it.tagName, it.tagColor);
  }
  const allTags = [...tagColorByName.entries()]
    .map(([name, color]) => ({ name, color }))
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));

  // Apply the active tag / search filters within the category subset.
  const needle = q?.trim().toLocaleLowerCase("tr") ?? "";
  const shownNotes = categoryNotes.filter((n) => {
    if (tag && !n.tags.some((t) => t.name === tag)) return false;
    if (!needle) return true;
    const plain = n.content.replace(/<[^>]*>/g, " ").toLocaleLowerCase("tr");
    return (
      n.title.toLocaleLowerCase("tr").includes(needle) || plain.includes(needle)
    );
  });
  const shownPassages = categoryPassages.filter(
    (it) =>
      (!tag || it.tagName === tag) &&
      (!needle ||
        it.text.toLocaleLowerCase("tr").includes(needle) ||
        it.sourceLabel.toLocaleLowerCase("tr").includes(needle)),
  );

  const total = shownNotes.length + shownPassages.length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-start justify-between gap-4 animate-in">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight">
            <span className="gradient-text">Post-it Notlar</span>
          </h1>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
            {categoryLabel(category)} panosu — notların ve etiketlediğin
            cümlelerin renkli post-it&apos;ler olur.
          </p>
        </div>
        <NewPostitButton category={category} />
      </div>

      {/* Kategori sekmeleri: her kategori kendi post-it'leri ve etiketleriyle */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => {
          const active = c.slug === category;
          return (
            <Link
              key={c.slug}
              href={`/notes?category=${c.slug}`}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                active
                  ? "bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow"
                  : "bg-stone-500/10 text-stone-600 hover:bg-stone-500/20 dark:text-stone-400"
              }`}
            >
              <span aria-hidden className="mr-1">
                {c.icon}
              </span>
              {c.label}
            </Link>
          );
        })}
      </div>

      <form className="flex gap-2">
        <input type="hidden" name="category" value={category} />
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
            href={`/notes?category=${category}`}
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
                href={`/notes?category=${category}&tag=${encodeURIComponent(t.name)}`}
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

      {total > 0 ? (
        <div className="stagger grid grid-cols-2 gap-4 pt-3 sm:grid-cols-3 lg:grid-cols-4">
          {shownNotes.map((n) => (
            <PostitCard key={`note-${n.id}`} note={n} />
          ))}
          {shownPassages.map((it) => (
            <PassagePostitCard
              key={it.key}
              passage={{
                key: it.key,
                text: it.text,
                tagName: it.tagName,
                tagColor: it.tagColor,
                sourceLabel: it.sourceLabel,
                href: it.href,
                tilt: tiltFor(it.key),
              }}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-stone-300 dark:border-stone-700 p-10 text-center text-sm text-stone-500">
          {tag || q
            ? "Bu filtreye uyan post-it bulunamadı."
            : "Henüz post-it'in yok. + Yeni Not ile ilk post-it'ini yapıştır."}
        </p>
      )}
    </div>
  );
}
