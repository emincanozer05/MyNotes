import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Source } from "@/lib/types";
import { ArticleEditor } from "./ArticleEditor";
import { TranslatedTitle } from "../TranslatedTitle";
import { SummaryReadModal } from "../SummaryReadModal";

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
  const summary = (article.metadata as { summary?: string } | null)?.summary ?? "";
  const link = article.url ?? (article.doi ? `https://doi.org/${article.doi}` : null);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/library" className="text-sm text-stone-500 hover:text-amber-600">
        ← Literatür
      </Link>

      <div className="glass-card rounded-2xl border-t-2 border-t-amber-400/70 p-5">
        <h1 className="text-2xl font-bold leading-tight">
          <TranslatedTitle text={article.title} href={link} />
        </h1>
        <p className="mt-1.5 text-sm text-stone-500">
          {article.authors.slice(0, 8).join(", ")}
          {article.authors.length > 8 ? " ve diğerleri" : ""}
          {article.year ? ` · ${article.year}` : ""}
          {article.journal ? ` · ${article.journal}` : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-[var(--border)] px-3 py-1 font-medium hover:bg-stone-500/10"
            >
              Makaleye git ↗
            </a>
          )}
          <Link
            href={`/notes/new?source=${article.id}`}
            className="rounded-full border border-[var(--border)] px-3 py-1 font-medium hover:bg-stone-500/10"
          >
            + Not al
          </Link>
          {(noteCount ?? 0) > 0 && (
            <>
              <Link
                href={`/notes?source=${article.id}`}
                className="rounded-full bg-amber-500/15 px-3 py-1 font-medium text-amber-700 hover:bg-amber-500/25 dark:text-amber-400"
              >
                {noteCount} bağlı not
              </Link>
              <Link
                href={`/library/print/${article.id}`}
                className="rounded-full border border-[var(--border)] px-3 py-1 font-medium hover:bg-stone-500/10"
              >
                🖨 Yazdır (A4)
              </Link>
            </>
          )}
        </div>
        {article.abstract && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-bold text-amber-700 dark:text-amber-400">
              Orijinal özet (abstract)
            </summary>
            <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
              {article.abstract}
            </p>
          </details>
        )}
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Makale Özetin</h2>
          <Link
            href={`/print/${article.id}`}
            className="rounded-full border border-[var(--border)] px-4 py-1.5 text-xs font-semibold transition-colors hover:bg-stone-500/10"
          >
            🖨 Çıktı al (A4)
          </Link>
        </div>
        <p className="mb-3 text-sm text-stone-500">
          Makaleden çıkardığın bilgileri buraya yaz — yazı tipini, boyutunu ve
          rengini ayarlayabilir, görsel ekleyip boyutlandırabilirsin.
        </p>
        <ArticleEditor articleId={article.id} initialHtml={summary} />
        <div className="mt-3 flex items-center gap-2">
          <SummaryReadModal html={summary} title={article.title} />
          <span className="text-xs text-stone-400">
            Kaydettikten sonra özetin ortada, arkası bulanık şekilde açılır.
          </span>
        </div>
      </div>
    </div>
  );
}
