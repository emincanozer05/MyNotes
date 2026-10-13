"use server";

import { revalidatePath } from "next/cache";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { deleteGlossary, insertGlossary, updateGlossary } from "@/lib/glossaryStore";

const MAX_TERM = 300;
const MAX_DEFINITION = 20_000;

async function requireUser() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) throw new Error("Oturum bulunamadı.");
  return { supabase, userId: user.id };
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "İşlem başarısız.";
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
  try {
    const { supabase, userId } = await requireUser();
    const id = await insertGlossary(supabase, userId, {
      term,
      definition,
      source_path: input.sourcePath ?? null,
    });
    revalidatePath("/glossary");
    return { id };
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function updateGlossaryEntry(
  id: string,
  input: { term: string; definition: string },
): Promise<{ error?: string }> {
  try {
    const { supabase, userId } = await requireUser();
    await updateGlossary(supabase, userId, id, {
      term: input.term.trim().slice(0, MAX_TERM),
      definition: input.definition.trim().slice(0, MAX_DEFINITION),
    });
    revalidatePath("/glossary");
    return {};
  } catch (e) {
    return { error: errorMessage(e) };
  }
}

export async function deleteGlossaryEntry(id: string): Promise<{ error?: string }> {
  try {
    const { supabase, userId } = await requireUser();
    await deleteGlossary(supabase, userId, id);
    revalidatePath("/glossary");
    return {};
  } catch (e) {
    return { error: errorMessage(e) };
  }
}
