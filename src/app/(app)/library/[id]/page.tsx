import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Source } from "@/lib/types";
import { ArticleEditor } from "./ArticleEditor";

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: articleData }, { count: noteCount }] = await Promise.all([
    supabase
      .from("sources")
      .select("*")
      .eq("id", id)
      .eq("kind", "article")
      .maybeSingle(),
    supabase
      .from("notes")
      .select("*", { count: "exact", head: true })
      .eq("source_id", id),
  ]);

  if (!articleData) notFound();
  const article = articleData as Source;
  const topic = (article.metadata as { topic?: string } | null)?.topic;
  const summary = (article.metadata as { summary?: string } | null)?.summary ?? "";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/library"
        className="text-sm text-stone-500 hover:text-lime-600 dark:hover:text-lime-400"
      >
        ← Literatür
      </Link>

      <div className="glass-card rounded-2xl p-5">
        <div className="flex flex-wrap items-center gap-2">
          {topic && (
            <span className="rounded-full border border-lime-500/50 bg-lime-400/10 px-2.5 py-0.5 text-[11px] font-semibold italic text-lime-700 dark:text-lime-300">
              {topic}
            </span>
          )}
          {article.year && (
            <span className="text-xs font-semibold text-stone-400">
              {article.year}
            </span>
          )}
        </div>
        <h1 className="mt-2 text-2xl font-bold italic leading-tight">
          {article.url ? (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline"
            >
              {article.title}
            </a>
          ) : (
            article.title
          )}
        </h1>
        <p className="mt-1 text-sm italic text-stone-500">
          {article.authors.join(", ")}
          {article.journal ? ` · ${article.journal}` : ""}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          {article.doi && (
            <a
              href={`https://doi.org/${article.doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone-500 hover:text-lime-600 dark:hover:text-lime-400"
            >
              DOI ↗
            </a>
          )}
          <Link
            href={`/notes/new?source=${article.id}`}
            className="font-bold text-lime-700 hover:underline dark:text-lime-400"
          >
            + Post-it Not al
          </Link>
          {(noteCount ?? 0) > 0 && (
            <Link
              href={`/notes?source=${article.id}`}
              className="text-emerald-600 hover:underline dark:text-emerald-400"
            >
              {noteCount} bağlı not
            </Link>
          )}
        </div>
        {article.abstract && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-bold italic text-lime-700 dark:text-lime-400">
              Orijinal özet (abstract)
            </summary>
            <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
              {article.abstract}
            </p>
          </details>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-lg font-bold">Makale Özeti</h2>
        <p className="mb-3 text-sm text-stone-500">
          Makaleden aldığınız bilgileri buraya yazın — yazı tipini, boyutunu ve
          rengini ayarlayabilir, görsel ekleyip boyutlandırabilirsiniz.
        </p>
        <ArticleEditor articleId={article.id} initialHtml={summary} />
      </div>
    </div>
  );
}
