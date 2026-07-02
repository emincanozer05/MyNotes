/** Parsing helpers for note content: [[wiki links]] and #hashtags. */

export const WIKI_LINK_RE = /\[\[([^\]]+)\]\]/g;
export const HASHTAG_RE = /(^|[\s(“"'])#([\p{L}\p{N}_-]+)/gu;

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
