import { createClient } from "@/lib/supabase/server";
import { NoteForm } from "../NoteForm";

export default async function NewNotePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: sources } = await supabase
    .from("sources")
    .select("id, title, authors, year")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Yeni Not</h1>
      <NoteForm sources={sources ?? []} error={error} />
    </div>
  );
}
