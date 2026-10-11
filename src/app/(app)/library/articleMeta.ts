import type { Source } from "@/lib/types";

/** Journals in the curated set that publish open access. */
const OA_JOURNALS = [
  "scientific reports",
  "plos",
  "medicina",
  "journal of sports science & medicine",
  "frontiers",
  "bmc",
  "peerj",
];

export function isOpenAccess(journal: string | null): boolean {
  if (!journal) return false;
  const j = journal.toLowerCase();
  return OA_JOURNALS.some((oa) => j.includes(oa));
}

export function topicOf(a: Source): string {
  const t = (a.metadata as { topic?: string } | null)?.topic;
  return t && t.trim() ? t : "Diğer";
}

export function tagsOf(a: Source): string[] {
  const tags = (a.metadata as { tags?: unknown } | null)?.tags;
  return Array.isArray(tags)
    ? tags.filter((t): t is string => Boolean(t) && typeof t === "string")
    : [];
}

export function isMyNote(a: Source): boolean {
  return Boolean((a.metadata as { mynote?: boolean } | null)?.mynote);
}

export function summaryOf(a: Source): string {
  return (a.metadata as { summary?: string } | null)?.summary ?? "";
}

/** Rich-text summary HTML flattened to plain text (for previews/search). */
export function plainText(html: string): string {
  return html
    .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasSummary(a: Source): boolean {
  return Boolean(plainText(summaryOf(a)));
}

export function articleLink(a: Source): string | null {
  return a.url ?? (a.doi ? `https://doi.org/${a.doi}` : null);
}

/** Case-insensitive (Turkish locale) match over the fields users search by. */
export function matchesQuery(a: Source, query: string): boolean {
  const q = query.trim().toLocaleLowerCase("tr");
  if (!q) return true;
  const haystack = [
    a.title,
    a.authors.join(" "),
    a.journal ?? "",
    topicOf(a),
    tagsOf(a).join(" "),
  ]
    .join(" ")
    .toLocaleLowerCase("tr");
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

export function sortArticles(
  list: Source[],
  sort: "added" | "year" | "title",
): Source[] {
  const copy = [...list];
  if (sort === "year") {
    copy.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
  } else if (sort === "title") {
    copy.sort((a, b) => a.title.localeCompare(b.title, "tr"));
  } else {
    copy.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  return copy;
}
