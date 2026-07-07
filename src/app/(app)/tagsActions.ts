"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { normalizeTag } from "@/lib/wiki";
import { normalizeCategory, type CategorySlug } from "@/lib/categories";

async function requireUser() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/login");
  return { supabase, user };
}

export interface UserTag {
  id: string;
  name: string;
  color: string | null;
}

/**
 * The current user's tags for the "add tag" picker. When a category is given,
 * only that category's tags are returned so categories never share tags.
 */
export async function getUserTags(category?: string): Promise<UserTag[]> {
  const { supabase } = await requireUser();
  let query = supabase.from("tags").select("id, name, color").order("name");
  if (category) query = query.eq("category", normalizeCategory(category));
  const { data } = await query;
  return data ?? [];
}

/**
 * Finds-or-creates a tag by name. Colour is only set on first creation — an
 * existing tag keeps the colour it was first given, so re-using a tag always
 * highlights with the same colour.
 */
export async function createOrGetTag(
  name: string,
  color: string,
  category?: string,
): Promise<{ tag?: UserTag; error?: string }> {
  const { supabase, user } = await requireUser();
  const normalized = normalizeTag(name);
  if (!normalized) return { error: "Etiket adı boş olamaz." };
  const cat: CategorySlug = normalizeCategory(category);

  const { data: existing } = await supabase
    .from("tags")
    .select("id, name, color")
    .eq("name", normalized)
    .eq("category", cat)
    .maybeSingle();
  if (existing) return { tag: existing };

  const { data, error } = await supabase
    .from("tags")
    .insert({ user_id: user.id, name: normalized, color, category: cat })
    .select("id, name, color")
    .single();
  if (error || !data) return { error: error?.message ?? "Etiket oluşturulamadı." };

  revalidatePath("/notes");
  return { tag: data };
}

/** Deletes a tag entirely (removes it from any notes it was applied to). */
export async function deleteTag(tagId: string): Promise<{ error?: string | null }> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("tags").delete().eq("id", tagId);
  revalidatePath("/notes");
  return { error: error?.message ?? null };
}

/** Same as `deleteTag`, as a form action for server-rendered delete buttons. */
export async function deleteTagAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (id) await deleteTag(id);
}
