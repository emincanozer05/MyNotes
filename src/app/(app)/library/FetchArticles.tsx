"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CuratedArticle } from "@/lib/curatedArticles";
import { saveCuratedArticle } from "./actions";

const TOPIC_COLORS: Record<string, string> = {
  "Sakatlık Önleme": "from-rose-500 to-orange-500",
  Rehabilitasyon: "from-cyan-500 to-sky-500",
  "Kuvvet & Güç": "from-amber-500 to-yellow-500",
  Dayanıklılık: "from-emerald-500 to-teal-500",
  "Beslenme & Ergojenik": "from-violet-500 to-fuchsia-500",
};

export function FetchArticles({
  articles,
  savedPmids,
}: {
  articles: CuratedArticle[];
  savedPmids: string[];
}) {
  const router = useRouter();
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState<Set<string>>(new Set(savedPmids));
  const [pending, startTransition] = useTransition();
  const [savingPmid, setSavingPmid] = useState<string | null>(null);

  function handleFetch() {
    setLoading(true);
    // Short delay purely for a satisfying "fetching literature" feel.
    setTimeout(() => {
      setLoading(false);
      setRevealed(true);
    }, 850);
  }

  function handleSave(pmid: string) {
    setSavingPmid(pmid);
    startTransition(async () => {
      const res = await saveCuratedArticle(pmid);
      if (!res.error) {
        setSaved((prev) => new Set(prev).add(pmid));
        router.refresh();
      }
      setSavingPmid(null);
    });
  }

  return (
    <div className="space-y-5">
      {!revealed && (
        <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center dark:border-stone-700">
          <p className="text-sm text-stone-500">
            Sporcular üzerinde yapılmış 6 güncel RCT çalışmasını görmek için:
          </p>
          <button
            onClick={handleFetch}
            disabled={loading}
            className="btn-gradient mt-4 rounded-full px-6 py-3 text-sm font-semibold disabled:opacity-70"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Makaleler getiriliyor…
              </span>
            ) : (
              "⚡ Makaleleri Getir"
            )}
          </button>
        </div>
      )}

      {revealed && (
        <div className="stagger grid gap-4 md:grid-cols-2">
          {articles.map((a) => {
            const isSaved = saved.has(a.pmid);
            const grad = TOPIC_COLORS[a.topic] ?? "from-stone-500 to-stone-600";
            return (
              <article
                key={a.pmid}
                className="glass-card flex flex-col rounded-2xl p-4"
              >
                <span
                  className={`mb-2 w-fit rounded-full bg-gradient-to-r ${grad} px-2.5 py-0.5 text-[11px] font-semibold text-white`}
                >
                  {a.topic}
                </span>
                <h3 className="text-sm font-bold leading-snug">{a.title}</h3>
                <p className="mt-1 text-xs text-stone-500">
                  {a.authors.slice(0, 3).join(", ")}
                  {a.authors.length > 3 ? " ve diğerleri" : ""} · {a.year} ·{" "}
                  {a.journal}
                </p>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
                  {a.abstract}
                </p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <a
                    href={`https://doi.org/${a.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-amber-700 hover:underline dark:text-amber-500"
                  >
                    DOI ↗
                  </a>
                  <button
                    onClick={() => handleSave(a.pmid)}
                    disabled={isSaved || (pending && savingPmid === a.pmid)}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                      isSaved
                        ? "cursor-default bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "btn-gradient"
                    }`}
                  >
                    {isSaved
                      ? "✓ Kütüphanede"
                      : pending && savingPmid === a.pmid
                        ? "Kaydediliyor…"
                        : "+ Kaydet"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
