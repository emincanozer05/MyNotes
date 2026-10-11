"use client";

import { IntentLink } from "@/components/IntentLink";
import type { Source } from "@/lib/types";
import { deleteArticle, getArticleSummary } from "./actions";
import { ArticleTagsEditor } from "./ArticleTagsEditor";
import { ArticleTitleEditor } from "./ArticleTitleEditor";
import { SummaryReadModal } from "./SummaryReadModal";
import {
  articleLink,
  hasSummary,
  isOpenAccess,
  plainText,
  summaryOf,
  tagsOf,
} from "./articleMeta";

function DeleteButton({ id }: { id: string }) {
  return (
    <form action={deleteArticle}>
      <input type="hidden" name="id" value={id} />
      <button
        title="Makaleyi sil"
        aria-label="Makaleyi sil"
        onClick={(e) => {
          if (!window.confirm("Bu makale silinsin mi?")) e.preventDefault();
        }}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm text-stone-400 transition-colors hover:bg-rose-500/10 hover:text-rose-500"
      >
        🗑
      </button>
    </form>
  );
}

/** Small status pill: summary written / not yet, note count. */
function StatusPills({
  summary,
  noteCount,
}: {
  summary: boolean;
  noteCount: number;
}) {
  return (
    <>
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          summary
            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            : "bg-[var(--surface-2)] text-stone-500"
        }`}
      >
        {summary ? "✓ Özet yazıldı" : "Özet yok"}
      </span>
      {noteCount > 0 && (
        <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold text-stone-500">
          📝 {noteCount} not
        </span>
      )}
    </>
  );
}

function Actions({ a, summary }: { a: Source; summary: boolean }) {
  return (
    <>
      <IntentLink
        href={`/library/${a.id}`}
        title={summary ? "Özeti düzenle" : "Özet yaz"}
        className="btn-gradient rounded-full px-3 py-1.5 text-xs font-semibold"
      >
        {summary ? "✎ Özeti düzenle" : "✎ Özet yaz"}
      </IntentLink>
      {summary && (
        <SummaryReadModal
          html={summaryOf(a)}
          loadHtml={() => getArticleSummary(a.id)}
          title={a.title}
          label="📖 Oku"
          className="btn-ghost rounded-full px-3 py-1.5 text-xs font-semibold"
        />
      )}
      <IntentLink
        href={`/library/print/${a.id}`}
        title="A4 çıktı sayfasını aç"
        className="btn-ghost rounded-full px-3 py-1.5 text-xs font-semibold"
      >
        🖨 Çıktı al
      </IntentLink>
    </>
  );
}

/** Article card in the "Notlarım" tab (grid or list layout). */
export function MyNoteCard({
  article: a,
  noteCount,
  allTags,
  layout,
}: {
  article: Source;
  noteCount: number;
  allTags: string[];
  layout: "grid" | "list";
}) {
  const summary = hasSummary(a);
  const preview = summary ? plainText(summaryOf(a)) : "";
  const meta = [a.journal, a.year].filter(Boolean).join(" · ");
  const authors =
    a.authors.slice(0, 3).join(", ") + (a.authors.length > 3 ? " ve diğerleri" : "");

  const title = (
    // No line clamp: the title's inline editor expands in place and a
    // clamped box would hide its input.
    <h4 className="text-sm font-semibold leading-snug">
      <ArticleTitleEditor
        articleId={a.id}
        title={a.title}
        href={articleLink(a)}
      />
    </h4>
  );

  const byline = (
    <p className="mt-1 line-clamp-2 text-xs text-stone-500">
      {authors}
      {meta && (authors ? " · " : "") + meta}
    </p>
  );

  const previewBlock = preview ? (
    <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-stone-600 dark:text-stone-400">
      {preview}
    </p>
  ) : null;

  if (layout === "list") {
    return (
      <article className="glass-card flex flex-col gap-3 rounded-xl p-4 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <ArticleTagsEditor
              articleId={a.id}
              current={tagsOf(a)}
              allTags={allTags}
            />
            {isOpenAccess(a.journal) && (
              <span className="rounded border border-emerald-500/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                Open Access
              </span>
            )}
          </div>
          {title}
          {byline}
          {previewBlock}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 lg:max-w-[22rem] lg:justify-end">
          <StatusPills summary={summary} noteCount={noteCount} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
          <Actions a={a} summary={summary} />
          <DeleteButton id={a.id} />
        </div>
      </article>
    );
  }

  return (
    <article className="glass-card flex flex-col rounded-2xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <ArticleTagsEditor
            articleId={a.id}
            current={tagsOf(a)}
            allTags={allTags}
          />
        </div>
        <DeleteButton id={a.id} />
      </div>

      <div className="mt-2.5">
        {title}
        {byline}
      </div>
      {previewBlock}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <StatusPills summary={summary} noteCount={noteCount} />
        {isOpenAccess(a.journal) && (
          <span className="rounded border border-emerald-500/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            Open Access
          </span>
        )}
      </div>

      {/* Actions pinned to the bottom so cards line up */}
      <div className="mt-auto pt-4">
        <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--border)] pt-3">
          <Actions a={a} summary={summary} />
        </div>
      </div>
    </article>
  );
}
