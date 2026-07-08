import { createClient } from "@/lib/supabase/server";
import { pastelize } from "@/lib/color";
import { extractTaggedPassages } from "@/lib/wiki";
import { normalizeCategory } from "@/lib/categories";
import type { PostitData } from "./PostitCard";
import { NotesBoard, type PassageItem } from "./NotesBoard";

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

  // Every category is fetched at once; the client board filters instantly on
  // tab clicks instead of re-querying the server per category.
  // board_sources() (migration 0009) returns the rich-text fields with <img>
  // tags stripped in the database, so embedded base64 images never cross the
  // network just to extract the highlighted passages.
  const [notesRes, sourcesRes] = await Promise.all([
    supabase
      .from("notes")
      .select(
        "id, title, content, category, source_id, source_title, source_author, source_year, note_tags(tags(name, color))",
      )
      .order("created_at", { ascending: false }),
    supabase.rpc("board_sources"),
  ]);

  // On a DB without the 0008 migration the `category` columns don't exist and
  // the notes select above fails wholesale — retry without them so the board
  // still renders. Categories then come from `metadata` (books keep theirs
  // there), defaulting to "spor".
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

  // Without the 0009 migration the RPC doesn't exist — fall back to the raw
  // (heavier) metadata select, then to the pre-0008 shape without `category`.
  let sources = sourcesRes.error ? null : (sourcesRes.data as SourceRow[]);
  if (!sources) {
    const raw = await supabase
      .from("sources")
      .select("id, kind, title, category, metadata");
    sources = (
      raw.error
        ? (await supabase.from("sources").select("id, kind, title, metadata"))
            .data
        : raw.data
    ) as SourceRow[] | null;
  }

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
  const passages: PassageItem[] = [];
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
        tilt: tiltFor(`src-${s.id}-sum-${i}`),
        sourceId: s.id,
        noteRef: "",
        passageIndex: i,
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
          tilt: tiltFor(`src-${s.id}-${tn.id}-${i}`),
          sourceId: s.id,
          noteRef: tn.id,
          passageIndex: i,
        }),
      );
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <NotesBoard
        cards={noteCards}
        passages={passages}
        initialCategory={category}
        initialTag={tag}
        initialQ={q}
      />
    </div>
  );
}
