import { Icon } from "@/components/Icon";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TitledNotes } from "@/components/TitledNotes";
import type { TitledNote } from "@/app/(app)/sourceNotesActions";
import { EditableTitle } from "@/app/(app)/courses/[id]/EditableTitle";
import { NOTEBOOK_MARKER } from "@/lib/notebook";
import { getNotebookCategories, setNotebookEntryTitle } from "../actions";
import { EntryCategoryPicker } from "./EntryCategoryPicker";

interface EntryRow {
  id: string;
  title: string;
  created_at: string;
  metadata: { nb_category?: string; notes?: TitledNote[] } | null;
}

const dateFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function NotebookEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data }, categories] = await Promise.all([
    supabase
      .from("sources")
      .select("id, title, created_at, metadata")
      .eq("id", id)
      .eq("kind", "other")
      .contains("metadata", { category: NOTEBOOK_MARKER })
      .maybeSingle(),
    getNotebookCategories(),
  ]);

  if (!data) notFound();
  const entry = data as EntryRow;
  const category =
    categories.find((c) => c.slug === entry.metadata?.nb_category) ?? categories[0];
  const notes = Array.isArray(entry.metadata?.notes) ? entry.metadata.notes : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/notebook${category ? `?category=${category.slug}` : ""}`}
        className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <Icon name="arrow-left" /> Not Defterim
      </Link>

      <div className="glass-card rounded-2xl p-5">
        <EditableTitle
          courseId={entry.id}
          title={entry.title}
          save={setNotebookEntryTitle}
          label="Not başlığı"
        />
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
          <EntryCategoryPicker
            entryId={entry.id}
            categories={categories}
            current={category?.slug ?? ""}
          />
          <span>Oluşturulma: {dateFmt.format(new Date(entry.created_at))}</span>
        </div>
      </div>

      <TitledNotes
        heading="Notların"
        description="Her başlık için ayrı bir not tut — biçimlendir, görsel ekleyip boyutlandır."
        sourceId={entry.id}
        initialNotes={notes}
        printHref={`/print/${entry.id}`}
        tagCategory={category?.slug}
      />
    </div>
  );
}
