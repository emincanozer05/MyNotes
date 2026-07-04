"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface TitledNote {
  id: string;
  title: string;
  html: string;
}

/**
 * Saves an array of titled notes into a source's metadata.notes.
 * Shared by Kitap Rafı (books) and Kurslar/Eğitimler (courses); both live in
 * the `sources` table, so ownership is enforced by RLS (update by id).
 */
export async function saveSourceNotes(id: string, notes: TitledNote[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const { data: existing } = await supabase
    .from("sources")
    .select("metadata")
    .eq("id", id)
    .maybeSingle();

  const metadata = {
    ...((existing?.metadata as Record<string, unknown> | null) ?? {}),
    notes,
  };

  const { error } = await supabase
    .from("sources")
    .update({ metadata })
    .eq("id", id);

  // Detail pages call router.refresh(); revalidate the lists too.
  revalidatePath("/bookshelf");
  revalidatePath("/courses");
  revalidatePath("/library");
  return { error: error?.message ?? null };
}
