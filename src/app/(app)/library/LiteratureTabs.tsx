"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { FormEvent } from "react";
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
import { ArticleTagsEditor } from "./ArticleTagsEditor";
import { ArticleTitleEditor } from "./ArticleTitleEditor";
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

function tagsOf(a: Source): string[] {
  const tags = (a.metadata as { tags?: unknown } | null)?.tags;
  return Array.isArray(tags) ? tags.filter((t): t is string => Boolean(t) && typeof t === "string") : [];
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
    <article className="glass-card flex flex-col rounded-2xl border-t-2 border-t-[var(--brand-1)] p-5">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--accent-text)]">
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
            className="btn-ghost rounded-full px-4 py-1.5 text-xs font-semibold text-[var(--muted)] hover:!border-rose-500/40 hover:text-rose-600 disabled:opacity-50"
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
}: {
  saved: Source[];
  noteCounts: Record<string, number>;
  curated: CuratedArticle[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("feed");
  const [showAdd, setShowAdd] = useState(false);
  const [pending, startTransition] = useTransition();
  const [busyPmid, setBusyPmid] = useState<string | null>(null);
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});
  const [topicFilter, setTopicFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [noteTagFilter, setNoteTagFilter] = useState<string>("all");
  const [fetched, setFetched] = useState<FeedArticle[] | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchErr, setFetchErr] = useState<string | null>(null);
  // Keyword search: `searchInput` is what's typed, `activeQuery` is the
  // keyword the currently shown feed was fetched with (null = daily feed).
  const [searchInput, setSearchInput] = useState("");
  const [activeQuery, setActiveQuery] = useState<string | null>(null);

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

  // All tags across saved + own articles (suggestions for the tag editor).
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const a of saved) for (const t of tagsOf(a)) set.add(t);
    return [...set].sort((a, b) => a.localeCompare(b, "tr"));
  }, [saved]);

  const topics = useMemo(() => {
    const set = new Set<string>();
    for (const a of savedList) set.add(topicOf(a));
    return [...set].sort((a, b) => a.localeCompare(b, "tr"));
  }, [savedList]);

  // Tags present in the saved list (filter chips in "Kaydedilenler").
  const savedTags = useMemo(() => {
    const set = new Set<string>();
    for (const a of savedList) for (const t of tagsOf(a)) set.add(t);
    return [...set].sort((a, b) => a.localeCompare(b, "tr"));
  }, [savedList]);

  // Tags present in "Notlarım" (filter chips) + the filtered list itself.
  const noteTags = useMemo(() => {
    const set = new Set<string>();
    for (const a of notlarim) for (const t of tagsOf(a)) set.add(t);
    return [...set].sort((a, b) => a.localeCompare(b, "tr"));
  }, [notlarim]);

  const notlarimFiltered = useMemo(
    () =>
      noteTagFilter === "all"
        ? notlarim
        : notlarim.filter((a) => tagsOf(a).includes(noteTagFilter)),
    [notlarim, noteTagFilter],
  );

  const byTopic = useMemo(() => {
    let filtered =
      topicFilter === "all"
        ? savedList
        : savedList.filter((a) => topicOf(a) === topicFilter);
    if (tagFilter !== "all") {
      filtered = filtered.filter((a) => tagsOf(a).includes(tagFilter));
    }
    const m = new Map<string, Source[]>();
    for (const a of filtered) {
      const t = topicOf(a);
      if (!m.has(t)) m.set(t, []);
      m.get(t)!.push(a);
    }
    return m;
  }, [savedList, topicFilter, tagFilter]);

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

  // Fetch articles from PubMed. Without a keyword: 6 fresh RCTs, re-rolled on
  // every page load and on "Yenile". With a keyword: the most recent articles
  // matching it, newest first.
  async function handleFetchArticles(query?: string | null) {
    const q = query?.trim() || "";
    setFetching(true);
    setFetchErr(null);
    setActiveQuery(q || null);
    try {
      const res = await fetch(
        q
          ? `/api/articles/fetch?q=${encodeURIComponent(q)}`
          : "/api/articles/fetch",
      );
      const data = await res.json();
      if (!res.ok) {
        setFetchErr(data.error ?? "Makaleler getirilemedi.");
      } else if (!data.articles || data.articles.length === 0) {
        setFetched(q ? [] : null);
        setFetchErr(
          q
            ? `"${q}" için makale bulunamadı. Başka bir anahtar kelime dene.`
            : "Yeni makale bulunamadı, tekrar dene.",
        );
      } else {
        setFetched(data.articles as FeedArticle[]);
      }
    } catch {
      setFetchErr("Sunucuya ulaşılamadı.");
    } finally {
      setFetching(false);
    }
  }

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setTab("feed");
    void handleFetchArticles(searchInput);
  }

  function handleClearSearch() {
    setSearchInput("");
    void handleFetchArticles(null);
  }

  useEffect(() => {
    // Kick off the initial PubMed fetch (an external system); only on mount —
    // refreshing the page is what brings a new batch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void handleFetchArticles();
  }, []);

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
            aria-current={tab === t.id ? "page" : undefined}
            className={`-mb-px flex items-center gap-2 rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-bold transition-colors ${
              tab === t.id
                ? "border-[var(--brand-1)] text-[var(--accent-text)]"
                : "border-transparent text-stone-500 hover:bg-[var(--surface-2)] hover:text-stone-700 dark:hover:text-stone-300"
            }`}
          >
            <span aria-hidden>{t.icon}</span>
            {t.label}
            {t.count !== undefined && (
              <span
                className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                  tab === t.id
                    ? "bg-[var(--accent-soft)] text-[var(--accent-text)]"
                    : "bg-[var(--surface-2)] text-stone-500"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        ))}
        {/* Keyword search — literature scan on any term the user types */}
        <form
          onSubmit={handleSearchSubmit}
          className="ml-auto mb-1 flex items-center gap-2"
        >
          <div className="relative">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Anahtar Kelime Gir…"
              aria-label="Anahtar kelime ile literatür tara"
              className="w-52 rounded-full border border-[var(--border)] bg-[var(--surface-2)] py-2 pl-4 pr-9 text-xs font-medium outline-none transition-colors focus:border-[var(--brand-1)] focus:bg-[var(--surface)] sm:w-64"
            />
            <button
              type="submit"
              disabled={!searchInput.trim() || fetching}
              aria-label="Ara"
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs text-stone-500 transition-colors hover:text-amber-600 disabled:opacity-40 dark:hover:text-amber-400"
            >
              🔍
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowAdd((v) => !v)}
            className="btn-gradient rounded-full px-4 py-1.5 text-xs font-semibold"
          >
            {showAdd ? "✕ Kapat" : "+ Kendi Makaleni Ekle"}
          </button>
        </form>
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
            {activeQuery ? (
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-stone-500">
                <span className="rounded-full bg-amber-400/10 px-2.5 py-0.5 text-xs font-bold text-amber-700 dark:text-amber-300">
                  🔍 {activeQuery}
                </span>
                için PubMed&apos;deki en güncel makaleler.
                <button
                  onClick={handleClearSearch}
                  className="text-xs font-semibold text-amber-700 hover:underline dark:text-amber-400"
                >
                  ✕ Aramayı temizle
                </button>
              </p>
            ) : (
              <p className="text-sm font-medium text-stone-500">
                Her yenilemede PubMed&apos;den taze makaleler gelir.
              </p>
            )}
            <button
              onClick={() => void handleFetchArticles(activeQuery)}
              disabled={fetching}
              className="btn-gradient rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-60"
            >
              {fetching ? "Getiriliyor…" : "🔄 Yenile"}
            </button>
          </div>

          {fetchErr && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400">
              {fetchErr}
            </p>
          )}

          {fetching ? (
            <p className="rounded-2xl border border-dashed border-stone-300 p-10 text-center text-sm text-stone-500 dark:border-stone-700">
              {activeQuery
                ? `"${activeQuery}" için literatür taranıyor…`
                : "Makaleler getiriliyor…"}
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(fetched ?? curated).map((a) => (
                <FeedCard
                  key={a.pmid}
                  article={a}
                  isSaved={savedPmids.has(a.pmid)}
                  busy={pending && busyPmid === a.pmid}
                  error={saveErrors[a.pmid] || null}
                  onSave={() =>
                    fetched ? handleSaveFetched(a) : handleSave(a.pmid)
                  }
                  onUnsave={() => handleUnsave(a.pmid)}
                />
              ))}
            </div>
          )}
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
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  topicFilter === "all" ? "btn-gradient" : "chip"
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
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      topicFilter === t ? "btn-gradient" : "chip chip-accent"
                    }`}
                  >
                    {t} ({n})
                  </button>
                );
              })}
            </div>

            {/* Tag filter chips */}
            {savedTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs font-semibold text-stone-500">
                  Etiket:
                </span>
                <button
                  onClick={() => setTagFilter("all")}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    tagFilter === "all" ? "btn-gradient" : "chip"
                  }`}
                >
                  Tümü
                </button>
                {savedTags.map((t) => {
                  const n = savedList.filter((a) =>
                    tagsOf(a).includes(t),
                  ).length;
                  return (
                    <button
                      key={t}
                      onClick={() =>
                        setTagFilter((prev) => (prev === t ? "all" : t))
                      }
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        tagFilter === t ? "btn-gradient" : "chip chip-accent"
                      }`}
                    >
                      #{t} ({n})
                    </button>
                  );
                })}
              </div>
            )}

            {byTopic.size === 0 && (
              <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500 dark:border-stone-700">
                Bu filtrelerle eşleşen makale yok.
              </p>
            )}

            {[...byTopic.keys()]
              .sort((a, b) => a.localeCompare(b, "tr"))
              .map((topic) => (
                <div key={topic}>
                  <h3 className="section-rule mb-2.5 text-sm font-bold">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--brand-1)]" />
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
                                <ArticleTitleEditor
                                  articleId={a.id}
                                  title={a.title}
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
                              <button
                                onClick={(e) => {
                                  if (!window.confirm("Bu makale silinsin mi?"))
                                    e.preventDefault();
                                }}
                                className="shrink-0 text-xs text-stone-400 hover:text-rose-500"
                              >
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
                            <ArticleTagsEditor
                              articleId={a.id}
                              current={tagsOf(a)}
                              allTags={allTags}
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
          <div className="space-y-4">
            {/* Tag filter chips */}
            {noteTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs font-semibold text-stone-500">
                  Etiket:
                </span>
                <button
                  onClick={() => setNoteTagFilter("all")}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    noteTagFilter === "all" ? "btn-gradient" : "chip"
                  }`}
                >
                  Tümü ({notlarim.length})
                </button>
                {noteTags.map((t) => {
                  const n = notlarim.filter((a) =>
                    tagsOf(a).includes(t),
                  ).length;
                  return (
                    <button
                      key={t}
                      onClick={() =>
                        setNoteTagFilter((prev) => (prev === t ? "all" : t))
                      }
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        noteTagFilter === t
                          ? "btn-gradient"
                          : "chip chip-accent"
                      }`}
                    >
                      #{t} ({n})
                    </button>
                  );
                })}
              </div>
            )}

            {notlarimFiltered.length === 0 ? (
              <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500 dark:border-stone-700">
                Bu etiketle eşleşen makale yok.
              </p>
            ) : (
              /* Rectangular cards laid out side by side, equal height */
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {notlarimFiltered.map((a) => {
                  const noteCount = noteCounts[a.id] ?? 0;
                  return (
                    <article
                      key={a.id}
                      className="glass-card flex flex-col rounded-2xl p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <ArticleTagsEditor
                            articleId={a.id}
                            current={tagsOf(a)}
                            allTags={allTags}
                          />
                        </div>
                        <form action={deleteArticle}>
                          <input type="hidden" name="id" value={a.id} />
                          <button
                            onClick={(e) => {
                              if (!window.confirm("Bu makale silinsin mi?"))
                                e.preventDefault();
                            }}
                            className="shrink-0 text-xs text-stone-400 transition-colors hover:text-rose-500"
                          >
                            Sil
                          </button>
                        </form>
                      </div>

                      {/* No line clamp: the title's inline editor expands in
                          place and a clamped box would hide its input. */}
                      <h4 className="mt-2.5 text-sm font-semibold leading-snug">
                        <ArticleTitleEditor
                          articleId={a.id}
                          title={a.title}
                          href={articleLink(a)}
                        />
                      </h4>
                      <p className="mt-1.5 line-clamp-2 text-xs text-stone-500">
                        {a.authors.slice(0, 3).join(", ")}
                        {a.year && ` · ${a.year}`}
                        {noteCount > 0 && ` · ${noteCount} not`}
                      </p>

                      {/* Actions pinned to the bottom so cards line up */}
                      <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-[var(--border)] pt-3 text-xs">
                        <Link
                          href={`/library/${a.id}`}
                          title="Özet yaz / düzenle"
                          className="btn-gradient rounded-full px-3 py-1.5 font-semibold"
                        >
                          ✎ Özet yaz
                        </Link>
                        {hasSummary(a) && (
                          <SummaryReadModal
                            html={summaryOf(a)}
                            title={a.title}
                            label="📖 Oku"
                            className="btn-ghost rounded-full px-3 py-1.5 text-xs font-semibold"
                          />
                        )}
                        <Link
                          href={`/library/print/${a.id}`}
                          title="A4 çıktı sayfasını aç"
                          className="btn-ghost rounded-full px-3 py-1.5 font-semibold"
                        >
                          🖨 Çıktı al
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500 dark:border-stone-700">
            Kendi makaleni ekle veya kaydettiğin bir makaleye özet/not yaz —
            burada toplanır ve A4 olarak çıktı alabilirsin.
          </p>
        ))}
    </div>
  );
}
