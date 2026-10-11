"use server";

import { revalidatePath } from "next/cache";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import {
  emptyProfile,
  nameKey,
  normalizeProfile,
  type ContactProfile,
} from "@/lib/network";

/** Data URLs above this are rejected (the client resizes photos to ~10KB). */
const MAX_PHOTO_CHARS = 600_000;

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Rewrites `mutual_contacts` on every other contact that mentions `oldName`:
 * renamed (newName) or removed (null). Only the affected rows are loaded in
 * full, so photos of unrelated contacts never cross the wire.
 */
async function rewriteMentions(
  supabase: Supabase,
  oldName: string,
  newName: string | null,
  exceptId: string,
) {
  const { data: rows } = await supabase
    .from("contacts")
    .select("id, mutual:profile->relationship->mutual_contacts");
  const key = nameKey(oldName);
  const affected = (rows ?? [])
    .filter(
      (r) =>
        r.id !== exceptId &&
        Array.isArray(r.mutual) &&
        (r.mutual as unknown[]).some((n) => typeof n === "string" && nameKey(n) === key),
    )
    .map((r) => r.id as string);
  if (affected.length === 0) return;

  const { data: full } = await supabase
    .from("contacts")
    .select("id, profile")
    .in("id", affected);
  for (const row of full ?? []) {
    const profile = normalizeProfile(row.profile);
    const mutual = profile.relationship.mutual_contacts.filter(
      (n) => nameKey(n) !== key,
    );
    if (newName && !mutual.some((n) => nameKey(n) === nameKey(newName))) {
      mutual.push(newName);
    }
    profile.relationship.mutual_contacts = mutual;
    await supabase
      .from("contacts")
      .update({ profile, updated_at: new Date().toISOString() })
      .eq("id", row.id);
  }
}

/**
 * Creates (id = null) or updates a contact. Mutual contacts that aren't in
 * the network yet are added as minimal profiles so they appear on the map
 * immediately, already linked to this person.
 */
export async function saveContact(
  id: string | null,
  input: ContactProfile,
): Promise<{ error: string | null; id: string | null }> {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return { error: "Oturum bulunamadı.", id: null };

  const profile = normalizeProfile(input);
  const fullName = profile.personal.full_name;
  if (!fullName) return { error: "Ad Soyad zorunludur.", id: null };
  if ((profile.personal.profile_photo?.length ?? 0) > MAX_PHOTO_CHARS) {
    return { error: "Profil fotoğrafı çok büyük.", id: null };
  }
  // A person can't be their own mutual contact.
  profile.relationship.mutual_contacts = profile.relationship.mutual_contacts.filter(
    (n) => nameKey(n) !== nameKey(fullName),
  );

  const now = new Date().toISOString();
  let savedId = id;
  let oldName: string | null = null;

  if (id) {
    const { data: existing } = await supabase
      .from("contacts")
      .select("full_name")
      .eq("id", id)
      .maybeSingle();
    if (!existing) return { error: "Kişi bulunamadı.", id: null };
    oldName = existing.full_name as string;

    const { error } = await supabase
      .from("contacts")
      .update({ full_name: fullName, profile, updated_at: now })
      .eq("id", id);
    if (error) return { error: friendly(error), id: null };
  } else {
    const { data, error } = await supabase
      .from("contacts")
      .insert({ user_id: user.id, full_name: fullName, profile })
      .select("id")
      .single();
    if (error) return { error: friendly(error), id: null };
    savedId = data.id as string;
  }

  if (oldName && nameKey(oldName) !== nameKey(fullName)) {
    await rewriteMentions(supabase, oldName, fullName, savedId!);
  }

  // Add mutual contacts that don't exist yet as new (minimal) people.
  const mutual = profile.relationship.mutual_contacts;
  if (mutual.length > 0) {
    const { data: names } = await supabase.from("contacts").select("full_name");
    const existing = new Set((names ?? []).map((n) => nameKey(n.full_name as string)));
    const missing = mutual.filter((n) => !existing.has(nameKey(n)));
    if (missing.length > 0) {
      await supabase.from("contacts").insert(
        missing.map((name) => {
          const p = emptyProfile();
          p.personal.full_name = name;
          p.relationship.mutual_contacts = [fullName];
          return { user_id: user.id, full_name: name, profile: p };
        }),
      );
    }
  }

  revalidatePath("/network");
  return { error: null, id: savedId };
}

export async function deleteContact(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("contacts")
    .select("full_name")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) return { error: error.message };
  if (existing) await rewriteMentions(supabase, existing.full_name as string, null, id);
  revalidatePath("/network");
  return { error: null };
}

function friendly(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "Bu isimde bir kişi zaten var.";
  if (error.code === "42P01" || (/contacts/.test(error.message) && /exist/.test(error.message)))
    return "contacts tablosu bulunamadı — 0012 migration'ını çalıştırın.";
  return `Kaydedilemedi: ${error.message}`;
}
