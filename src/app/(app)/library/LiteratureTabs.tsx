"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Source } from "@/lib/types";
import type { CuratedArticle } from "@/lib/curatedArticles";
import { saveCuratedArticle, deleteArticle } from "./actions";
import { AddArticleForm } from "./AddArticleForm";
import { TranslatableTitle } from "./TranslatableTitle";

type TabId = "feed" | "saved" | "annotated";

/** Journals in the curated set that publish open access. */
const OA_JOURNALS = [
  "scientific reports",
  "plos",
  "medicina",
  "journal of sports science & medicine",
  "frontiers",
  "bmc",
  "peerj",
];

function isOpenAccess(journal: string | null): boolean {
  if (!journal) return false;
  const j = journal.toLowerCase();
  return OA_JOURNALS.some((oa) => j.includes(oa));
}

function topicOf(a: Source): string {
  const t = (a.metadata as { topic?: string } | null)?.topic;
  return t && t.trim() ? t : "Diğer";
}

function isManual(a: Source): boolean {
  return Boolean((a.metadata as { manual?: boolean } | null)?.manual);
}

function hasSummary(a: Source): boolean {
  return Boolean(
    (a.metadata as { summary?: string } | null)?.summary?.trim(),
  );
}

function TopicChip({ topic }: { topic: string }) {
  return (
    <span className="rounded-full border border-lime-500/50 bg-lime-400/10 px-2.5 py-0.5 text-[11px] font-semibold italic text-lime-700 dark:text-lime-300">
      {topic}
    </span>
  );
}

function OpenAccessBadge() {
  return (
    <span className="rounded border border-emerald-500/50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
      Open Access
    </span>
  );
}

/** Article card in the style of the "researches" feed. */
function FeedCard({
  article,
  isSaved,
  saving,
  error,
  onSave,
}: {
  article: CuratedArticle;
  isSaved: boolean;
  saving: boolean;
  error: string | null;
  onSave: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="glass-card relative flex flex-col overflow-hidden rounded-2xl border-t-2 border-t-lime-400 p-5">
      <div className="flex items-center gap-2">
        <TopicChip topic={article.topic} />
        {isOpenAccess(article.journal) && <OpenAccessBadge />}
        <span className="ml-auto text-xs font-semibold text-stone-400">
          {article.year}
        </span>
      </div>

      <h3 className="mt-3 text-[15px] font-extrabold italic leading-snug">
        <TranslatableTitle
          title={article.title}
          href={`https://doi.org/${article.doi}`}
        />
      </h3>
      <p className="mt-1.5 text-xs italic text-stone-500">
        {article.journal} · {article.authors.slice(0, 6).join(", ")}
        {article.authors.length > 6 ? " ve diğerleri" : ""}
      </p>

      <p
        className={`mt-3 flex-1 text-xs italic leading-relaxed text-stone-600 dark:text-stone-400 ${
          expanded ? "" : "line-clamp-4"
        }`}
      >
        {article.abstract}
      </p>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="mt-1 w-fit text-xs font-bold italic text-lime-700 hover:underline dark:text-lime-400"
      >
        {expanded ? "Daralt ↑" : "Devamını oku ↓"}
      </button>

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
        <a
          href={`https://doi.org/${article.doi}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-stone-500 hover:text-lime-600 dark:hover:text-lime-400"
        >
          DOI ↗
        </a>
        <button
          onClick={onSave}
          disabled={isSaved || saving}
          className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
            isSaved
              ? "cursor-default bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-lime-400 text-stone-900 hover:bg-lime-300"
          }`}
        >
          {isSaved ? "✓ Kaydedildi" : saving ? "Kaydediliyor…" : "★ Kaydet"}
        </button>
      </div>
      {error && (
        <p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}
    </article>
  );
}

export function LiteratureTabs({
  saved,
  noteCounts,
  curated,
  todayLabel,
}: {
  saved: Source[];
  noteCounts: Record<string, number>;
  curated: CuratedArticle[];
  todayLabel: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("feed");
  const [showAdd, setShowAdd] = useState(false);
  const [pending, startTransition] = useTransition();
  const [savingPmid, setSavingPmid] = useState<string | null>(null);
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});
  const [topicFilter, setTopicFilter] = useState<string>("all");

  const savedPmids = useMemo(
    () => new Set(saved.map((a) => a.pmid).filter(Boolean) as string[]),
    [saved],
  );

  // "Kaydedilenler" = curated articles the user starred (not their own uploads).
  const curatedSaved = useMemo(() => saved.filter((a) => !isManual(a)), [saved]);

  // "Not Aldıklarım" = own uploads OR anything the user has taken notes on / summarised.
  const annotated = useMemo(
    () =>
      saved.filter(
        (a) => isManual(a) || (noteCounts[a.id] ?? 0) > 0 || hasSummary(a),
      ),
    [saved, noteCounts],
  );

  const savedTopics = useMemo(() => {
    const s = new Set(curatedSaved.map(topicOf));
    return [...s].sort((a, b) => a.localeCompare(b, "tr"));
  }, [curatedSaved]);

  const visibleSaved = useMemo(
    () =>
      topicFilter === "all"
        ? curatedSaved
        : curatedSaved.filter((a) => topicOf(a) === topicFilter),
    [curatedSaved, topicFilter],
  );

  const savedByTopic = useMemo(() => {
    const m = new Map<string, Source[]>();
    for (const a of visibleSaved) {
      const t = topicOf(a);
      if (!m.has(t)) m.set(t, []);
      m.get(t)!.push(a);
    }
    return m;
  }, [visibleSaved]);

  function handleSave(pmid: string) {
    setSavingPmid(pmid);
    setSaveErrors((prev) => ({ ...prev, [pmid]: "" }));
    startTransition(async () => {
      const res = await saveCuratedArticle(pmid);
      if (res.error) {
        setSaveErrors((prev) => ({ ...prev, [pmid]: res.error! }));
      } else {
        router.refresh();
      }
      setSavingPmid(null);
    });
  }

  const tabs: { id: TabId; label: string; icon: string; count?: number }[] = [
    { id: "feed", label: "Günlük Akış", icon: "📰" },
    {
      id: "saved",
      label: "Kaydedilenler",
      icon: "★",
      count: curatedSaved.length,
    },
    {
      id: "annotated",
      label: "Not Aldıklarım",
      icon: "✏️",
      count: annotated.length,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ---------- Tab bar ---------- */}
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border)]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-bold italic transition-colors ${
              tab === t.id
                ? "border-lime-400 text-lime-700 dark:text-lime-300"
                : "border-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
            }`}
          >
            <span aria-hidden>{t.icon}</span>
            {t.label}
            {t.count !== undefined && (
              <span className="rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[11px] font-semibold not-italic">
                {t.count}
              </span>
            )}
          </button>
        ))}
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="ml-auto mb-1 rounded-full bg-lime-400 px-4 py-1.5 text-xs font-bold text-stone-900 transition-colors hover:bg-lime-300"
        >
          {showAdd ? "✕ Kapat" : "+ Kendi Makaleni Ekle"}
        </button>
      </div>

      {/* ---------- Manual add panel (own articles) ---------- */}
      {showAdd && (
        <div className="animate-in space-y-4 rounded-2xl border border-lime-500/30 bg-lime-400/5 p-5">
          <div>
            <h3 className="text-sm font-extrabold italic">
              Kendi makaleni ekle
            </h3>
            <p className="mt-0.5 text-xs text-stone-500">
              DOI yapıştır, bilgiler otomatik dolsun. Kaydettiğinde
              &quot;Not Aldıklarım&quot; sekmesine eklenir ve makale özeti
              sayfası açılır.
            </p>
          </div>
          <AddArticleForm onAdded={() => setShowAdd(false)} />
        </div>
      )}

      {/* ---------- Tab: Daily feed ---------- */}
      {tab === "feed" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold italic text-stone-500">
              📅 {todayLabel} · günün seçimleri
            </p>
            <span className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-bold italic">
              ⚡ {curated.length} yeni makale
            </span>
          </div>
          <div className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {curated.map((a) => (
              <FeedCard
                key={a.pmid}
                article={a}
                isSaved={savedPmids.has(a.pmid)}
                saving={pending && savingPmid === a.pmid}
                error={saveErrors[a.pmid] || null}
                onSave={() => handleSave(a.pmid)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ---------- Tab: Saved (topic filter + grouped by topic) ---------- */}
      {tab === "saved" &&
        (curatedSaved.length > 0 ? (
          <div className="space-y-5">
            {/* Topic filter */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold text-stone-500">
                Konu:
              </span>
              <button
                onClick={() => setTopicFilter("all")}
                className={`rounded-full px-3 py-1 text-xs font-bold italic transition-colors ${
                  topicFilter === "all"
                    ? "bg-lime-400 text-stone-900"
                    : "bg-stone-500/10 text-stone-600 hover:bg-stone-500/20 dark:text-stone-400"
                }`}
              >
                Tümü
              </button>
              {savedTopics.map((t) => (
                <button
                  key={t}
                  onClick={() => setTopicFilter(t)}
                  className={`rounded-full px-3 py-1 text-xs font-bold italic transition-colors ${
                    topicFilter === t
                      ? "bg-lime-400 text-stone-900"
                      : "bg-lime-400/10 text-lime-700 hover:bg-lime-400/20 dark:text-lime-300"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {[...savedByTopic.keys()].sort().map((topic) => (
              <div key={topic}>
                <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold italic">
                  <span className="h-2 w-2 rounded-full bg-lime-400" />
                  {topic}
                  <span className="text-xs font-normal not-italic text-stone-400">
                    ({savedByTopic.get(topic)!.length})
                  </span>
                </h3>
                <div className="space-y-2">
                  {savedByTopic.get(topic)!.map((a) => {
                    const noteCount = noteCounts[a.id] ?? 0;
                    return (
                      <article
                        key={a.id}
                        className="accent-bar glass-card rounded-xl p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="mb-1 flex items-center gap-2">
                              {isOpenAccess(a.journal) && <OpenAccessBadge />}
                            </div>
                            <h4 className="text-sm font-bold italic leading-snug">
                              <TranslatableTitle
                                title={a.title}
                                href={
                                  a.url ??
                                  (a.doi ? `https://doi.org/${a.doi}` : null)
                                }
                              />
                            </h4>
                            <p className="mt-1 text-xs italic text-stone-500">
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
                            <summary className="cursor-pointer text-xs font-bold italic text-lime-700 dark:text-lime-400">
                              Özet
                            </summary>
                            <p className="mt-1 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
                              {a.abstract}
                            </p>
                          </details>
                        )}
                        <div className="mt-2 flex items-center gap-3 text-xs">
                          <Link
                            href={`/library/${a.id}`}
                            className="font-bold text-lime-700 hover:underline dark:text-lime-400"
                          >
                            📝 Makale özeti
                          </Link>
                          <Link
                            href={`/notes/new?source=${a.id}`}
                            className="font-bold text-lime-700 hover:underline dark:text-lime-400"
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
            Henüz kaydedilmiş makale yok. Günlük Akış&apos;tan ★ ile kaydet.
          </p>
        ))}

      {/* ---------- Tab: Annotated / my notes ---------- */}
      {tab === "annotated" &&
        (annotated.length > 0 ? (
          <div className="space-y-2">
            {annotated.map((a) => {
              const noteCount = noteCounts[a.id] ?? 0;
              return (
                <div
                  key={a.id}
                  className="glass-card flex items-center justify-between gap-3 rounded-xl p-4"
                >
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-2">
                      <TopicChip topic={topicOf(a)} />
                      {isManual(a) && (
                        <span className="rounded border border-sky-500/50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                          Kendi eklediğim
                        </span>
                      )}
                      {hasSummary(a) && (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          ✓ Özet
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-bold italic leading-snug">
                      <TranslatableTitle
                        title={a.title}
                        href={
                          a.url ?? (a.doi ? `https://doi.org/${a.doi}` : null)
                        }
                      />
                    </h4>
                    <p className="text-xs text-stone-500">
                      {a.authors.slice(0, 2).join(", ")}
                      {a.year && ` (${a.year})`}
                      {noteCount > 0 && ` · ${noteCount} not`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Link
                      href={`/library/${a.id}`}
                      className="rounded-full bg-lime-400 px-4 py-1.5 text-xs font-bold text-stone-900 transition-colors hover:bg-lime-300"
                    >
                      📝 Özet
                    </Link>
                    {noteCount > 0 && (
                      <Link
                        href={`/library/print/${a.id}`}
                        className="rounded-full border border-[var(--border)] px-4 py-1.5 text-xs font-semibold transition-colors hover:bg-stone-500/10"
                      >
                        🖨 Yazdır
                      </Link>
                    )}
                    <form action={deleteArticle}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="text-xs text-stone-400 hover:text-rose-500">
                        Sil
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500 dark:border-stone-700">
            Kendi makaleni ekle ya da bir makaleye not/özet al — burada
            görünecek.
          </p>
        ))}
    </div>
  );
}
