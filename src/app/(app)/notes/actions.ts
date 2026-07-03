"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { extractHashtags, extractWikiLinks, parseTagInput } from "@/lib/wiki";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** Replaces the note's tag set with the given names (upserting new tags). */
async function syncTags(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  noteId: string,
  names: string[],
) {
  await supabase.from("note_tags").delete().eq("note_id", noteId);
  if (names.length === 0) return;

  await supabase
    .from("tags")
    .upsert(
      names.map((name) => ({ user_id: userId, name })),
      { onConflict: "user_id,name", ignoreDuplicates: true },
    );

  const { data: tags } = await supabase
    .from("tags")
    .select("id")
    .in("name", names);

  if (tags?.length) {
    await supabase
      .from("note_tags")
      .insert(tags.map((t) => ({ note_id: noteId, tag_id: t.id, user_id: userId })));
  }
}

/** Rebuilds outgoing [[wiki links]] by matching titles case-insensitively. */
async function syncLinks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  noteId: string,
  linkedTitles: string[],
) {
  await supabase.from("note_links").delete().eq("from_note", noteId);
  if (linkedTitles.length === 0) return;

  const { data: allNotes } = await supabase.from("notes").select("id, title");
  const byTitle = new Map(
    (allNotes ?? []).map((n) => [n.title.toLocaleLowerCase("tr"), n.id]),
  );

  const targetIds = [
    ...new Set(
      linkedTitles
        .map((t) => byTitle.get(t.toLocaleLowerCase("tr")))
        .filter((id): id is string => Boolean(id) && id !== noteId),
    ),
  ];

  if (targetIds.length) {
    await supabase.from("note_links").insert(
      targetIds.map((to) => ({ user_id: userId, from_note: noteId, to_note: to })),
    );
  }
}

export async function saveNote(formData: FormData) {
  const { supabase, user } = await requireUser();

  const id = String(formData.get("id") ?? "");
  const content = String(formData.get("content") ?? "");
  // Source reference is now optional; columns default to '' so blank is fine.
  const payload = {
    title: String(formData.get("title") ?? "").trim(),
    content,
    source_id: String(formData.get("source_id") ?? "") || null,
    source_title: String(formData.get("source_title") ?? "").trim(),
    source_author: String(formData.get("source_author") ?? "").trim(),
    source_year: Number(formData.get("source_year")) || null,
    source_page: String(formData.get("source_page") ?? "").trim() || null,
  };

  if (!payload.title) {
    redirect(`/notes/${id ? `${id}/edit` : "new"}?error=${encodeURIComponent("Not başlığı zorunludur.")}`);
  }

  let noteId = id;
  if (id) {
    const { error } = await supabase.from("notes").update(payload).eq("id", id);
    if (error) redirect(`/notes/${id}/edit?error=${encodeURIComponent(error.message)}`);
  } else {
    const { data, error } = await supabase
      .from("notes")
      .insert({ ...payload, user_id: user.id })
      .select("id")
      .single();
    if (error || !data) redirect(`/notes/new?error=${encodeURIComponent(error?.message ?? "Kaydedilemedi")}`);
    noteId = data.id;
  }

  const tagNames = [
    ...new Set([
      ...parseTagInput(String(formData.get("tags") ?? "")),
      ...extractHashtags(content),
    ]),
  ];
  await syncTags(supabase, user.id, noteId, tagNames);
  await syncLinks(supabase, user.id, noteId, extractWikiLinks(content));

  revalidatePath("/notes");
  redirect(`/notes/${noteId}`);
}

export async function deleteNote(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (id) await supabase.from("notes").delete().eq("id", id);
  revalidatePath("/notes");
  redirect("/notes");
}

export async function addHighlight(noteId: string, text: string) {
  const { supabase, user } = await requireUser();
  const trimmed = text.trim();
  if (!trimmed) return { error: "Boş alıntı eklenemez." };

  const { error } = await supabase.from("highlights").insert({
    user_id: user.id,
    note_id: noteId,
    text: trimmed,
  });

  revalidatePath(`/notes/${noteId}`);
  revalidatePath("/highlights");
  return { error: error?.message ?? null };
}

export async function deleteHighlight(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (id) await supabase.from("highlights").delete().eq("id", id);
  revalidatePath("/highlights");
}
