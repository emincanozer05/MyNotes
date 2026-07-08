"use server";

import { revalidatePath } from "next/cache";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { CURATED_ARTICLES } from "@/lib/curatedArticles";

/** Saves one of the curated RCT articles to the user's library (idempotent). */
export async function saveCuratedArticle(pmid: string) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return { error: "Oturum bulunamadı." };

  const article = CURATED_ARTICLES.find((a) => a.pmid === pmid);
  if (!article) return { error: "Makale bulunamadı." };

  const { error } = await supabase.from("sources").insert({
    user_id: user.id,
    kind: "article",
    title: article.title,
    authors: article.authors,
    year: article.year,
    journal: article.journal,
    doi: article.doi,
    pmid: article.pmid,
    url: `https://doi.org/${article.doi}`,
    abstract: article.abstract,
    // Topic used to group articles by subject in the library list.
    metadata: { topic: article.topic },
  });

  if (error) {
    const isDuplicate = error.code === "23505";
    return {
      error: isDuplicate
        ? "Bu makale zaten kütüphanenizde."
        : `Kaydedilemedi: ${error.message}`,
    };
  }

  revalidatePath("/library");
  return { error: null };
}

export interface FetchedArticleInput {
  title: string;
  authors: string[];
  year: number | null;
  journal: string | null;
  doi: string | null;
  pmid: string | null;
  topic: string;
  abstract: string | null;
}

/** Saves a live-fetched PubMed article (from "Makaleleri Getir"). */
export async function saveFetchedArticle(article: FetchedArticleInput) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return { error: "Oturum bulunamadı." };

  if (!article?.title) return { error: "Makale bilgisi eksik." };

  const doi = article.doi || null;
  const { error } = await supabase.from("sources").insert({
    user_id: user.id,
    kind: "article",
    title: article.title,
    authors: article.authors ?? [],
    year: article.year,
    journal: article.journal || null,
    doi,
    pmid: article.pmid || null,
    url: doi
      ? `https://doi.org/${doi}`
      : article.pmid
        ? `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`
        : null,
    abstract: article.abstract || null,
    metadata: { topic: article.topic || "Diğer" },
  });

  if (error) {
    const isDuplicate = error.code === "23505";
    return {
      error: isDuplicate
        ? "Bu makale zaten kütüphanenizde."
        : `Kaydedilemedi: ${error.message}`,
    };
  }

  revalidatePath("/library");
  return { error: null };
}

/** Removes a curated article that was saved (undo of saveCuratedArticle). */
export async function unsaveCuratedArticle(pmid: string) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return { error: "Oturum bulunamadı." };

  const { error } = await supabase
    .from("sources")
    .delete()
    .eq("kind", "article")
    .eq("pmid", pmid);

  if (error) return { error: `Geri alınamadı: ${error.message}` };
  revalidatePath("/library");
  return { error: null };
}

/** Updates (or sets) the topic of a saved / own article. */
export async function updateArticleTopic(id: string, topic: string) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return { error: "Oturum bulunamadı." };

  const { data: existing } = await supabase
    .from("sources")
    .select("metadata")
    .eq("id", id)
    .maybeSingle();

  const metadata = {
    ...((existing?.metadata as Record<string, unknown> | null) ?? {}),
    topic: topic.trim() || "Diğer",
  };

  const { error } = await supabase
    .from("sources")
    .update({ metadata })
    .eq("id", id)
    .eq("kind", "article");

  if (error) return { error: error.message };
  revalidatePath("/library");
  return { error: null };
}

/** Normalizes a comma-separated tag string into a deduplicated list. */
function parseTags(raw: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const part of raw.split(",")) {
    const tag = part.trim();
    const key = tag.toLocaleLowerCase("tr");
    if (tag && !seen.has(key)) {
      seen.add(key);
      tags.push(tag);
    }
  }
  return tags;
}

/** Updates (or sets) the tag list of a saved / own article. */
export async function updateArticleTags(id: string, tagsRaw: string) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return { error: "Oturum bulunamadı." };

  const { data: existing } = await supabase
    .from("sources")
    .select("metadata")
    .eq("id", id)
    .maybeSingle();

  const metadata = {
    ...((existing?.metadata as Record<string, unknown> | null) ?? {}),
    tags: parseTags(tagsRaw),
  };

  const { error } = await supabase
    .from("sources")
    .update({ metadata })
    .eq("id", id)
    .eq("kind", "article");

  if (error) return { error: error.message };
  revalidatePath("/library");
  return { error: null };
}

/** Adds an article entered manually by the user (own reading list). */
export async function addOwnArticle(formData: FormData) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return { error: "Oturum bulunamadı." };

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Makale başlığı zorunludur." };

  const authors = String(formData.get("authors") ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);
  const yearRaw = String(formData.get("year") ?? "").trim();
  const year = yearRaw ? Number(yearRaw) : null;
  const journal = String(formData.get("journal") ?? "").trim() || null;
  const doi = String(formData.get("doi") ?? "").trim() || null;
  const topic = String(formData.get("topic") ?? "").trim() || "Diğer";
  const tags = parseTags(String(formData.get("tags") ?? ""));
  const abstract = String(formData.get("abstract") ?? "").trim() || null;

  const { error } = await supabase.from("sources").insert({
    user_id: user.id,
    kind: "article",
    title,
    authors,
    year: year && Number.isFinite(year) ? year : null,
    journal,
    doi,
    url: doi ? `https://doi.org/${doi}` : null,
    abstract,
    // mynote: own-added articles land in the "Notlarım" tab (not "Kaydedilenler").
    metadata: { topic, tags, manual: true, mynote: true },
  });

  if (error) {
    const isDuplicate = error.code === "23505";
    return {
      error: isDuplicate
        ? "Bu DOI ile kayıtlı bir makale zaten var."
        : `Eklenemedi: ${error.message}`,
    };
  }

  revalidatePath("/library");
  return { error: null };
}

/** Saves the rich-text (HTML) summary written for an article. */
export async function saveArticleSummary(id: string, html: string) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return { error: "Oturum bulunamadı." };

  const { data: existing } = await supabase
    .from("sources")
    .select("metadata")
    .eq("id", id)
    .maybeSingle();

  const metadata = {
    ...((existing?.metadata as Record<string, unknown> | null) ?? {}),
    summary: html,
  };

  const { error } = await supabase
    .from("sources")
    .update({ metadata })
    .eq("id", id)
    .eq("kind", "article");

  revalidatePath(`/library/${id}`);
  revalidatePath("/library");
  return { error: error?.message ?? null };
}

export async function deleteArticle(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (id) {
    await supabase.from("sources").delete().eq("id", id).eq("kind", "article");
  }
  revalidatePath("/library");
}
