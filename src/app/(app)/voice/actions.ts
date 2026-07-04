"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";

export async function saveVoiceNote(
  transcript: string,
  title?: string,
  audioPath?: string | null,
) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return { error: "Oturum bulunamadı." };

  const trimmed = transcript.trim();
  // A recording with no transcript is still valid (audio-only note).
  if (!trimmed && !audioPath) {
    return { error: "Kaydedilecek ses veya transkript yok." };
  }

  const cleanTitle =
    (title ?? "").trim() ||
    `Ses notu — ${new Date().toLocaleDateString("tr-TR")}`;

  const { error } = await supabase.from("voice_notes").insert({
    user_id: user.id,
    transcript: trimmed,
    title: cleanTitle,
    audio_path: audioPath ?? null,
  });

  revalidatePath("/voice");
  return { error: error?.message ?? null };
}

export async function deleteVoiceNote(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // Remove the stored audio file too, if any.
  const { data: row } = await supabase
    .from("voice_notes")
    .select("audio_path")
    .eq("id", id)
    .maybeSingle();
  if (row?.audio_path) {
    await supabase.storage.from("voice-notes").remove([row.audio_path]);
  }

  await supabase.from("voice_notes").delete().eq("id", id);
  revalidatePath("/voice");
}

/** Converts a voice transcript into a regular note and links them. */
export async function convertToNote(formData: FormData) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return;

  const id = String(formData.get("id") ?? "");
  const { data: voice } = await supabase
    .from("voice_notes")
    .select("transcript, title, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!voice?.transcript) return;

  const date = new Date(voice.created_at).toLocaleDateString("tr-TR");
  const { data: note } = await supabase
    .from("notes")
    .insert({
      user_id: user.id,
      title: voice.title?.trim() || `Saha notu — ${date}`,
      content: voice.transcript,
      source_title: "Saha ses kaydı",
      source_author: "Kendi gözlemim",
      source_year: new Date(voice.created_at).getFullYear(),
    })
    .select("id")
    .single();

  if (note) {
    await supabase.from("voice_notes").update({ note_id: note.id }).eq("id", id);
    redirect(`/notes/${note.id}/edit`);
  }
}
