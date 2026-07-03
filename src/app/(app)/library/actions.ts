"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CURATED_ARTICLES } from "@/lib/curatedArticles";

/** Saves one of the curated RCT articles to the user's library (idempotent). */
export async function saveCuratedArticle(pmid: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

export async function deleteArticle(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (id) {
    await supabase.from("sources").delete().eq("id", id).eq("kind", "article");
  }
  revalidatePath("/library");
}
