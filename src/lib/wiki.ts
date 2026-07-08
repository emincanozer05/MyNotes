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

/** A `<mark>` element kept for editing: its source range and inner HTML. */
interface MarkMatch {
  start: number;
  end: number;
  inner: string;
}

interface ParsedPassage extends TaggedPassage {
  group: string | null;
  /** The `<mark>` element(s) making up this passage, in document order. */
  matches: MarkMatch[];
}

/**
 * Core parser shared by {@link extractTaggedPassages} and
 * {@link removeTaggedPassage}: walks every valid `<mark>` in the HTML, merges
 * marks sharing a `data-tag-group` into one passage, and records each
 * contributing mark's source range so a passage can later be un-highlighted.
 *
 * A single selection spanning several paragraphs / list items is stored as one
 * `<mark>` per block, all sharing a `data-tag-group` id — those are merged back
 * into ONE passage here (line per block), so one selection = one post-it.
 */
function parseMarkPassages(html: string): ParsedPassage[] {
  const out: ParsedPassage[] = [];
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

    const match: MarkMatch = {
      start: m.index ?? 0,
      end: (m.index ?? 0) + m[0].length,
      inner: m[2],
    };

    const prev = out[out.length - 1];
    if (group && prev && prev.group === group && prev.tagName === tagName) {
      prev.text += `\n${text}`;
      prev.matches.push(match);
    } else {
      out.push({ tagName, tagColor, tags, text, group, matches: [match] });
    }
  }
  return out;
}

/**
 * Pulls every tagged passage out of stored HTML: the highlighted text plus the
 * tag it carries (name + colour, read straight from the `<mark>` data-*). Used
 * to turn each highlight into its own post-it card, wherever it was tagged
 * (notes, article summaries, book/course notes).
 */
export function extractTaggedPassages(
  html: string | null | undefined,
): TaggedPassage[] {
  if (!html) return [];
  return parseMarkPassages(html).map(({ tagName, tagColor, tags, text }) => ({
    tagName,
    tagColor,
    tags,
    text,
  }));
}

/**
 * Removes the highlight around the passage at `index` (as numbered by
 * {@link extractTaggedPassages}) from the stored HTML, unwrapping the
 * `<mark>` element(s) so the passage's text is preserved — only the tag/colour
 * highlight is dropped. Returns the updated HTML, or `null` when the index is
 * out of range (nothing to change).
 */
export function removeTaggedPassage(
  html: string | null | undefined,
  index: number,
): string | null {
  if (!html) return null;
  const target = parseMarkPassages(html)[index];
  if (!target) return null;
  // Splice from the end so earlier ranges keep their offsets valid.
  let result = html;
  for (const mark of [...target.matches].sort((a, b) => b.start - a.start)) {
    result = result.slice(0, mark.start) + mark.inner + result.slice(mark.end);
  }
  return result;
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
