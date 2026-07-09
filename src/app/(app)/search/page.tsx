import Link from "next/link";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";

const MAX_PER_TABLE = 50;
const SNIPPET_CONTEXT = 90;

interface SearchHit {
  href: string | null;
  kindLabel: string;
  title: string;
  snippet: ReactNode;
}

/** Escapes ilike wildcards; double quotes are dropped so the pattern can be
 *  safely quoted inside a PostgREST `or=(…)` filter (commas etc. stay literal). */
function likePattern(q: string): string {
  return `%${q.replace(/"/g, "").replace(/[\\%_]/g, "\\$&")}%`;
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** Builds a short excerpt around the first match, with the hit highlighted. */
function makeSnippet(raw: string, query: string): ReactNode | null {
  const text = stripHtml(raw);
  const idx = text
    .toLocaleLowerCase("tr")
    .indexOf(query.toLocaleLowerCase("tr"));
  if (idx === -1) return null;

  const start = Math.max(0, idx - SNIPPET_CONTEXT);
  const end = Math.min(text.length, idx + query.length + SNIPPET_CONTEXT);

  return (
    <>
      {start > 0 && "…"}
      {text.slice(start, idx)}
      <mark className="rounded bg-amber-200 px-0.5 text-amber-900 dark:bg-amber-500/30 dark:text-amber-200">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length, end)}
      {end < text.length && "…"}
    </>
  );
}

function firstSnippet(
  query: string,
  ...candidates: (string | null | undefined)[]
): ReactNode {
  for (const c of candidates) {
    if (!c) continue;
    const s = makeSnippet(c, query);
    if (s) return s;
  }
  return null;
}

function sourceHref(kind: string, metadata: Record<string, unknown>, id: string) {
  if (kind === "book") return `/bookshelf/${id}`;
  if (kind === "other" && metadata?.category === "course") return `/courses/${id}`;
  return `/library/${id}`;
}

function sourceKindLabel(kind: string, metadata: Record<string, unknown>) {
  if (kind === "book") return "Kitap";
  if (kind === "other" && metadata?.category === "course") return "Kurs";
  return "Makale";
}

async function searchEverything(query: string): Promise<SearchHit[]> {
  const supabase = await createClient();
  const p = likePattern(query);
  const hits: SearchHit[] = [];

  const [notes, sources, highlights, voiceNotes] = await Promise.all([
    supabase
      .from("notes")
      .select("id, title, content")
      .or(`title.ilike."${p}",content.ilike."${p}"`)
      .order("updated_at", { ascending: false })
      .limit(MAX_PER_TABLE),
    supabase
      .from("sources")
      .select("id, kind, title, abstract, metadata")
      .or(
        `title.ilike."${p}",abstract.ilike."${p}",metadata->>summary.ilike."${p}",metadata->>topic.ilike."${p}"`,
      )
      .order("created_at", { ascending: false })
      .limit(MAX_PER_TABLE),
    supabase
      .from("highlights")
      .select("id, note_id, text, comment, notes(title)")
      .or(`text.ilike."${p}",comment.ilike."${p}"`)
      .order("created_at", { ascending: false })
      .limit(MAX_PER_TABLE),
    supabase
      .from("voice_notes")
      .select("id, note_id, transcript")
      .ilike("transcript", p)
      .order("created_at", { ascending: false })
      .limit(MAX_PER_TABLE),
  ]);

  for (const n of notes.data ?? []) {
    hits.push({
      href: `/notes/${n.id}`,
      kindLabel: "Not",
      title: n.title,
      snippet: firstSnippet(query, n.content, n.title),
    });
  }

  for (const s of sources.data ?? []) {
    const metadata = (s.metadata ?? {}) as Record<string, unknown>;
    hits.push({
      href: sourceHref(s.kind, metadata, s.id),
      kindLabel: sourceKindLabel(s.kind, metadata),
      title: s.title,
      snippet: firstSnippet(
        query,
        s.abstract,
        typeof metadata.summary === "string" ? metadata.summary : null,
        typeof metadata.topic === "string" ? metadata.topic : null,
        s.title,
      ),
    });
  }

  for (const h of highlights.data ?? []) {
    const note = h.notes as unknown as { title: string } | null;
    hits.push({
      href: h.note_id ? `/notes/${h.note_id}` : null,
      kindLabel: "Öne Çıkan",
      title: note?.title ?? "Öne çıkan pasaj",
      snippet: firstSnippet(query, h.text, h.comment),
    });
  }

  for (const v of voiceNotes.data ?? []) {
    hits.push({
      href: v.note_id ? `/notes/${v.note_id}` : null,
      kindLabel: "Ses Notu",
      title: "Ses notu transkripti",
      snippet: firstSnippet(query, v.transcript),
    });
  }

  return hits;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const hits = query ? await searchEverything(query) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Arama</h1>
        {query ? (
          <p className="mt-1 text-sm text-[var(--muted)]">
            &ldquo;{query}&rdquo; için {hits.length} sonuç bulundu.
          </p>
        ) : (
          <p className="mt-1 text-sm text-[var(--muted)]">
            Üstteki arama kutusuna bir kelime yazın; notlarınız, makaleleriniz,
            kitap özetleriniz ve öne çıkanlarınız içinde aransın.
          </p>
        )}
      </div>

      {query && hits.length === 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--muted)]">
          &ldquo;{query}&rdquo; kelimesini içeren bir metin bulunamadı.
        </div>
      )}

      {/* #ara= fragment: ScrollToSearchText scrolls the target page to the word. */}
      <ul className="space-y-3">
        {hits.map((hit, i) => {
          const deepHref = hit.href
            ? `${hit.href}#ara=${encodeURIComponent(query)}`
            : null;
          const card = (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:border-amber-400/60">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                  {hit.kindLabel}
                </span>
                <span className="truncate text-sm font-semibold">
                  {hit.title}
                </span>
              </div>
              {hit.snippet && (
                <p className="text-sm leading-relaxed text-[var(--muted)]">
                  {hit.snippet}
                </p>
              )}
            </div>
          );
          return (
            <li key={i}>
              {deepHref ? <Link href={deepHref}>{card}</Link> : card}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
