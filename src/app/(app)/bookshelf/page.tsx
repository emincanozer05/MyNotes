import { createClient } from "@/lib/supabase/server";
import { normalizeCategory } from "@/lib/categories";
import { normalizeStatus } from "@/lib/status";
import { BookshelfBoard, type BookCardData } from "./BookshelfBoard";

const SPINE_COLORS = [
  "from-amber-600 to-orange-700",
  "from-emerald-600 to-teal-700",
  "from-sky-600 to-indigo-700",
  "from-rose-600 to-pink-700",
  "from-violet-600 to-fuchsia-700",
  "from-stone-600 to-stone-800",
];
function spineColor(title: string) {
  let h = 0;
  for (const c of title) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return SPINE_COLORS[h % SPINE_COLORS.length];
}

interface BookRow {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  cover_url: string | null;
  metadata: {
    category?: string;
    status?: string;
  } | null;
}

export default async function BookshelfPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: categoryParam } = await searchParams;
  const category = normalizeCategory(categoryParam);
  const supabase = await createClient();

  // All categories are fetched at once; the client board filters instantly on
  // tab clicks instead of re-querying the server per category.
  const [{ data: booksData }, { data: noteCounts }] = await Promise.all([
    supabase
      .from("sources")
      .select("id, title, authors, year, cover_url, metadata")
      .eq("kind", "book")
      .order("created_at", { ascending: false }),
    supabase.from("notes").select("source_id"),
  ]);

  const countBySource = new Map<string, number>();
  for (const n of noteCounts ?? []) {
    if (n.source_id) {
      countBySource.set(n.source_id, (countBySource.get(n.source_id) ?? 0) + 1);
    }
  }

  const books: BookCardData[] = ((booksData ?? []) as BookRow[]).map((b) => ({
    id: b.id,
    title: b.title,
    authors: b.authors,
    year: b.year,
    cover_url: b.cover_url,
    category: normalizeCategory(b.metadata?.category),
    status: normalizeStatus(b.metadata?.status),
    noteCount: countBySource.get(b.id) ?? 0,
    spineCls: spineColor(b.title),
  }));

  return (
    <div className="mx-auto max-w-5xl">
      <BookshelfBoard books={books} initialCategory={category} />
    </div>
  );
}
