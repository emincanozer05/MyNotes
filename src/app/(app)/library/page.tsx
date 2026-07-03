import { createClient } from "@/lib/supabase/server";
import type { Source } from "@/lib/types";
import { ImportForm } from "./ImportForm";

function ArticleCard({ article }: { article: Source }) {
  const authorLine =
    article.authors.length > 4
      ? `${article.authors.slice(0, 4).join(", ")} ve diğerleri`
      : article.authors.join(", ");

  return (
    <article className="card p-4">
      <h3 className="font-semibold leading-snug">{article.title}</h3>
      <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
        {authorLine}
        {article.year && ` · ${article.year}`}
        {article.journal && ` · ${article.journal}`}
      </p>
      {article.abstract && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-medium text-amber-700 dark:text-amber-500">
            Özet
          </summary>
          <p className="mt-1 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
            {article.abstract}
          </p>
        </details>
      )}
      <div className="mt-2 flex gap-3 text-xs text-stone-500">
        {article.doi && (
          <a
            href={`https://doi.org/${article.doi}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-amber-600"
          >
            DOI: {article.doi}
          </a>
        )}
        {article.pmid && (
          <a
            href={`https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-amber-600"
          >
            PMID: {article.pmid}
          </a>
        )}
      </div>
    </article>
  );
}

export default async function LibraryPage() {
  const supabase = await createClient();
  const { data: articles } = await supabase
    .from("sources")
    .select("*")
    .eq("kind", "article")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Literatür</h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          DOI veya PubMed kimliği yapıştırın; makale adı, yazarlar, yıl, dergi
          ve özet otomatik çekilip kütüphanenize eklenir.
        </p>
      </div>

      <ImportForm />

      {articles && articles.length > 0 ? (
        <div className="space-y-3">
          {(articles as Source[]).map((a) => (
            <ArticleCard key={a.id} article={a} />
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-stone-300 dark:border-stone-700 p-8 text-center text-sm text-stone-500">
          Kütüphaneniz henüz boş. İlk makalenizi yukarıdan içe aktarın — örn.{" "}
          <code className="font-mono">10.1136/bjsports-2015-095788</code>
        </p>
      )}
    </div>
  );
}
