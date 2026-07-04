import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/articles/fetch — pulls 6 fresh randomized controlled trials from
 * PubMed (NCBI E-utilities, no API key) for the Literatür "Makaleleri Getir"
 * button. A random topic + offset each call gives new results every press.
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

function stripTags(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** esearch that returns the total count + a page of PMIDs (empty on failure). */
async function esearch(
  term: string,
  retstart: number,
): Promise<{ count: number; ids: string[] }> {
  const res = await fetch(
    `${EUTILS}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(term)}` +
      `&retmax=6&retstart=${retstart}&retmode=json`,
  );
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
  const rct = `(${bucketTerm}) AND "randomized controlled trial"[pt] AND hasabstract[text] AND English[lang]`;
  const broad = `(${bucketTerm}) AND hasabstract[text] AND English[lang]`;

  for (const term of [rct, broad, "(athletes) AND hasabstract[text]"]) {
    // First hit gives the real result count so the offset never overshoots.
    const head = await esearch(term, 0);
    if (head.count === 0) continue;
    if (head.count <= 6) return head.ids;
    const maxStart = Math.min(head.count - 6, 120);
    const retstart = Math.floor(Math.random() * (maxStart + 1));
    const page = await esearch(term, retstart);
    if (page.ids.length > 0) return page.ids;
    if (head.ids.length > 0) return head.ids;
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

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  }

  const bucket = TOPICS[Math.floor(Math.random() * TOPICS.length)];

  try {
    // 1) find PMIDs (offset kept in range + broadening fallback)
    const ids = await findIds(bucket.term);
    if (ids.length === 0) {
      return NextResponse.json({ articles: [] });
    }
    const idCsv = ids.join(",");

    // 2) esummary — metadata for all ids in one call
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

    // 3) efetch — abstracts for all ids in one call
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

    const articles: FetchedArticle[] = ids
      .map((pmid) => {
        const rec = summary.result?.[pmid];
        if (!rec?.title) return null;
        const doi =
          rec.articleids?.find((a) => a.idtype === "doi")?.value ?? "";
        const year = rec.pubdate?.match(/\d{4}/)?.[0];
        return {
          title: stripTags(rec.title),
          authors: (rec.authors ?? []).map((a) => a.name),
          year: year ? Number(year) : null,
          journal: rec.fulljournalname ?? rec.source ?? "",
          doi,
          pmid,
          topic: bucket.topic,
          abstract: absByPmid.get(pmid) ?? "",
        } as FetchedArticle;
      })
      .filter((a): a is FetchedArticle => a !== null);

    return NextResponse.json({ articles, topic: bucket.topic });
  } catch {
    return NextResponse.json(
      { error: "Makaleler getirilemedi. Tekrar dene." },
      { status: 502 },
    );
  }
}
