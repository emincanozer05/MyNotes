"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { normalizeTag } from "@/lib/wiki";

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

/** All of the current user's tags, for the "add tag" picker. */
export async function getUserTags(): Promise<UserTag[]> {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("tags")
    .select("id, name, color")
    .order("name");
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
): Promise<{ tag?: UserTag; error?: string }> {
  const { supabase, user } = await requireUser();
  const normalized = normalizeTag(name);
  if (!normalized) return { error: "Etiket adı boş olamaz." };

  const { data: existing } = await supabase
    .from("tags")
    .select("id, name, color")
    .eq("name", normalized)
    .maybeSingle();
  if (existing) return { tag: existing };

  const { data, error } = await supabase
    .from("tags")
    .insert({ user_id: user.id, name: normalized, color })
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
