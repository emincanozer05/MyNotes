"use client";

import { IntentLink } from "@/components/IntentLink";
import type { Source } from "@/lib/types";
import { deleteArticle } from "./actions";
import { ArticleTagsEditor } from "./ArticleTagsEditor";
import { ArticleTitleEditor } from "./ArticleTitleEditor";
import { Icon } from "@/components/Icon";
import { articleLink, hasSummary, plainText, tagsOf } from "./articleMeta";

/** Zotero-style creator label: "Zhang", "Zhang ve Li", "Zhang vd.". */
function creatorOf(a: Source): string {
  const last = (name: string) => name.trim().split(/\s+/).pop() ?? name;
  const [first, second] = a.authors;
  if (!first) return "";
  if (a.authors.length === 1) return last(first);
  if (a.authors.length === 2) return `${last(first)} ve ${last(second)}`;
  return `${last(first)} vd.`;
}

const iconBtn =
  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--foreground)]";

/**
 * Quiet row/card actions: summary, A4 print, delete. Dimmed until the item is
 * hovered or focused (always visible on touch screens).
 */
function Actions({ a }: { a: Source }) {
  const summary = hasSummary(a);
  return (
    <div className="touch-show flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
      <IntentLink
        href={`/library/${a.id}`}
        title={summary ? "Özeti oku / düzenle" : "Özet yaz"}
        aria-label={summary ? "Özeti oku / düzenle" : "Özet yaz"}
        className={iconBtn}
      >
        <Icon name={summary ? "book" : "pencil"} className="h-4 w-4" />
      </IntentLink>
      <IntentLink
        href={`/library/print/${a.id}`}
        title="A4 çıktı al"
        aria-label="A4 çıktı al"
        className={iconBtn}
      >
        <Icon name="printer" className="h-4 w-4" />
      </IntentLink>
      <form action={deleteArticle}>
        <input type="hidden" name="id" value={a.id} />
        <button
          title="Makaleyi sil"
          aria-label="Makaleyi sil"
          onClick={(e) => {
            if (!window.confirm("Bu makale silinsin mi?")) e.preventDefault();
          }}
          className={`${iconBtn} hover:!bg-rose-500/10 hover:!text-rose-500`}
        >
          <Icon name="trash" className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

/** Small muted "n not" marker; nothing when the article has no notes. */
function NoteCount({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)]">
      <Icon name="file-text" className="h-3 w-3" />
      {n} not
    </span>
  );
}

function Title({ a, size }: { a: Source; size: "row" | "card" }) {
  // No line clamp: the title's inline editor expands in place and a clamped
  // box would hide its input.
  return (
    <h4
      className={`font-semibold leading-snug ${
        size === "card" ? "text-[15px]" : "text-sm"
      }`}
    >
      <ArticleTitleEditor
        articleId={a.id}
        title={a.title}
        href={articleLink(a)}
        subtle
      />
    </h4>
  );
}

/**
 * "Notlarım" list view — a Zotero-like item table: Başlık | Yazar | Yıl, with
 * the title as the focus and everything else muted.
 */
export function MyNoteList({
  articles,
  noteCounts,
  allTags,
}: {
  articles: Source[];
  noteCounts: Record<string, number>;
  allTags: string[];
}) {
  return (
    <div className="item-table">
      <div
        aria-hidden
        className="item-table-head hidden items-center gap-4 px-4 py-1.5 md:flex"
      >
        <span className="flex-1">Başlık</span>
        <span className="w-36">Yazar</span>
        <span className="w-12">Yıl</span>
        <span className="w-[5.75rem]" />
      </div>
      <ul>
        {articles.map((a) => {
          const creator = creatorOf(a);
          const tags = tagsOf(a);
          const n = noteCounts[a.id] ?? 0;
          return (
            <li
              key={a.id}
              className="item-row group flex items-start gap-4 px-4 py-2.5 md:items-center"
            >
              <div className="min-w-0 flex-1">
                <Title a={a} size="row" />
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-xs text-[var(--muted)] md:hidden">
                    {[creator, a.year].filter(Boolean).join(" · ")}
                  </span>
                  <ArticleTagsEditor
                    articleId={a.id}
                    current={tags}
                    allTags={allTags}
                    subtle
                  />
                  <NoteCount n={n} />
                </div>
              </div>
              <span
                className="hidden w-36 truncate text-xs text-[var(--muted)] md:block"
                title={a.authors.join(", ")}
              >
                {creator || "—"}
              </span>
              <span className="hidden w-12 text-xs tabular-nums text-[var(--muted)] md:block">
                {a.year ?? "—"}
              </span>
              <Actions a={a} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** "Notlarım" card view — just the title, one muted meta line and the tags. */
export function MyNoteCard({
  article: a,
  noteCount,
  allTags,
}: {
  article: Source;
  noteCount: number;
  allTags: string[];
}) {
  const meta = [creatorOf(a), a.year, a.journal && plainText(a.journal)]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="glass-card group flex flex-col rounded-lg p-4">
      <Title a={a} size="card" />
      {meta && (
        <p className="mt-1.5 truncate text-xs text-[var(--muted)]" title={meta}>
          {meta}
        </p>
      )}
      <div className="mt-auto flex items-end justify-between gap-2 pt-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <ArticleTagsEditor
            articleId={a.id}
            current={tagsOf(a)}
            allTags={allTags}
            subtle
          />
          <NoteCount n={noteCount} />
        </div>
        <Actions a={a} />
      </div>
    </article>
  );
}
