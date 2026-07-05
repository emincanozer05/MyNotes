"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import {
  extractHashtags,
  extractMarkTags,
  extractWikiLinks,
  parseTagInput,
} from "@/lib/wiki";

async function requireUser() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
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

export interface NoteInput {
  id?: string | null;
  title: string;
  /** Rich-text HTML (may also be legacy plain text). */
  content: string;
  source_id?: string | null;
  source_title?: string;
  source_author?: string;
  source_year?: number | null;
  source_page?: string | null;
  tags?: string;
}

/**
 * Creates or updates a note and returns its id, so the client editor can keep
 * auto-saving a freshly created note. [[wiki links]] and #hashtags are parsed
 * from the text content (HTML tags stripped first so markers aren't hidden
 * behind element boundaries).
 */
export async function upsertNote(
  input: NoteInput,
): Promise<{ id?: string; error?: string | null }> {
  const { supabase, user } = await requireUser();

  const title = input.title.trim();
  if (!title) return { error: "Not başlığı zorunludur." };

  const content = input.content ?? "";
  const payload = {
    title,
    content,
    source_id: input.source_id || null,
    source_title: (input.source_title ?? "").trim(),
    source_author: (input.source_author ?? "").trim(),
    source_year: input.source_year || null,
    source_page: (input.source_page ?? "").trim() || null,
  };

  let noteId = input.id ?? "";
  if (noteId) {
    const { error } = await supabase.from("notes").update(payload).eq("id", noteId);
    if (error) return { error: error.message };
  } else {
    const { data, error } = await supabase
      .from("notes")
      .insert({ ...payload, user_id: user.id })
      .select("id")
      .single();
    if (error || !data) return { error: error?.message ?? "Kaydedilemedi" };
    noteId = data.id;
  }

  // Strip tags to whitespace so [[…]] / #… at the edge of an element are seen.
  const plain = content.replace(/<[^>]*>/g, " ");
  const tagNames = [
    ...new Set([
      ...parseTagInput(input.tags ?? ""),
      ...extractHashtags(plain),
      // Passages highlighted with an inline tag in the editor (<mark …>) must
      // also drive note_tags, so they show on the post-it card and filter.
      ...extractMarkTags(content),
    ]),
  ];
  await syncTags(supabase, user.id, noteId, tagNames);
  await syncLinks(supabase, user.id, noteId, extractWikiLinks(plain));

  revalidatePath("/notes");
  revalidatePath(`/notes/${noteId}`);
  return { id: noteId, error: null };
}

/**
 * Quick post-it capture: creates a note straight from the board modal. No
 * auto-save — the note is only written when the user hits "Yapıştır". When no
 * title is given, the first line of the content becomes the title.
 */
export async function createQuickNote(input: {
  title?: string;
  content: string;
  tags?: string;
}): Promise<{ id?: string; error?: string | null }> {
  const content = (input.content ?? "").trim();
  if (!content) return { error: "Boş not yapıştırılamaz." };

  const explicit = (input.title ?? "").trim();
  const derived = content.split(/\r?\n/)[0].slice(0, 60).trim();
  const title = explicit || derived || "Not";

  return upsertNote({ title, content, tags: input.tags ?? "" });
}

export async function deleteNote(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (id) await supabase.from("notes").delete().eq("id", id);
  revalidatePath("/notes");
  redirect("/notes");
}
