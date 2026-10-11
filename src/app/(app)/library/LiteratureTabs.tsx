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
import { MyNoteCard } from "./MyNoteCard";
import {
  FilterChips,
  LibraryToolbar,
  type SortId,
  type ViewId,
} from "./LibraryToolbar";
import {
  articleLink,
  hasSummary,
  isMyNote,
  isOpenAccess,
  matchesQuery,
  sortArticles,
  tagsOf,
  topicOf,
} from "./articleMeta";

type TabId = "feed" | "saved" | "annotated";

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
  // Local list controls shared by "Kaydedilenler" and "Notlarım".
  const [listQuery, setListQuery] = useState("");
  const [sort, setSort] = useState<SortId>("added");
  const [view, setView] = useState<ViewId>("grid");
  const [topicsExpanded, setTopicsExpanded] = useState(false);
  const [savedTagsExpanded, setSavedTagsExpanded] = useState(false);
  const [noteTagsExpanded, setNoteTagsExpanded] = useState(false);
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

  /** Distinct values with usage counts, most used first. */
  function countItems(values: string[][]): { value: string; count: number }[] {
    const m = new Map<string, number>();
    for (const vs of values) for (const v of vs) m.set(v, (m.get(v) ?? 0) + 1);
    return [...m.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((x, y) => y.count - x.count || x.value.localeCompare(y.value, "tr"));
  }

  const topicItems = useMemo(
    () => countItems(savedList.map((a) => [topicOf(a)])),
    [savedList],
  );

  // Tags present in the saved list (filter chips in "Kaydedilenler").
  const savedTagItems = useMemo(
    () => countItems(savedList.map(tagsOf)),
    [savedList],
  );

  // Tags present in "Notlarım" (filter chips) + the filtered list itself.
  const noteTagItems = useMemo(
    () => countItems(notlarim.map(tagsOf)),
    [notlarim],
  );

  const notlarimFiltered = useMemo(() => {
    let list = notlarim.filter((a) => matchesQuery(a, listQuery));
    if (noteTagFilter !== "all") {
      list = list.filter((a) => tagsOf(a).includes(noteTagFilter));
    }
    return sortArticles(list, sort);
  }, [notlarim, noteTagFilter, listQuery, sort]);

  const savedFilteredCount = useMemo(() => {
    let n = 0;
    for (const a of savedList) {
      if (!matchesQuery(a, listQuery)) continue;
      if (topicFilter !== "all" && topicOf(a) !== topicFilter) continue;
      if (tagFilter !== "all" && !tagsOf(a).includes(tagFilter)) continue;
      n++;
    }
    return n;
  }, [savedList, listQuery, topicFilter, tagFilter]);

  const byTopic = useMemo(() => {
    let filtered = savedList.filter((a) => matchesQuery(a, listQuery));
    if (topicFilter !== "all") {
      filtered = filtered.filter((a) => topicOf(a) === topicFilter);
    }
    if (tagFilter !== "all") {
      filtered = filtered.filter((a) => tagsOf(a).includes(tagFilter));
    }
    const m = new Map<string, Source[]>();
    for (const a of sortArticles(filtered, sort)) {
      const t = topicOf(a);
      if (!m.has(t)) m.set(t, []);
      m.get(t)!.push(a);
    }
    return m;
  }, [savedList, topicFilter, tagFilter, listQuery, sort]);

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
          className="mb-1 flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto"
        >
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="PubMed'de anahtar kelime ara…"
              aria-label="Anahtar kelime ile PubMed'de literatür tara"
              className="w-full rounded-full border border-[var(--border)] bg-[var(--surface-2)] py-2 pl-4 pr-9 text-xs font-medium outline-none transition-colors focus:border-[var(--brand-1)] focus:bg-[var(--surface)] sm:w-72"
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
          <div className="space-y-4">
            <LibraryToolbar
              query={listQuery}
              onQueryChange={setListQuery}
              sort={sort}
              onSortChange={setSort}
              view={view}
              onViewChange={setView}
              shown={savedFilteredCount}
              total={savedList.length}
              showViewToggle={false}
            />

            <FilterChips
              label="Konu:"
              allLabel={`Tümü (${savedList.length})`}
              items={topicItems}
              active={topicFilter}
              onChange={setTopicFilter}
              expanded={topicsExpanded}
              onToggleExpanded={() => setTopicsExpanded((v) => !v)}
            />

            {savedTagItems.length > 0 && (
              <FilterChips
                label="Etiket:"
                allLabel="Tümü"
                items={savedTagItems}
                active={tagFilter}
                onChange={setTagFilter}
                prefix="#"
                expanded={savedTagsExpanded}
                onToggleExpanded={() => setSavedTagsExpanded((v) => !v)}
              />
            )}

            {byTopic.size === 0 && (
              <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500 dark:border-stone-700">
                Bu arama / filtrelerle eşleşen makale yok.
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
                      const summary = hasSummary(a);
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
                                title="Makaleyi sil"
                                aria-label="Makaleyi sil"
                                onClick={(e) => {
                                  if (!window.confirm("Bu makale silinsin mi?"))
                                    e.preventDefault();
                                }}
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm text-stone-400 transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                              >
                                🗑
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
                              {summary ? "✎ Özeti düzenle" : "✎ Özet yaz"}
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
            <LibraryToolbar
              query={listQuery}
              onQueryChange={setListQuery}
              sort={sort}
              onSortChange={setSort}
              view={view}
              onViewChange={setView}
              shown={notlarimFiltered.length}
              total={notlarim.length}
            />

            {noteTagItems.length > 0 && (
              <FilterChips
                label="Etiket:"
                allLabel={`Tümü (${notlarim.length})`}
                items={noteTagItems}
                active={noteTagFilter}
                onChange={setNoteTagFilter}
                prefix="#"
                expanded={noteTagsExpanded}
                onToggleExpanded={() => setNoteTagsExpanded((v) => !v)}
              />
            )}

            {notlarimFiltered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500 dark:border-stone-700">
                <p>Bu arama / etiketle eşleşen makale yok.</p>
                <button
                  type="button"
                  onClick={() => {
                    setListQuery("");
                    setNoteTagFilter("all");
                  }}
                  className="mt-2 text-xs font-semibold text-amber-700 hover:underline dark:text-amber-400"
                >
                  ✕ Filtreleri temizle
                </button>
              </div>
            ) : (
              <div
                className={
                  view === "grid"
                    ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
                    : "space-y-2"
                }
              >
                {notlarimFiltered.map((a) => (
                  <MyNoteCard
                    key={a.id}
                    article={a}
                    noteCount={noteCounts[a.id] ?? 0}
                    allTags={allTags}
                    layout={view}
                  />
                ))}
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
