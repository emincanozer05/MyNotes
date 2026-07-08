/** Parsing helpers for note content: [[wiki links]] and #hashtags. */

export const WIKI_LINK_RE = /\[\[([^\]]+)\]\]/g;
export const HASHTAG_RE = /(^|[\s(“"'])#([\p{L}\p{N}_-]+)/gu;
/** `<mark data-tag-name="…">` passages tagged inline in the rich-text editor. */
export const MARK_TAG_NAME_RE = /data-tag-name="([^"]+)"/g;
/** Pipe-separated list of ALL tags on a mark (multi-tag highlights). */
export const MARK_TAG_NAMES_RE = /data-tag-names="([^"]+)"/g;

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
  const names = [
    ...[...html.matchAll(MARK_TAG_NAME_RE)].map((m) => m[1]),
    // Multi-tag marks list every tag pipe-separated in data-tag-names.
    ...[...html.matchAll(MARK_TAG_NAMES_RE)].flatMap((m) => m[1].split("|")),
  ]
    .map((n) => normalizeTag(decodeHtmlEntities(n)))
    .filter(Boolean);
  return [...new Set(names)];
}

/** One tag carried by a highlighted passage. */
export interface PassageTag {
  name: string;
  color: string | null;
}

/** A passage highlighted + tagged inline in the editor (`<mark>` element). */
export interface TaggedPassage {
  /** Primary (first) tag — drives the post-it colour. */
  tagName: string;
  tagColor: string | null;
  /** Every tag on the passage (a mark can carry several). */
  tags: PassageTag[];
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

    // All tags on the mark: multi-tag marks carry them pipe-separated in
    // data-tag-names / data-tag-colors; single-tag (legacy) marks fall back
    // to the primary attributes.
    const namesRaw = /data-tag-names="([^"]*)"/.exec(attrs)?.[1];
    const colorsRaw = /data-tag-colors="([^"]*)"/.exec(attrs)?.[1] ?? "";
    let tags: PassageTag[];
    if (namesRaw) {
      const names = decodeHtmlEntities(namesRaw).split("|");
      const colors = decodeHtmlEntities(colorsRaw).split("|");
      tags = names
        .map((n, i) => ({
          name: normalizeTag(n),
          color: /^#[0-9a-fA-F]{6}$/.test(colors[i] ?? "") ? colors[i] : null,
        }))
        .filter((t) => t.name);
    } else {
      tags = [{ name: tagName, color: tagColor }];
    }
    if (tags.length === 0) continue;

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
      out.push({ tagName, tagColor, tags, text, group });
    }
  }
  return out.map(({ tagName, tagColor, tags, text }) => ({
    tagName,
    tagColor,
    tags,
    text,
  }));
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
