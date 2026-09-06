import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/articles/fetch — pulls fresh articles from PubMed (NCBI
 * E-utilities, no API key) for the Literatür feed.
 *
 * - Without `q`: 6 randomized controlled trials from a random topic bucket,
 *   with a random offset so every press gives new results.
 * - With `q` (keyword search, e.g. "ACL" or "injury prevention"): the most
 *   recent articles matching that keyword, newest first.
 */

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

const TOPICS: { topic: string; term: string }[] = [
  { topic: "Kuvvet & Güç", term: "resistance training strength athletes" },
  { topic: "Sprint & Hız", term: "sprint training speed athletes" },
  { topic: "Pliometrik", term: "plyometric training performance athletes" },
  { topic: "Dayanıklılık", term: "endurance training athletes performance" },
  { topic: "Sakatlık Önleme", term: "injury prevention strength training athletes" },
  { topic: "Toparlanma", term: "recovery athletic performance training" },
  { topic: "Hipertrofi", term: "muscle hypertrophy resistance training" },
  { topic: "Kondisyon", term: "conditioning team sport athletes training" },
];

// Population gate — the feed is only for studies run on professional / trained
// athletes, never on clinical, obese, or elderly cohorts.
//
// ATHLETE_POP forces at least one "trained athlete" signal into every query
// (even topics like "muscle hypertrophy resistance training" that don't name
// athletes themselves). EXCLUDE_POP drops the populations the user doesn't want:
// obese/overweight, elderly (MeSH "Aged" = 65+, plus free-text variants), and
// disease cohorts. Injured athletes doing return-to-sport work are still
// athletes, so injury/rehabilitation is deliberately NOT excluded.
const ATHLETE_POP =
  'AND (athlete*[tiab] OR athletic[tiab] OR sportsmen[tiab] OR sportswomen[tiab] OR players[tiab] OR "well-trained"[tiab] OR "resistance-trained"[tiab] OR "trained men"[tiab] OR "trained women"[tiab] OR "physically active"[tiab])';
const EXCLUDE_POP =
  'NOT (obes*[tiab] OR overweight[tiab] OR "Aged"[Mesh] OR elderly[tiab] OR "older adults"[tiab] OR geriatric[tiab] OR sarcopeni*[tiab] OR frailty[tiab] OR "Chronic Disease"[Mesh] OR diabet*[tiab] OR cancer[tiab] OR oncolog*[tiab] OR osteoporos*[tiab] OR "cardiovascular disease"[tiab] OR hypertension[tiab] OR "metabolic syndrome"[tiab] OR stroke[tiab] OR "Parkinson Disease"[Mesh] OR COPD[tiab])';

const FEED_SIZE = 6;
const SEARCH_SIZE = 12;

function stripTags(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Strips PubMed query operators from user input so a keyword can never
 *  break the surrounding query it is embedded in. */
function sanitizeQuery(raw: string): string {
  return raw
    .replace(/["'()\[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/** esearch that returns the total count + a page of PMIDs (empty on failure). */
async function esearch(
  term: string,
  retstart: number,
  opts: { retmax?: number; sortByDate?: boolean } = {},
): Promise<{ count: number; ids: string[] }> {
  const retmax = opts.retmax ?? FEED_SIZE;
  const base =
    `${EUTILS}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(term)}` +
    `&retmax=${retmax}&retstart=${retstart}&retmode=json`;
  // "pub_date" is E-utilities' documented newest-first sort; if the sorted
  // call is rejected, fall back to the default (relevance) ordering rather
  // than losing the results entirely.
  let res = await fetch(opts.sortByDate ? `${base}&sort=pub_date` : base);
  if (!res.ok && opts.sortByDate) res = await fetch(base);
  if (!res.ok) return { count: 0, ids: [] };
  const data = (await res.json()) as {
    esearchresult?: { count?: string; idlist?: string[] };
  };
  return {
    count: Number(data.esearchresult?.count ?? 0) || 0,
    ids: data.esearchresult?.idlist ?? [],
  };
}

/** Finds 6 PMIDs for a topic, keeping the random offset within range and
 *  falling back to a broader query so results are (almost) never empty. */
async function findIds(bucketTerm: string): Promise<string[]> {
  // Publication-type filter must use the spaced form; the no-space token
  // "randomizedcontrolledtrial[pt]" matches nothing on PubMed.
  // Every fallback keeps the athlete-population gate so loosening the study
  // type never lets clinical/obese/elderly cohorts back into the feed.
  const rct = `(${bucketTerm}) AND "randomized controlled trial"[pt] AND hasabstract[text] AND English[lang] ${ATHLETE_POP} ${EXCLUDE_POP}`;
  const broad = `(${bucketTerm}) AND hasabstract[text] AND English[lang] ${ATHLETE_POP} ${EXCLUDE_POP}`;
  const safety = `athletes[tiab] AND hasabstract[text] AND English[lang] ${EXCLUDE_POP}`;

  for (const term of [rct, broad, safety]) {
    // First hit gives the real result count so the offset never overshoots.
    const head = await esearch(term, 0);
    if (head.count === 0) continue;
    if (head.count <= FEED_SIZE) return head.ids;
    const maxStart = Math.min(head.count - FEED_SIZE, 120);
    const retstart = Math.floor(Math.random() * (maxStart + 1));
    const page = await esearch(term, retstart);
    if (page.ids.length > 0) return page.ids;
    if (head.ids.length > 0) return head.ids;
  }
  return [];
}

/** Finds the most recent PMIDs for a free-text keyword, loosening the query
 *  step by step so a narrow keyword still returns something. */
async function findIdsByKeyword(query: string): Promise<string[]> {
  const athlete = `(${query}) AND hasabstract[text] AND English[lang] ${ATHLETE_POP} ${EXCLUDE_POP}`;
  const clean = `(${query}) AND hasabstract[text] AND English[lang] ${EXCLUDE_POP}`;
  const any = `(${query}) AND English[lang]`;

  for (const term of [athlete, clean, any]) {
    const page = await esearch(term, 0, {
      retmax: SEARCH_SIZE,
      sortByDate: true,
    });
    if (page.ids.length > 0) return page.ids;
  }
  return [];
}

interface FetchedArticle {
  title: string;
  authors: string[];
  year: number | null;
  journal: string;
  doi: string;
  pmid: string;
  topic: string;
  abstract: string;
}

/** esummary + efetch for a set of PMIDs → full article records. */
async function hydrate(
  ids: string[],
  topic: string,
): Promise<FetchedArticle[]> {
  const idCsv = ids.join(",");

  // esummary — metadata for all ids in one call
  const sumRes = await fetch(
    `${EUTILS}/esummary.fcgi?db=pubmed&id=${idCsv}&retmode=json`,
  );
  const summary = (await sumRes.json()) as {
    result?: Record<
      string,
      {
        title?: string;
        authors?: { name: string }[];
        pubdate?: string;
        fulljournalname?: string;
        source?: string;
        articleids?: { idtype: string; value: string }[];
      }
    >;
  };

  // efetch — abstracts for all ids in one call
  const absByPmid = new Map<string, string>();
  try {
    const fetchRes = await fetch(
      `${EUTILS}/efetch.fcgi?db=pubmed&id=${idCsv}&rettype=abstract&retmode=xml`,
    );
    if (fetchRes.ok) {
      const xml = await fetchRes.text();
      for (const block of xml.split("</PubmedArticle>")) {
        const pmid = block.match(/<PMID[^>]*>(\d+)<\/PMID>/)?.[1];
        if (!pmid) continue;
        const parts = [
          ...block.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g),
        ].map((m) => stripTags(m[1]));
        if (parts.length) absByPmid.set(pmid, parts.join(" "));
      }
    }
  } catch {
    /* abstracts are best-effort */
  }

  return ids
    .map((pmid) => {
      const rec = summary.result?.[pmid];
      if (!rec?.title) return null;
      const doi = rec.articleids?.find((a) => a.idtype === "doi")?.value ?? "";
      const year = rec.pubdate?.match(/\d{4}/)?.[0];
      return {
        title: stripTags(rec.title),
        authors: (rec.authors ?? []).map((a) => a.name),
        year: year ? Number(year) : null,
        journal: rec.fulljournalname ?? rec.source ?? "",
        doi,
        pmid,
        topic,
        abstract: absByPmid.get(pmid) ?? "",
      } as FetchedArticle;
    })
    .filter((a): a is FetchedArticle => a !== null);
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  }

  const query = sanitizeQuery(
    new URL(request.url).searchParams.get("q") ?? "",
  );

  const bucket = TOPICS[Math.floor(Math.random() * TOPICS.length)];
  // Keyword mode labels the cards with the keyword itself, so a saved article
  // lands under that topic in "Kaydedilenler".
  const topic = query || bucket.topic;

  try {
    const ids = query
      ? await findIdsByKeyword(query)
      : await findIds(bucket.term);

    if (ids.length === 0) {
      return NextResponse.json({ articles: [], topic, query });
    }

    const articles = await hydrate(ids, topic);
    return NextResponse.json({ articles, topic, query });
  } catch {
    return NextResponse.json(
      { error: "Makaleler getirilemedi. Tekrar dene." },
      { status: 502 },
    );
  }
}
