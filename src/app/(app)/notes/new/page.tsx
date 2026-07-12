import { createClient } from "@/lib/supabase/server";
import { getCategories } from "../../categoriesActions";
import { NoteForm } from "../NoteForm";

export default async function NewNotePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; source?: string; category?: string }>;
}) {
  const { error, source, category } = await searchParams;
  const supabase = await createClient();
  const [{ data: sources }, categories] = await Promise.all([
    supabase
      .from("sources")
      .select("id, title, authors, year")
      .order("created_at", { ascending: false }),
    getCategories(),
  ]);

  // Pre-fill the source reference when arriving from a library article.
  const preset = source
    ? (sources ?? []).find((s) => s.id === source)
    : undefined;
  const initialNote =
    preset || category
      ? {
          ...(category ? { category } : {}),
          ...(preset
            ? {
                source_id: preset.id,
                source_title: preset.title,
                source_author: preset.authors.join(", "),
                source_year: preset.year,
              }
            : {}),
        }
      : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-extrabold tracking-tight">
        <span className="gradient-text">Yeni Not</span>
      </h1>
      <NoteForm
        sources={sources ?? []}
        error={error}
        note={initialNote}
        categories={categories}
      />
    </div>
  );
}
