"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Source } from "@/lib/types";
import type { CuratedArticle } from "@/lib/curatedArticles";
import {
  saveCuratedArticle,
  saveFetchedArticle,
  unsaveCuratedArticle,
  deleteArticle,
} from "./actions";
import { AddArticleForm } from "./AddArticleForm";
import { TranslatedTitle } from "./TranslatedTitle";
import { ArticleTopicEditor } from "./ArticleTopicEditor";
import { SummaryReadModal } from "./SummaryReadModal";

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

function isMyNote(a: Source): boolean {
  return Boolean((a.metadata as { mynote?: boolean } | null)?.mynote);
}

function summaryOf(a: Source): string {
  return (a.metadata as { summary?: string } | null)?.summary ?? "";
}

function hasSummary(a: Source): boolean {
  return Boolean(summaryOf(a).replace(/<[^>]*>/g, "").trim());
}

function articleLink(a: Source): string | null {
  return a.url ?? (a.doi ? `https://doi.org/${a.doi}` : null);
}

/** Shape shown in the feed — curated or live-fetched (year may be missing). */
interface FeedArticle {
  title: string;
  authors: string[];
  year: number | null;
  journal: string;
  doi: string;
  pmid: string;
  topic: string;
  abstract: string;
}

function feedLink(a: FeedArticle): string {
  return a.doi
    ? `https://doi.org/${a.doi}`
    : `https://pubmed.ncbi.nlm.nih.gov/${a.pmid}/`;
}

function OpenAccessBadge() {
  return (
    <span className="rounded border border-emerald-500/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
      Open Access
    </span>
  );
}

/** Article card in the daily feed. */
function FeedCard({
  article,
  isSaved,
  busy,
  error,
  onSave,
  onUnsave,
}: {
  article: FeedArticle;
  isSaved: boolean;
  busy: boolean;
  error: string | null;
  onSave: () => void;
  onUnsave: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const link = feedLink(article);

  return (
    <article className="glass-card flex flex-col rounded-2xl border-t-2 border-t-amber-400/70 p-5">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
          {article.topic}
        </span>
        {isOpenAccess(article.journal) && <OpenAccessBadge />}
        {article.year && (
          <span className="ml-auto text-xs font-medium text-stone-400">
            {article.year}
          </span>
        )}
      </div>

      <h3 className="mt-3 text-[15px] font-bold leading-snug">
        <TranslatedTitle text={article.title} href={link} />
      </h3>
      <p className="mt-1.5 text-xs text-stone-500">
        {article.journal} · {article.authors.slice(0, 6).join(", ")}
        {article.authors.length > 6 ? " ve diğerleri" : ""}
      </p>

      {article.abstract && (
        <>
          <p
            className={`mt-3 flex-1 text-xs leading-relaxed text-stone-600 dark:text-stone-400 ${
              expanded ? "" : "line-clamp-4"
            }`}
          >
            {article.abstract}
          </p>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 w-fit text-xs font-semibold text-amber-700 hover:underline dark:text-amber-400"
          >
            {expanded ? "Daralt ↑" : "Devamını oku ↓"}
          </button>
        </>
      )}

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-stone-500 hover:text-amber-600 dark:hover:text-amber-400"
        >
          {article.doi ? "DOI ↗" : "PubMed ↗"}
        </a>
        {isSaved ? (
          <button
            onClick={onUnsave}
            disabled={busy}
            className="rounded-full border border-[var(--border)] px-4 py-1.5 text-xs font-semibold text-stone-600 transition-colors hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-50 dark:text-stone-300"
          >
            {busy ? "…" : "↩ Geri al"}
          </button>
        ) : (
          <button
            onClick={onSave}
            disabled={busy}
            className="btn-gradient rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            {busy ? "Kaydediliyor…" : "★ Kaydet"}
          </button>
        )}
      </div>
      {error && (
        <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">
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
  const [busyPmid, setBusyPmid] = useState<string | null>(null);
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});
  const [topicFilter, setTopicFilter] = useState<string>("all");
  const [fetched, setFetched] = useState<FeedArticle[] | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);

  const savedPmids = useMemo(
    () => new Set(saved.map((a) => a.pmid).filter(Boolean) as string[]),
    [saved],
  );

  // "Kaydedilenler" = articles saved from the daily feed (not own notes).
  const savedList = useMemo(() => saved.filter((a) => !isMyNote(a)), [saved]);

  // "Notlarım" = own-added articles, or ones with a summary / attached notes.
  const notlarim = useMemo(
    () =>
      saved.filter(
        (a) => isMyNote(a) || hasSummary(a) || (noteCounts[a.id] ?? 0) > 0,
      ),
    [saved, noteCounts],
  );

  // All topics across saved + own articles, sorted alphabetically (for the
  // "Konu ekle" dropdown).
  const allTopics = useMemo(() => {
    const set = new Set<string>();
    for (const a of saved) {
      const t = topicOf(a);
      if (t && t !== "Diğer") set.add(t);
    }
    return [...set].sort((a, b) => a.localeCompare(b, "tr"));
  }, [saved]);

  const topics = useMemo(() => {
    const set = new Set<string>();
    for (const a of savedList) set.add(topicOf(a));
    return [...set].sort((a, b) => a.localeCompare(b, "tr"));
  }, [savedList]);

  const byTopic = useMemo(() => {
    const filtered =
      topicFilter === "all"
        ? savedList
        : savedList.filter((a) => topicOf(a) === topicFilter);
    const m = new Map<string, Source[]>();
    for (const a of filtered) {
      const t = topicOf(a);
      if (!m.has(t)) m.set(t, []);
      m.get(t)!.push(a);
    }
    return m;
  }, [savedList, topicFilter]);

  function handleSave(pmid: string) {
    setBusyPmid(pmid);
    setSaveErrors((prev) => ({ ...prev, [pmid]: "" }));
    startTransition(async () => {
      const res = await saveCuratedArticle(pmid);
      if (res.error) setSaveErrors((prev) => ({ ...prev, [pmid]: res.error! }));
      else router.refresh();
      setBusyPmid(null);
    });
  }

  function handleSaveFetched(article: FeedArticle) {
    const pmid = article.pmid;
    setBusyPmid(pmid);
    setSaveErrors((prev) => ({ ...prev, [pmid]: "" }));
    startTransition(async () => {
      const res = await saveFetchedArticle({
        title: article.title,
        authors: article.authors,
        year: article.year,
        journal: article.journal || null,
        doi: article.doi || null,
        pmid: article.pmid || null,
        topic: article.topic,
        abstract: article.abstract || null,
      });
      if (res.error) setSaveErrors((prev) => ({ ...prev, [pmid]: res.error! }));
      else router.refresh();
      setBusyPmid(null);
    });
  }

  function handleUnsave(pmid: string) {
    setBusyPmid(pmid);
    setSaveErrors((prev) => ({ ...prev, [pmid]: "" }));
    startTransition(async () => {
      const res = await unsaveCuratedArticle(pmid);
      if (res.error) setSaveErrors((prev) => ({ ...prev, [pmid]: res.error! }));
      else router.refresh();
      setBusyPmid(null);
    });
  }

  // Fetch 6 fresh RCTs from PubMed for the "Makaleleri Getir" button.
  async function handleFetchArticles() {
    setFetching(true);
    setFetchErr(null);
    try {
      const res = await fetch("/api/articles/fetch");
      const data = await res.json();
      if (!res.ok) {
        setFetchErr(data.error ?? "Makaleler getirilemedi.");
      } else if (!data.articles || data.articles.length === 0) {
        setFetchErr("Yeni makale bulunamadı, tekrar dene.");
      } else {
        setFetched(data.articles as FeedArticle[]);
      }
    } catch {
      setFetchErr("Sunucuya ulaşılamadı.");
    } finally {
      setFetching(false);
    }
  }

  const tabs: { id: TabId; label: string; icon: string; count?: number }[] = [
    { id: "feed", label: "Günlük Akış", icon: "📰" },
    { id: "saved", label: "Kaydedilenler", icon: "★", count: savedList.length },
    { id: "annotated", label: "Notlarım", icon: "✏️", count: notlarim.length },
  ];

  return (
    <div className="space-y-6">
      {/* ---------- Tab bar ---------- */}
      <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border)]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === t.id
                ? "border-amber-400 text-amber-700 dark:text-amber-300"
                : "border-transparent text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
            }`}
          >
            <span aria-hidden>{t.icon}</span>
            {t.label}
            {t.count !== undefined && (
              <span className="rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[11px] font-semibold">
                {t.count}
              </span>
            )}
          </button>
        ))}
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="btn-gradient ml-auto mb-1 rounded-full px-4 py-1.5 text-xs font-semibold"
        >
          {showAdd ? "✕ Kapat" : "+ Kendi Makaleni Ekle"}
        </button>
      </div>

      {/* ---------- Manual add panel (own articles) ---------- */}
      {showAdd && (
        <div className="animate-in space-y-4 rounded-2xl border border-amber-500/30 bg-amber-400/5 p-5">
          <div>
            <h3 className="text-sm font-bold">Kendi makaleni ekle</h3>
            <p className="mt-0.5 text-xs text-stone-500">
              DOI yapıştır, bilgiler otomatik dolsun. Kaydettiğinde{" "}
              <b>Notlarım</b> sekmesine düşer; oradan zengin metin özeti
              yazabilirsin.
            </p>
          </div>
          <AddArticleForm onAdded={() => setTab("annotated")} />
        </div>
      )}

      {/* ---------- Tab: Daily feed ---------- */}
      {tab === "feed" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-stone-500">
              📅 {todayLabel} · günün seçimleri
            </p>
            <button
              onClick={handleFetchArticles}
              disabled={fetching}
              className="btn-gradient rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-60"
            >
              {fetching ? "Getiriliyor…" : "🔄 Makaleleri Getir"}
            </button>
          </div>

          {fetchErr && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400">
              {fetchErr}
            </p>
          )}

          {/* Live-fetched articles */}
          {fetched && fetched.length > 0 && (
            <div className="space-y-3 rounded-2xl border border-amber-500/30 bg-amber-400/5 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold">
                  🔄 Yeni getirilen makaleler{" "}
                  <span className="font-normal text-stone-500">
                    ({fetched.length})
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleFetchArticles}
                    disabled={fetching}
                    className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold transition-colors hover:bg-stone-500/10 disabled:opacity-60"
                  >
                    ↻ Yenile
                  </button>
                  <button
                    onClick={() => setFetched(null)}
                    className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold transition-colors hover:bg-stone-500/10"
                  >
                    ✕ Kapat
                  </button>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {fetched.map((a) => (
                  <FeedCard
                    key={a.pmid}
                    article={a}
                    isSaved={savedPmids.has(a.pmid)}
                    busy={pending && busyPmid === a.pmid}
                    error={saveErrors[a.pmid] || null}
                    onSave={() => handleSaveFetched(a)}
                    onUnsave={() => handleUnsave(a.pmid)}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="stagger grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {curated.map((a) => (
              <FeedCard
                key={a.pmid}
                article={a}
                isSaved={savedPmids.has(a.pmid)}
                busy={pending && busyPmid === a.pmid}
                error={saveErrors[a.pmid] || null}
                onSave={() => handleSave(a.pmid)}
                onUnsave={() => handleUnsave(a.pmid)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ---------- Tab: Saved (topic filter + grouped by topic) ---------- */}
      {tab === "saved" &&
        (savedList.length > 0 ? (
          <div className="space-y-5">
            {/* Topic filter chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold text-stone-500">
                Konu:
              </span>
              <button
                onClick={() => setTopicFilter("all")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  topicFilter === "all"
                    ? "btn-gradient"
                    : "bg-stone-500/10 text-stone-600 hover:bg-stone-500/20 dark:text-stone-300"
                }`}
              >
                Tümü ({savedList.length})
              </button>
              {topics.map((t) => {
                const n = savedList.filter((a) => topicOf(a) === t).length;
                return (
                  <button
                    key={t}
                    onClick={() => setTopicFilter(t)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      topicFilter === t
                        ? "btn-gradient"
                        : "bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-300"
                    }`}
                  >
                    {t} ({n})
                  </button>
                );
              })}
            </div>

            {[...byTopic.keys()]
              .sort((a, b) => a.localeCompare(b, "tr"))
              .map((topic) => (
                <div key={topic}>
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    {topic}
                    <span className="text-xs font-normal text-stone-400">
                      ({byTopic.get(topic)!.length})
                    </span>
                  </h3>
                  <div className="space-y-2">
                    {byTopic.get(topic)!.map((a) => {
                      const noteCount = noteCounts[a.id] ?? 0;
                      return (
                        <article
                          key={a.id}
                          className="glass-card rounded-xl p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              {isOpenAccess(a.journal) && (
                                <div className="mb-1">
                                  <OpenAccessBadge />
                                </div>
                              )}
                              <h4 className="text-sm font-semibold leading-snug">
                                <TranslatedTitle
                                  text={a.title}
                                  href={articleLink(a)}
                                />
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
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <ArticleTopicEditor
                              articleId={a.id}
                              current={topicOf(a)}
                              topics={allTopics}
                            />
                            {a.doi && (
                              <a
                                href={`https://doi.org/${a.doi}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-stone-500 hover:text-amber-600 dark:hover:text-amber-400"
                              >
                                DOI ↗
                              </a>
                            )}
                            <Link
                              href={`/library/${a.id}`}
                              className="font-semibold text-amber-700 hover:underline dark:text-amber-400"
                            >
                              ✎ Özet yaz
                            </Link>
                            <Link
                              href={`/notes/new?source=${a.id}`}
                              className="font-semibold text-amber-700 hover:underline dark:text-amber-400"
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
            Henüz kaydedilmiş makale yok. Günlük Akış&apos;tan kaydet veya
            kendi makaleni ekle.
          </p>
        ))}

      {/* ---------- Tab: Notlarım ---------- */}
      {tab === "annotated" &&
        (notlarim.length > 0 ? (
          <div className="space-y-2">
            {notlarim.map((a) => {
              const noteCount = noteCounts[a.id] ?? 0;
              return (
                <div key={a.id} className="glass-card rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        {isMyNote(a) && (
                          <span className="rounded border border-sky-500/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
                            Kendi eklediğim
                          </span>
                        )}
                        {hasSummary(a) && (
                          <span className="rounded border border-emerald-500/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                            Özet var
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-semibold leading-snug">
                        <TranslatedTitle text={a.title} href={articleLink(a)} />
                      </h4>
                      <p className="mt-1 text-xs text-stone-500">
                        {a.authors.slice(0, 3).join(", ")}
                        {a.year && ` · ${a.year}`}
                        {noteCount > 0 && ` · ${noteCount} not`}
                      </p>
                    </div>
                    <form action={deleteArticle}>
                      <input type="hidden" name="id" value={a.id} />
                      <button className="shrink-0 text-xs text-stone-400 hover:text-rose-500">
                        Sil
                      </button>
                    </form>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <ArticleTopicEditor
                      articleId={a.id}
                      current={topicOf(a)}
                      topics={allTopics}
                    />
                    <Link
                      href={`/library/${a.id}`}
                      className="btn-gradient rounded-full px-4 py-1.5 font-semibold"
                    >
                      ✎ Özet yaz / düzenle
                    </Link>
                    {hasSummary(a) && (
                      <SummaryReadModal
                        html={summaryOf(a)}
                        title={a.title}
                        label="📖 Özeti oku"
                      />
                    )}
                    <Link
                      href={`/notes/new?source=${a.id}`}
                      className="rounded-full border border-[var(--border)] px-4 py-1.5 font-semibold transition-colors hover:bg-stone-500/10"
                    >
                      + Not al
                    </Link>
                    {noteCount > 0 && (
                      <Link
                        href={`/library/print/${a.id}`}
                        className="rounded-full border border-[var(--border)] px-4 py-1.5 font-semibold transition-colors hover:bg-stone-500/10"
                      >
                        🖨 Yazdır (A4)
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500 dark:border-stone-700">
            Kendi makaleni ekle veya kaydettiğin bir makaleye özet/not yaz —
            burada toplanır ve A4 olarak yazdırabilirsin.
          </p>
        ))}
    </div>
  );
}
