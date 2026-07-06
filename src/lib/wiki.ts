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

/** A passage highlighted + tagged inline in the editor (`<mark>` element). */
export interface TaggedPassage {
  tagName: string;
  tagColor: string | null;
  text: string;
}

const MARK_RE = /<mark\b([^>]*)>([\s\S]*?)<\/mark>/gi;

/**
 * Pulls every tagged passage out of stored HTML: the highlighted text plus the
 * tag it carries (name + colour, read straight from the `<mark>` data-*). Used
 * to turn each highlight into its own post-it card, wherever it was tagged
 * (notes, article summaries, book/course notes).
 *
 * A single selection spanning several paragraphs / list items is stored as one
 * `<mark>` per block, all sharing a `data-tag-group` id — those are merged back
 * into ONE passage here (line per block), so one selection = one post-it.
 */
export function extractTaggedPassages(
  html: string | null | undefined,
): TaggedPassage[] {
  if (!html) return [];
  const out: (TaggedPassage & { group: string | null })[] = [];
  for (const m of html.matchAll(MARK_RE)) {
    const attrs = m[1];
    const nameRaw = /data-tag-name="([^"]*)"/.exec(attrs)?.[1];
    if (!nameRaw) continue;
    const tagName = normalizeTag(decodeHtmlEntities(nameRaw));
    if (!tagName) continue;

    const colorRaw = /data-tag-color="([^"]*)"/.exec(attrs)?.[1] ?? "";
    const tagColor = /^#[0-9a-fA-F]{6}$/.test(colorRaw) ? colorRaw : null;
    const group = /data-tag-group="([^"]*)"/.exec(attrs)?.[1] || null;

    const text = decodeHtmlEntities(
      m[2].replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " "),
    )
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;

    const prev = out[out.length - 1];
    if (group && prev && prev.group === group && prev.tagName === tagName) {
      prev.text += `\n${text}`;
    } else {
      out.push({ tagName, tagColor, text, group });
    }
  }
  return out.map(({ tagName, tagColor, text }) => ({ tagName, tagColor, text }));
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
