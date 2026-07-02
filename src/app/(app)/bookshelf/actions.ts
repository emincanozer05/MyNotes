"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function addBook(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const title = String(formData.get("title") ?? "").trim();
  const authors = String(formData.get("authors") ?? "").trim();
  if (!title || !authors) return;

  const isbn = String(formData.get("isbn") ?? "").replace(/[-\s]/g, "");
  const manualCover = String(formData.get("cover_url") ?? "").trim();
  // Open Library serves covers by ISBN without an API key
  const coverUrl =
    manualCover || (isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg` : null);

  await supabase.from("sources").insert({
    user_id: user.id,
    kind: "book",
    title,
    authors: authors.split(",").map((a) => a.trim()).filter(Boolean),
    year: Number(formData.get("year")) || null,
    cover_url: coverUrl,
    metadata: isbn ? { isbn } : {},
  });

  revalidatePath("/bookshelf");
}

export async function deleteBook(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (id) await supabase.from("sources").delete().eq("id", id).eq("kind", "book");
  revalidatePath("/bookshelf");
}
