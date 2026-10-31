import { createClient } from "@/lib/supabase/server";
import { NOTEBOOK_MARKER, htmlToText } from "@/lib/notebook";
import { getNotebookCategories } from "./actions";
import { NotebookBoard, type NotebookEntryCard } from "./NotebookBoard";

interface EntryRow {
  id: string;
  title: string;
  created_at: string;
  nb_category: string | null;
  notes: { title?: string; html?: string }[] | null;
}

// Plain text kept per page for the preview line and in-tab search.
const MAX_TEXT = 4000;

export default async function NotebookPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const supabase = await createClient();

  const [{ data }, categories] = await Promise.all([
    supabase
      .from("sources")
      .select(
        "id, title, created_at, nb_category:metadata->>nb_category, notes:metadata->notes",
      )
      .eq("kind", "other")
      .contains("metadata", { category: NOTEBOOK_MARKER })
      .order("created_at", { ascending: false }),
    getNotebookCategories(),
  ]);

  const entries: NotebookEntryCard[] = ((data ?? []) as EntryRow[]).map((e) => {
    const notes = Array.isArray(e.notes) ? e.notes : [];
    const text = notes
      .map((n) => [n.title ?? "", htmlToText(n.html)].filter(Boolean).join(" "))
      .join(" ")
      .slice(0, MAX_TEXT);
    return {
      id: e.id,
      title: e.title,
      category: e.nb_category ?? categories[0]?.slug ?? "",
      createdAt: e.created_at,
      noteTitles: notes.map((n) => n.title ?? "").filter(Boolean),
      text,
    };
  });

  const initial =
    categories.find((c) => c.slug === category)?.slug ?? categories[0]?.slug ?? "";

  return (
    <div className="mx-auto max-w-6xl">
      <NotebookBoard
        entries={entries}
        categories={categories}
        initialCategory={initial}
      />
    </div>
  );
}
