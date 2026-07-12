"use server";

import { revalidatePath } from "next/cache";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import {
  CATEGORIES,
  slugifyCategory,
  type Category,
} from "@/lib/categories";

/**
 * The full category list for the current user: the four built-in categories
 * first, then the user's own (migration 0010), in the order they were added.
 * Both the Bookshelf and the Post-it board call this, so a category added on
 * one board appears on the other. Falls back to the built-ins if the
 * `categories` table isn't deployed yet.
 */
export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("slug, label")
    .order("created_at", { ascending: true });

  const merged: Category[] = [...CATEGORIES];
  if (!error) {
    const seen = new Set(merged.map((c) => c.slug));
    for (const c of (data ?? []) as Category[]) {
      if (c.slug && !seen.has(c.slug)) {
        merged.push({ slug: c.slug, label: c.label });
        seen.add(c.slug);
      }
    }
  }
  return merged;
}

/**
 * Adds a user category from a label. The label is slugified (Turkish letters
 * folded to ASCII); built-in slugs and duplicates are rejected. On success the
 * Bookshelf and Post-it boards are revalidated so both pick it up.
 */
export async function addCategory(
  rawLabel: string,
): Promise<{ category?: Category; error?: string }> {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return { error: "Oturum bulunamadı." };

  const label = rawLabel.trim();
  if (!label) return { error: "Kategori adı boş olamaz." };

  const slug = slugifyCategory(label);
  if (!slug) return { error: "Geçerli bir kategori adı girin." };
  if (CATEGORIES.some((c) => c.slug === slug)) {
    return { error: "Bu kategori zaten var." };
  }

  const { error } = await supabase
    .from("categories")
    .insert({ user_id: user.id, slug, label });

  if (error) {
    // 23505 = unique_violation: the user already has this category.
    if (error.code === "23505") return { error: "Bu kategori zaten var." };
    return { error: error.message };
  }

  revalidatePath("/bookshelf");
  revalidatePath("/notes");
  return { category: { slug, label } };
}
