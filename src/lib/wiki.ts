/** Parsing helpers for note content: [[wiki links]] and #hashtags. */

export const WIKI_LINK_RE = /\[\[([^\]]+)\]\]/g;
export const HASHTAG_RE = /(^|[\s(“"'])#([\p{L}\p{N}_-]+)/gu;
/** `<mark data-tag-name="…">` passages tagged inline in the rich-text editor. */
export const MARK_TAG_NAME_RE = /data-tag-name="([^"]+)"/g;

export function extractWikiLinks(content: string): string[] {
  const titles = [...content.matchAll(WIKI_LINK_RE)]
    .map((m) => m[1].trim())
    .filter(Boolean);
  return [...new Set(titles)];
}

export function extractHashtags(content: string): string[] {
  const tags = [...content.matchAll(HASHTAG_RE)].map((m) =>
    m[2].toLocaleLowerCase("tr"),
  );
  return [...new Set(tags)];
}

/**
 * Tag names applied to passages via `<mark data-tag-name="…">` in stored HTML.
 * These highlights live in the note's rich-text content, so they must be pulled
 * out separately from #hashtags to keep the `note_tags` table in sync.
 */
export function extractMarkTags(html: string): string[] {
  const names = [...html.matchAll(MARK_TAG_NAME_RE)]
    .map((m) => normalizeTag(decodeHtmlEntities(m[1])))
    .filter(Boolean);
  return [...new Set(names)];
}

/** Decodes the entities the browser escapes into HTML attribute values. */
function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function normalizeTag(name: string): string {
  return name.trim().replace(/^#/, "").toLocaleLowerCase("tr");
}

/** Splits a comma/space separated tag input field into normalized tag names. */
export function parseTagInput(input: string): string[] {
  return [
    ...new Set(
      input
        .split(/[,\s]+/)
        .map(normalizeTag)
        .filter(Boolean),
    ),
  ];
}
