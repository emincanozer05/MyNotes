import type { ArticleMetadata } from "@/lib/types";

/**
 * Server-side fetchers for article metadata.
 * - DOI  -> CrossRef REST API (no key required)
 * - PMID -> NCBI E-utilities (esummary for metadata, efetch for the abstract)
 */

export type ParsedInput =
  | { type: "doi"; id: string }
  | { type: "pmid"; id: string };

/** Accepts a raw DOI, a doi.org URL, a PMID, or a PubMed article URL. */
export function parseArticleInput(raw: string): ParsedInput | null {
  const input = raw.trim();
  if (!input) return null;

  const pubmedUrl = input.match(
    /pubmed\.ncbi\.nlm\.nih\.gov\/(\d+)/i,
  );
  if (pubmedUrl) return { type: "pmid", id: pubmedUrl[1] };

  if (/^\d{4,9}$/.test(input)) return { type: "pmid", id: input };

  const doiMatch = input
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .match(/^10\.\d{4,9}\/\S+$/);
  if (doiMatch) return { type: "doi", id: doiMatch[0] };

  // DOI embedded somewhere in the string (e.g. citation text)
  const embedded = input.match(/10\.\d{4,9}\/[^\s"'<>]+/);
  if (embedded) return { type: "doi", id: embedded[0] };

  return null;
}

/** Strips JATS/HTML tags CrossRef sometimes embeds in abstracts. */
function stripTags(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchDoiMetadata(doi: string): Promise<ArticleMetadata> {
  const res = await fetch(
    `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
    { headers: { "User-Agent": "sc-hub (mailto:library@sc-hub.app)" } },
  );
  if (res.status === 404) throw new Error(`DOI bulunamadı: ${doi}`);
  if (!res.ok) throw new Error(`CrossRef hatası (HTTP ${res.status})`);

  const { message: m } = (await res.json()) as {
    message: {
      title?: string[];
      author?: { given?: string; family?: string; name?: string }[];
      issued?: { "date-parts"?: number[][] };
      "container-title"?: string[];
      abstract?: string;
      DOI: string;
      URL?: string;
    };
  };

  return {
    title: m.title?.[0] ?? "(başlıksız)",
    authors: (m.author ?? []).map(
      (a) => a.name ?? [a.given, a.family].filter(Boolean).join(" "),
    ),
    year: m.issued?.["date-parts"]?.[0]?.[0] ?? null,
    journal: m["container-title"]?.[0] ?? null,
    doi: m.DOI,
    pmid: null,
    url: m.URL ?? `https://doi.org/${m.DOI}`,
    abstract: m.abstract ? stripTags(m.abstract) : null,
  };
}

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

export async function fetchPubMedMetadata(
  pmid: string,
): Promise<ArticleMetadata> {
  const summaryRes = await fetch(
    `${EUTILS}/esummary.fcgi?db=pubmed&id=${pmid}&retmode=json`,
  );
  if (!summaryRes.ok)
    throw new Error(`PubMed hatası (HTTP ${summaryRes.status})`);

  const summary = (await summaryRes.json()) as {
    result?: Record<
      string,
      {
        title?: string;
        authors?: { name: string }[];
        pubdate?: string;
        fulljournalname?: string;
        source?: string;
        articleids?: { idtype: string; value: string }[];
        error?: string;
      }
    >;
  };

  const rec = summary.result?.[pmid];
  if (!rec || rec.error) throw new Error(`PMID bulunamadı: ${pmid}`);

  const doi =
    rec.articleids?.find((a) => a.idtype === "doi")?.value ?? null;
  const yearMatch = rec.pubdate?.match(/\d{4}/);

  // Abstract comes from efetch (XML); a failed abstract fetch should not
  // block the import, so errors here degrade to null.
  let abstract: string | null = null;
  try {
    const fetchRes = await fetch(
      `${EUTILS}/efetch.fcgi?db=pubmed&id=${pmid}&rettype=abstract&retmode=xml`,
    );
    if (fetchRes.ok) {
      const xml = await fetchRes.text();
      const parts = [
        ...xml.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g),
      ].map((m) => stripTags(m[1]));
      abstract = parts.length ? parts.join(" ") : null;
    }
  } catch {
    abstract = null;
  }

  return {
    title: stripTags(rec.title ?? "(başlıksız)"),
    authors: (rec.authors ?? []).map((a) => a.name),
    year: yearMatch ? Number(yearMatch[0]) : null,
    journal: rec.fulljournalname ?? rec.source ?? null,
    doi,
    pmid,
    url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    abstract,
  };
}

export async function fetchArticleMetadata(
  parsed: ParsedInput,
): Promise<ArticleMetadata> {
  return parsed.type === "doi"
    ? fetchDoiMetadata(parsed.id)
    : fetchPubMedMetadata(parsed.id);
}
