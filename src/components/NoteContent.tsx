import Link from "next/link";
import type { ReactNode } from "react";

const INLINE_RE = /\[\[([^\]]+)\]\]|(^|[\s(“"'])#([\p{L}\p{N}_-]+)/gu;

/**
 * Renders note content with [[wiki links]] resolved to note pages and
 * #hashtags linked to the tag-filtered note list.
 */
export function NoteContent({
  content,
  linkMap,
}: {
  content: string;
  /** lowercase note title -> note id */
  linkMap: Map<string, string>;
}) {
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
