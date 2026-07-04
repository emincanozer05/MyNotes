import Link from "next/link";
import type { ReactNode } from "react";

const INLINE_RE = /\[\[([^\]]+)\]\]|(^|[\s(“"'])#([\p{L}\p{N}_-]+)/gu;

function looksLikeHtml(s: string): boolean {
  return /<[a-z][\s\S]*>/i.test(s);
}

/** Turns [[links]] / #tags inside a plain text run into anchor HTML. */
function linkifyToHtml(text: string, linkMap: Map<string, string>): string {
  return text.replace(INLINE_RE, (_m, wiki, pre, tag) => {
    if (wiki !== undefined) {
      const title = String(wiki).trim();
      const id = linkMap.get(title.toLocaleLowerCase("tr"));
      return id
        ? `<a href="/notes/${id}" class="rounded bg-amber-100 dark:bg-amber-950 px-1 font-medium text-amber-800 dark:text-amber-300 hover:underline">${title}</a>`
        : `<span title="Bu başlıkta bir not yok" class="rounded bg-stone-100 dark:bg-stone-800 px-1 text-stone-500">${title}</span>`;
    }
    const preChar = pre ?? "";
    const t = String(tag);
    const href = `/notes?tag=${encodeURIComponent(t.toLocaleLowerCase("tr"))}`;
    return `${preChar}<a href="${href}" class="font-medium text-sky-700 dark:text-sky-400 hover:underline">#${t}</a>`;
  });
}

/** Linkifies text nodes only, leaving HTML tags (and image data URLs) intact. */
function renderRichHtml(content: string, linkMap: Map<string, string>): string {
  return content.replace(/(<[^>]+>)|([^<]+)/g, (_m, tag, text) =>
    tag ? tag : linkifyToHtml(text, linkMap),
  );
}

/**
 * Renders note content with [[wiki links]] resolved to note pages and
 * #hashtags linked to the tag-filtered note list.
 *
 * Rich notes are stored as HTML (formatting + images); legacy notes are plain
 * text. Both are supported here.
 */
export function NoteContent({
  content,
  linkMap,
}: {
  content: string;
  /** lowercase note title -> note id */
  linkMap: Map<string, string>;
}) {
  if (looksLikeHtml(content)) {
    return (
      <div
        className="note-html text-[15px] leading-relaxed"
        dangerouslySetInnerHTML={{ __html: renderRichHtml(content, linkMap) }}
      />
    );
  }

  // ---- Legacy plain-text path -----------------------------------------
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  for (const match of content.matchAll(INLINE_RE)) {
    const index = match.index ?? 0;
    if (index > cursor) nodes.push(content.slice(cursor, index));

    if (match[1] !== undefined) {
      // [[wiki link]]
      const title = match[1].trim();
      const targetId = linkMap.get(title.toLocaleLowerCase("tr"));
      nodes.push(
        targetId ? (
          <Link
            key={key++}
            href={`/notes/${targetId}`}
            className="rounded bg-amber-100 dark:bg-amber-950 px-1 font-medium text-amber-800 dark:text-amber-300 hover:underline"
          >
            {title}
          </Link>
        ) : (
          <span
            key={key++}
            title="Bu başlıkta bir not yok"
            className="rounded bg-stone-100 dark:bg-stone-800 px-1 text-stone-500"
          >
            {title}
          </span>
        ),
      );
    } else {
      // #hashtag (match[2] is the preceding character, keep it as text)
      if (match[2]) nodes.push(match[2]);
      const tag = match[3];
      nodes.push(
        <Link
          key={key++}
          href={`/notes?tag=${encodeURIComponent(tag.toLocaleLowerCase("tr"))}`}
          className="font-medium text-sky-700 dark:text-sky-400 hover:underline"
        >
          #{tag}
        </Link>,
      );
    }
    cursor = index + match[0].length;
  }
  if (cursor < content.length) nodes.push(content.slice(cursor));

  return (
    <div className="whitespace-pre-wrap text-[15px] leading-relaxed">
      {nodes}
    </div>
  );
}
