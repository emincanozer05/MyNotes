import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Source } from "@/lib/types";
import { PrintButton } from "./PrintButton";

interface NoteRow {
  id: string;
  title: string;
  content: string;
  source_page: string | null;
  updated_at: string;
  note_tags: { tags: { name: string } | null }[];
}

export default async function PrintArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: articleData }, { data: notesData }] = await Promise.all([
    supabase.from("sources").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("notes")
      .select(
        "id, title, content, source_page, updated_at, note_tags(tags(name))",
      )
      .eq("source_id", id)
      .order("updated_at", { ascending: false }),
  ]);

  if (!articleData) notFound();
  const article = articleData as Source;
  const notes = (notesData ?? []) as unknown as NoteRow[];

  // The user's own rich-text summary (written on /library/[id]) is the main
  // thing worth printing, so it goes on the sheet ahead of the notes.
  const summary =
    (article.metadata as { summary?: string } | null)?.summary ?? "";
  const hasSummary = Boolean(summary.replace(/<[^>]*>/g, "").trim());

  return (
    <div className="space-y-4">
      <div className="no-print mx-auto flex max-w-[210mm] items-center justify-between">
        <Link
          href="/library"
          className="text-sm text-stone-500 hover:text-amber-600"
        >
          ← Literatür
        </Link>
        <PrintButton />
      </div>

      <div className="a4-sheet">
        <header className="border-b-2 border-stone-800 pb-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            NoteFlow — Makale Not Föyü
          </p>
          <h1 className="mt-2 text-xl font-bold leading-snug">
            {article.title}
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            {article.authors.join(", ")}
            {article.year && ` · ${article.year}`}
            {article.journal && ` · ${article.journal}`}
          </p>
          {article.doi && (
            <p className="mt-0.5 text-xs text-stone-500">DOI: {article.doi}</p>
          )}
        </header>

        {article.abstract && (
          <section className="mt-4">
            <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
              Makale Özeti (Abstract)
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-stone-700">
              {article.abstract}
            </p>
          </section>
        )}

        {hasSummary && (
          <section className="mt-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
              Kendi Özetim
            </h2>
            <div
              className="note-html mt-1 text-sm text-stone-800"
              dangerouslySetInnerHTML={{ __html: summary }}
            />
          </section>
        )}

        {notes.length > 0 && (
          <section className="mt-6">
            <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">
              Notlarım ({notes.length})
            </h2>
            <div className="mt-2 space-y-5">
              {notes.map((n) => {
                const tags = n.note_tags
                  .map((t) => t.tags?.name)
                  .filter((x): x is string => Boolean(x));
                return (
                  <article
                    key={n.id}
                    className="break-inside-avoid border-l-4 border-amber-500 pl-3"
                  >
                    <h3 className="text-base font-semibold">{n.title}</h3>
                    {n.source_page && (
                      <p className="text-xs text-stone-500">
                        s. {n.source_page}
                      </p>
                    )}
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-stone-800">
                      {n.content || "—"}
                    </p>
                    {tags.length > 0 && (
                      <p className="mt-1 text-xs text-stone-500">
                        {tags.map((t) => `#${t}`).join("  ")}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {!hasSummary && notes.length === 0 && !article.abstract && (
          <p className="mt-6 text-sm text-stone-500">
            Bu makale için henüz özet ya da not yazılmamış.
          </p>
        )}

        <footer className="mt-8 border-t border-stone-300 pt-2 text-xs text-stone-400">
          {new Date().toLocaleDateString("tr-TR")} · NoteFlow
        </footer>
      </div>
    </div>
  );
}
