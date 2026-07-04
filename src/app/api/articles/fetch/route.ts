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
  const retstart = Math.floor(Math.random() * 60);
  const term = `(${bucket.term}) AND randomizedcontrolledtrial[pt] AND hasabstract[text] AND English[lang]`;

  try {
    // 1) esearch — recent PMIDs for this topic
    const searchRes = await fetch(
      `${EUTILS}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(term)}` +
        `&retmax=6&retstart=${retstart}&retmode=json&sort=date`,
    );
    if (!searchRes.ok) {
      return NextResponse.json(
        { error: `PubMed arama hatası (HTTP ${searchRes.status})` },
        { status: 502 },
      );
    }
    const search = (await searchRes.json()) as {
      esearchresult?: { idlist?: string[] };
    };
    const ids = search.esearchresult?.idlist ?? [];
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
