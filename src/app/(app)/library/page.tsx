import { createClient } from "@/lib/supabase/server";
import type { Source } from "@/lib/types";
import { CURATED_ARTICLES } from "@/lib/curatedArticles";
import { LiteratureTabs } from "./LiteratureTabs";
import { PageHeader } from "@/components/PageHeader";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const supabase = await createClient();

  // library_articles() (migration 0011) returns the same rows with <img> tags
  // stripped from summaries, so embedded base64 images never cross the
  // network just to render the list. The "Oku" modal loads the full summary
  // on demand.
  const [articlesRes, { data: noteRefs }] = await Promise.all([
    supabase.rpc("library_articles"),
    supabase
      .from("notes")
      .select("source_id")
      .not("source_id", "is", null),
  ]);

  // Without the 0011 migration the RPC doesn't exist — fall back to the raw
  // (heavier) select.
  const articlesData = articlesRes.error
    ? (
        await supabase
          .from("sources")
          .select("*")
          .eq("kind", "article")
          .order("created_at", { ascending: false })
      ).data
    : articlesRes.data;

  const articles = (articlesData ?? []) as Source[];

  // Count notes per source id (plain object so it can cross to the client)
  const noteCounts: Record<string, number> = {};
  for (const r of noteRefs ?? []) {
    if (r.source_id) {
      noteCounts[r.source_id] = (noteCounts[r.source_id] ?? 0) + 1;
    }
  }

  // The feed auto-fetches fresh PubMed articles client-side; the curated set
  // is only the fallback, shuffled per request so even it varies on refresh.
  // (Deliberately impure: this server component renders once per request.)
  // eslint-disable-next-line react-hooks/purity
  const curated = [...CURATED_ARTICLES].sort(() => Math.random() - 0.5);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="Literatür"
        description="Günlük makale akışını incele, beğendiklerini kaydet, kendi makalelerini ekle ve özetlerini A4 olarak çıktı al."
      />

      <LiteratureTabs
        initialTab={tab}
        saved={articles}
        noteCounts={noteCounts}
        curated={curated}
      />
    </div>
  );
}
