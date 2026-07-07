"use server";

import { revalidatePath } from "next/cache";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { normalizeStatus, type CourseStatus } from "./status";

// Courses/trainings are stored in the shared `sources` table as kind "other"
// tagged with metadata.category = "course" (no schema migration needed).
const CATEGORY = "course";

export async function addCourse(formData: FormData) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return;

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const authors = String(formData.get("authors") ?? "")
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  const cover = String(formData.get("cover_url") ?? "").trim() || null;
  const url = String(formData.get("url") ?? "").trim() || null;
  const status = normalizeStatus(formData.get("status"));

  const row = {
    user_id: user.id,
    kind: "other",
    title,
    authors,
    year: Number(formData.get("year")) || null,
    cover_url: cover,
    url,
    metadata: { category: CATEGORY, status },
  };

  // Courses are S&C content: pin them to the "spor" category so their note
  // tags and highlighted passages surface on the Spor post-it board. On a DB
  // where the 0008 migration isn't applied yet the column doesn't exist, so
  // retry without it rather than failing to add the course.
  const { error } = await supabase
    .from("sources")
    .insert({ ...row, category: "spor" });
  if (error) await supabase.from("sources").insert(row);

  revalidatePath("/courses");
}

export async function deleteCourse(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (id) {
    await supabase.from("sources").delete().eq("id", id).eq("kind", "other");
  }
  revalidatePath("/courses");
}

async function mergeMetadata(id: string, patch: Record<string, unknown>) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return { error: "Oturum bulunamadı." };

  const { data: existing } = await supabase
    .from("sources")
    .select("metadata")
    .eq("id", id)
    .maybeSingle();

  const metadata = {
    ...((existing?.metadata as Record<string, unknown> | null) ?? {}),
    category: CATEGORY,
    ...patch,
  };

  const { error } = await supabase
    .from("sources")
    .update({ metadata })
    .eq("id", id)
    .eq("kind", "other");

  revalidatePath(`/courses/${id}`);
  revalidatePath("/courses");
  return { error: error?.message ?? null };
}

/** Saves the rich-text (HTML) notes/summary for a course. */
export async function saveCourseSummary(id: string, html: string) {
  return mergeMetadata(id, { summary: html });
}

/** Sets the reading/progress status of a course. */
export async function setCourseStatus(id: string, status: CourseStatus) {
  return mergeMetadata(id, { status: normalizeStatus(status) });
}

/** Sets a course cover from an uploaded image (data URL) or pasted URL. */
export async function setCourseCover(id: string, cover: string) {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return { error: "Oturum bulunamadı." };

  const { error } = await supabase
    .from("sources")
    .update({ cover_url: cover || null })
    .eq("id", id)
    .eq("kind", "other");

  revalidatePath(`/courses/${id}`);
  revalidatePath("/courses");
  return { error: error?.message ?? null };
}
