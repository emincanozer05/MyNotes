import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Source } from "@/lib/types";
import { CURATED_ARTICLES } from "@/lib/curatedArticles";
import { FetchArticles } from "./FetchArticles";
import { ImportForm } from "./ImportForm";
import { deleteArticle } from "./actions";

function topicOf(a: Source): string {
  const t = (a.metadata as { topic?: string } | null)?.topic;
  return t && t.trim() ? t : "Diğer";
}

function SectionHeading({
  n,
  title,
  desc,
}: {
  n: number;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 text-sm font-black text-white shadow-lg">
        {n}
      </span>
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-sm text-stone-500 dark:text-stone-400">{desc}</p>
      </div>
    </div>
  );
}

export default async function LibraryPage() {
  const supabase = await createClient();

  const [{ data: articlesData }, { data: noteRefs }] = await Promise.all([
    supabase
      .from("sources")
      .select("*")
      .eq("kind", "article")
      .order("created_at", { ascending: false }),
    supabase.from("notes").select("source_id, title").not("source_id", "is", null),
  ]);

  const articles = (articlesData ?? []) as Source[];
  const savedPmids = articles
    .map((a) => a.pmid)
    .filter((p): p is string => Boolean(p));

  // Count notes per source id
  const notesBySource = new Map<string, number>();
  for (const r of noteRefs ?? []) {
    if (r.source_id) {
      notesBySource.set(r.source_id, (notesBySource.get(r.source_id) ?? 0) + 1);
    }
  }

  // Section 2: group saved articles by topic
  const byTopic = new Map<string, Source[]>();
  for (const a of articles) {
    const t = topicOf(a);
    if (!byTopic.has(t)) byTopic.set(t, []);
    byTopic.get(t)!.push(a);
  }
  const topics = [...byTopic.keys()].sort();

  // Section 3: articles that have notes
  const annotated = articles.filter((a) => notesBySource.get(a.id));

  return (
    <div className="mx-auto max-w-5xl space-y-12">
      <div className="animate-in">
        <h1 className="text-4xl font-extrabold tracking-tight">
          <span className="gradient-text">Literatür</span>
        </h1>
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
          Sporcular üzerindeki RCT çalışmalarını getir, konu başlığına göre
          kütüphaneni oluştur ve not aldıklarını A4 olarak yazdır.
        </p>
      </div>

      {/* ---------- Section 1: fetch curated RCTs ---------- */}
      <section className="space-y-4">
        <SectionHeading
          n={1}
          title="RCT Makalelerini Getir"
          desc="Sporcular üzerinde yapılmış 6 randomize kontrollü çalışma."
        />
        <FetchArticles articles={CURATED_ARTICLES} savedPmids={savedPmids} />

        <details className="rounded-xl border border-[var(--border)] p-4">
          <summary className="cursor-pointer text-sm font-medium text-stone-600 dark:text-stone-400">
            DOI / PubMed kimliği ile elle ekle
          </summary>
          <div className="mt-3">
            <ImportForm />
          </div>
        </details>
      </section>

      {/* ---------- Section 2: saved articles by topic ---------- */}
      <section className="space-y-4">
        <SectionHeading
          n={2}
          title="Kaydedilen Makaleler"
          desc="Kütüphanendeki makaleler konu başlıklarına göre gruplanır."
        />
        {topics.length > 0 ? (
          <div className="space-y-6">
            {topics.map((topic) => (
              <div key={topic}>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
                  <span className="h-2 w-2 rounded-full bg-gradient-to-r from-amber-500 to-rose-500" />
                  {topic}
                  <span className="text-xs font-normal text-stone-400">
                    ({byTopic.get(topic)!.length})
                  </span>
                </h3>
                <div className="space-y-2">
                  {byTopic.get(topic)!.map((a) => {
                    const noteCount = notesBySource.get(a.id) ?? 0;
                    return (
                      <article
                        key={a.id}
                        className="accent-bar glass-card rounded-xl p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold leading-snug">
                              {a.title}
                            </h4>
                            <p className="mt-1 text-xs text-stone-500">
                              {a.authors.slice(0, 4).join(", ")}
                              {a.authors.length > 4 ? " ve diğerleri" : ""}
                              {a.year && ` · ${a.year}`}
                              {a.journal && ` · ${a.journal}`}
                            </p>
                          </div>
                          <form action={deleteArticle}>
                            <input type="hidden" name="id" value={a.id} />
                            <button className="shrink-0 text-xs text-stone-400 hover:text-rose-500">
                              Sil
                            </button>
                          </form>
                        </div>
                        {a.abstract && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs font-medium text-amber-700 dark:text-amber-500">
                              Özet
                            </summary>
                            <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
                              {a.abstract}
                            </p>
                          </details>
                        )}
                        <div className="mt-2 flex items-center gap-3 text-xs">
                          {a.doi && (
                            <a
                              href={`https://doi.org/${a.doi}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-stone-500 hover:text-amber-600"
                            >
                              DOI ↗
                            </a>
                          )}
                          <Link
                            href={`/notes/new?source=${a.id}`}
                            className="text-amber-700 hover:underline dark:text-amber-500"
                          >
                            + Not al
                          </Link>
                          {noteCount > 0 && (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {noteCount} not
                            </span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500 dark:border-stone-700">
            Henüz kaydedilmiş makale yok. Yukarıdan makale getirip kaydedin.
          </p>
        )}
      </section>

      {/* ---------- Section 3: annotated articles (printable) ---------- */}
      <section className="space-y-4">
        <SectionHeading
          n={3}
          title="Not Aldığım Makaleler"
          desc="Not aldığın makaleleri A4 boyutunda çıktı olarak yazdır."
        />
        {annotated.length > 0 ? (
          <div className="space-y-2">
            {annotated.map((a) => (
              <div
                key={a.id}
                className="glass-card flex items-center justify-between gap-3 rounded-xl p-4"
              >
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-semibold">{a.title}</h4>
                  <p className="text-xs text-stone-500">
                    {notesBySource.get(a.id)} not ·{" "}
                    {a.authors.slice(0, 2).join(", ")}
                    {a.year && ` (${a.year})`}
                  </p>
                </div>
                <Link
                  href={`/library/print/${a.id}`}
                  className="shrink-0 rounded-full border border-[var(--border)] px-4 py-1.5 text-xs font-semibold transition-colors hover:bg-stone-500/10"
                >
                  🖨 Yazdır (A4)
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500 dark:border-stone-700">
            Bir makaleyi seçip &quot;+ Not al&quot; ile not aldığında burada
            yazdırılabilir olarak görünecek.
          </p>
        )}
      </section>
    </div>
  );
}
