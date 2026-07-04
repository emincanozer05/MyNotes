"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { sm2Review, type Sm2Quality } from "@/lib/sm2";

export async function createFlashcard(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const front = String(formData.get("front") ?? "").trim();
  const back = String(formData.get("back") ?? "").trim();
  if (!front || !back) return;

  const deck = String(formData.get("deck") ?? "").trim() || "Genel";

  await supabase.from("flashcards").insert({
    user_id: user.id,
    front,
    back,
    deck,
    note_id: String(formData.get("note_id") ?? "") || null,
  });

  revalidatePath("/flashcards");
}

export async function deleteFlashcard(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (id) await supabase.from("flashcards").delete().eq("id", id);
  revalidatePath("/flashcards");
}

/** Deletes a card by id (callable directly from client study session). */
export async function deleteFlashcardById(id: string) {
  const supabase = await createClient();
  if (id) await supabase.from("flashcards").delete().eq("id", id);
  revalidatePath("/flashcards");
  return { error: null };
}

export async function gradeFlashcard(id: string, quality: Sm2Quality) {
  const supabase = await createClient();

  const { data: card } = await supabase
    .from("flashcards")
    .select("ease, interval_days, repetitions")
    .eq("id", id)
    .maybeSingle();
  if (!card) return { error: "Kart bulunamadı." };

  const next = sm2Review(card, quality);
  const { error } = await supabase.from("flashcards").update(next).eq("id", id);

  revalidatePath("/flashcards");
  return { error: error?.message ?? null, nextIntervalDays: next.interval_days };
}
