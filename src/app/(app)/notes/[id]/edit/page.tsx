import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NoteForm } from "../../NoteForm";

export default async function EditNotePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: note }, { data: sources }] = await Promise.all([
    supabase
      .from("notes")
      .select("*, note_tags(tags(name))")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("sources")
      .select("id, title, authors, year")
      .order("created_at", { ascending: false }),
  ]);

  if (!note) notFound();

  const tags = (note.note_tags as { tags: { name: string } | null }[])
    .map((t) => t.tags?.name)
    .filter(Boolean)
    .join(", ");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Notu Düzenle</h1>
      <NoteForm
        sources={sources ?? []}
        error={error}
        note={{ ...note, tags }}
      />
    </div>
  );
}
