"use server";

import { revalidatePath } from "next/cache";
import { createClient, getSessionUser } from "@/lib/supabase/server";

const MAX_TERM = 300;
const MAX_DEFINITION = 20_000;

async function requireUser() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) throw new Error("Oturum bulunamadı.");
  return supabase;
}

/** Turns a missing-table error into a hint about the migration. */
function friendlyError(message: string): string {
  return message.includes("glossary_entries")
    ? "Sözlük tablosu bulunamadı. Supabase'de 0015_glossary migration'ını çalıştırın."
    : message;
}

/** Adds a glossary entry. `term` may be empty and filled in later. */
export async function addGlossaryEntry(input: {
  term?: string;
  definition: string;
  sourcePath?: string | null;
}): Promise<{ id?: string; error?: string }> {
  const definition = input.definition.trim().slice(0, MAX_DEFINITION);
  const term = (input.term ?? "").trim().slice(0, MAX_TERM);
  if (!definition && !term) return { error: "Boş girdi kaydedilemez." };
  const supabase = await requireUser();
  const { data, error } = await supabase
    .from("glossary_entries")
    .insert({ term, definition, source_path: input.sourcePath ?? null })
    .select("id")
    .single();
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/glossary");
  return { id: data.id as string };
}

export async function updateGlossaryEntry(
  id: string,
  input: { term: string; definition: string },
): Promise<{ error?: string }> {
  const supabase = await requireUser();
  const { error } = await supabase
    .from("glossary_entries")
    .update({
      term: input.term.trim().slice(0, MAX_TERM),
      definition: input.definition.trim().slice(0, MAX_DEFINITION),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/glossary");
  return {};
}

export async function deleteGlossaryEntry(id: string): Promise<{ error?: string }> {
  const supabase = await requireUser();
  const { error } = await supabase.from("glossary_entries").delete().eq("id", id);
  if (error) return { error: friendlyError(error.message) };
  revalidatePath("/glossary");
  return {};
}
