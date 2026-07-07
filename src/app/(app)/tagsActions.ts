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
 * True when PostgREST rejects the request because `tags.category` is not in
 * the deployed schema — the 0008 migration hasn't been applied (or the schema
 * cache is stale). Tag actions then fall back to category-less behaviour so
 * tagging keeps working instead of failing with a cryptic error.
 */
function missingCategoryColumn(
  error: { message?: string } | null | undefined,
): boolean {
  const msg = error?.message ?? "";
  return (
    msg.includes("category") &&
    (msg.includes("schema cache") || msg.includes("does not exist"))
  );
}

/**
 * The current user's tags for the "add tag" picker. When a category is given,
 * only that category's tags are returned so categories never share tags.
 */
export async function getUserTags(category?: string): Promise<UserTag[]> {
  const { supabase } = await requireUser();
  if (category) {
    const { data, error } = await supabase
      .from("tags")
      .select("id, name, color")
      .eq("category", normalizeCategory(category))
      .order("name");
    if (!error) return data ?? [];
    if (!missingCategoryColumn(error)) return [];
    // Fall through: category column not deployed yet -> one shared tag set.
  }
  const { data } = await supabase.from("tags").select("id, name, color").order("name");
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

  const withCategory = await supabase
    .from("tags")
    .select("id, name, color")
    .eq("name", normalized)
    .eq("category", cat)
    .maybeSingle();
  // DB without the category column (0008 not applied): match by name only.
  const legacySchema = missingCategoryColumn(withCategory.error);
  const existing = legacySchema
    ? (
        await supabase
          .from("tags")
          .select("id, name, color")
          .eq("name", normalized)
          .maybeSingle()
      ).data
    : withCategory.data;
  if (existing) return { tag: existing };

  let { data, error } = await supabase
    .from("tags")
    .insert(
      legacySchema
        ? { user_id: user.id, name: normalized, color }
        : { user_id: user.id, name: normalized, color, category: cat },
    )
    .select("id, name, color")
    .single();
  if (error && missingCategoryColumn(error)) {
    ({ data, error } = await supabase
      .from("tags")
      .insert({ user_id: user.id, name: normalized, color })
      .select("id, name, color")
      .single());
  }
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
