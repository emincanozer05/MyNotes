import { createClient } from "@/lib/supabase/server";
import type { Source } from "@/lib/types";
import { CURATED_ARTICLES } from "@/lib/curatedArticles";
import { LiteratureTabs } from "./LiteratureTabs";

export default async function LibraryPage() {
  const supabase = await createClient();

  const [{ data: articlesData }, { data: noteRefs }] = await Promise.all([
    supabase
      .from("sources")
      .select("*")
      .eq("kind", "article")
      .order("created_at", { ascending: false }),
    supabase
      .from("notes")
      .select("source_id, title")
      .not("source_id", "is", null),
  ]);

  const articles = (articlesData ?? []) as Source[];

  // Count notes per source id (plain object so it can cross to the client)
  const noteCounts: Record<string, number> = {};
  for (const r of noteRefs ?? []) {
    if (r.source_id) {
      noteCounts[r.source_id] = (noteCounts[r.source_id] ?? 0) + 1;
    }
  }

  const todayLabel = new Date().toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div className="animate-in">
        <h1 className="text-4xl font-extrabold italic tracking-tight">
          <span className="gradient-text">Literatür</span>
        </h1>
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
          Günlük makale akışını incele, beğendiklerini kaydet, kendi
          makalelerini ekle ve not aldıklarını A4 olarak yazdır.
        </p>
      </div>

      <LiteratureTabs
        saved={articles}
        noteCounts={noteCounts}
        curated={CURATED_ARTICLES}
        todayLabel={todayLabel}
      />
    </div>
  );
}
