"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { normalizeCategory } from "@/lib/categories";

/** Looks up a cover image for a book by title via Open Library (no API key). */
async function findCoverByTitle(
  title: string,
  author: string,
): Promise<string | null> {
  try {
    const params = new URLSearchParams({ title, limit: "1" });
    if (author) params.set("author", author);
    const res = await fetch(
      `https://openlibrary.org/search.json?${params.toString()}`,
      { headers: { "User-Agent": "sc-hub (library@sc-hub.app)" } },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      docs?: { cover_i?: number; isbn?: string[] }[];
    };
    const doc = data.docs?.[0];
    if (doc?.cover_i) {
      return `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
    }
    if (doc?.isbn?.[0]) {
      return `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-M.jpg`;
    }
  } catch {
    // Network failure -> no cover; a placeholder is shown instead.
  }
  return null;
}

export async function addBook(formData: FormData) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return;

  const title = String(formData.get("title") ?? "").trim();
  const authors = String(formData.get("authors") ?? "").trim();
  if (!title || !authors) return;

  const authorList = authors
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  const manualCover = String(formData.get("cover_url") ?? "").trim();
  // Cover is found automatically from the title; a manual URL overrides it.
  const coverUrl =
    manualCover || (await findCoverByTitle(title, authorList[0] ?? ""));

  await supabase.from("sources").insert({
    user_id: user.id,
    kind: "book",
    title,
    authors: authorList,
    year: Number(formData.get("year")) || null,
    cover_url: coverUrl,
    category: normalizeCategory(formData.get("category")),
  });

  revalidatePath("/bookshelf");
}

export async function deleteBook(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (id) await supabase.from("sources").delete().eq("id", id).eq("kind", "book");
  revalidatePath("/bookshelf");
}

/** Saves the rich-text (HTML) summary written for a book. */
export async function saveBookSummary(id: string, html: string) {
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
    .eq("kind", "book");

  revalidatePath(`/bookshelf/${id}`);
  revalidatePath("/bookshelf");
  return { error: error?.message ?? null };
}

/** Saves a short free-text description shown under the book's title. */
export async function saveBookDescription(id: string, description: string) {
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
    description: description.trim(),
  };

  const { error } = await supabase
    .from("sources")
    .update({ metadata })
    .eq("id", id)
    .eq("kind", "book");

  revalidatePath(`/bookshelf/${id}`);
  return { error: error?.message ?? null };
}

/** Sets a book cover from an uploaded image (data URL) or a pasted URL. */
export async function setBookCover(id: string, cover: string) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return { error: "Oturum bulunamadı." };

  const { error } = await supabase
    .from("sources")
    .update({ cover_url: cover || null })
    .eq("id", id)
    .eq("kind", "book");

  revalidatePath(`/bookshelf/${id}`);
  revalidatePath("/bookshelf");
  return { error: error?.message ?? null };
}

/** Retries the automatic cover lookup for a book that has none. */
export async function refreshCover(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const { data: book } = await supabase
    .from("sources")
    .select("title, authors")
    .eq("id", id)
    .maybeSingle();
  if (!book) return;

  const cover = await findCoverByTitle(book.title, book.authors?.[0] ?? "");
  if (cover) {
    await supabase.from("sources").update({ cover_url: cover }).eq("id", id);
  }
  redirect(`/bookshelf/${id}`);
}
