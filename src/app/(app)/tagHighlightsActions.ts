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

/** All of the current user's tags, for the "add tag" picker (newest-created first). */
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
  revalidatePath("/highlights");
  return { tag: data };
}

export interface AddTagHighlightInput {
  tagId: string;
  text: string;
  noteId?: string | null;
  sourceId?: string | null;
  sectionId?: string | null;
  sectionTitle?: string | null;
}

/** Records that a passage of text was tagged (for the "Etiketler" list page). */
export async function addTagHighlight(
  input: AddTagHighlightInput,
): Promise<{ error?: string | null }> {
  const { supabase, user } = await requireUser();
  const text = input.text.trim();
  if (!text) return { error: "Boş metin etiketlenemez." };
  if (!input.noteId && !input.sourceId) return { error: "Bağlam bulunamadı." };

  const { error } = await supabase.from("tag_highlights").insert({
    user_id: user.id,
    tag_id: input.tagId,
    text,
    note_id: input.noteId || null,
    source_id: input.sourceId || null,
    section_id: input.sectionId || null,
    section_title: input.sectionTitle || null,
  });

  revalidatePath("/highlights");
  if (input.noteId) revalidatePath(`/notes/${input.noteId}`);
  return { error: error?.message ?? null };
}

export async function deleteTagHighlight(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (id) await supabase.from("tag_highlights").delete().eq("id", id);
  revalidatePath("/highlights");
}
