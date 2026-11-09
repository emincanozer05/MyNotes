"use server";

import { revalidatePath } from "next/cache";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { slugifyCategory } from "@/lib/categories";
import { PDF_BUCKETS, isOwnPdfPath, pdfOf, type ArticlePdf } from "@/lib/articlePdf";
import {
  NOTEBOOK_CONFIG_MARKER,
  NOTEBOOK_MARKER,
  isNotebookIcon,
  parseNotebookCategories,
  type NotebookCategory,
} from "@/lib/notebook";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function requireUser() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  return { supabase, user };
}

/** Reads the settings row (id + category list); null id when not created yet. */
async function readConfig(
  supabase: Supabase,
): Promise<{ id: string | null; categories: NotebookCategory[] }> {
  const { data } = await supabase
    .from("sources")
    .select("id, metadata")
    .eq("kind", "other")
    .contains("metadata", { category: NOTEBOOK_CONFIG_MARKER })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const meta = (data?.metadata ?? null) as { categories?: unknown } | null;
  return {
    id: (data?.id as string | undefined) ?? null,
    categories: parseNotebookCategories(meta?.categories),
  };
}

/** The current user's notebook categories (defaults when never customized). */
export async function getNotebookCategories(): Promise<NotebookCategory[]> {
  const supabase = await createClient();
  return (await readConfig(supabase)).categories;
}

async function writeConfig(
  supabase: Supabase,
  userId: string,
  id: string | null,
  categories: NotebookCategory[],
): Promise<string | null> {
  const metadata = { category: NOTEBOOK_CONFIG_MARKER, categories };
  const { error } = id
    ? await supabase.from("sources").update({ metadata }).eq("id", id)
    : await supabase.from("sources").insert({
        user_id: userId,
        kind: "other",
        title: "Not Defterim · kategoriler",
        authors: [],
        metadata,
      });
  revalidatePath("/notebook");
  return error?.message ?? null;
}

/** Adds a category with a chosen icon. */
export async function addNotebookCategory(
  rawLabel: string,
  icon: string,
): Promise<{ category?: NotebookCategory; error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const label = rawLabel.trim().slice(0, 40);
  if (!label) return { error: "Kategori adı boş olamaz." };
  const slug = slugifyCategory(label);
  if (!slug) return { error: "Geçerli bir kategori adı girin." };

  const config = await readConfig(supabase);
  if (config.categories.some((c) => c.slug === slug)) {
    return { error: "Bu kategori zaten var." };
  }
  const category: NotebookCategory = {
    slug,
    label,
    icon: isNotebookIcon(icon) ? icon : "tag",
  };
  const error = await writeConfig(supabase, user.id, config.id, [
    ...config.categories,
    category,
  ]);
  return error ? { error } : { category };
}

/** Renames a category and/or changes its icon (the slug stays stable). */
export async function updateNotebookCategory(
  slug: string,
  patch: { label?: string; icon?: string },
): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const config = await readConfig(supabase);
  const label = patch.label?.trim().slice(0, 40);
  if (patch.label !== undefined && !label) {
    return { error: "Kategori adı boş olamaz." };
  }
  const next = config.categories.map((c) =>
    c.slug === slug
      ? {
          ...c,
          ...(label ? { label } : {}),
          ...(isNotebookIcon(patch.icon) ? { icon: patch.icon } : {}),
        }
      : c,
  );
  const error = await writeConfig(supabase, user.id, config.id, next);
  return error ? { error } : {};
}

/** Removes a category; refused while it still holds pages. */
export async function deleteNotebookCategory(
  slug: string,
): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const { count } = await supabase
    .from("sources")
    .select("id", { count: "exact", head: true })
    .eq("kind", "other")
    .contains("metadata", { category: NOTEBOOK_MARKER, nb_category: slug });
  if ((count ?? 0) > 0) {
    return { error: "Önce bu kategorideki notları silin ya da taşıyın." };
  }

  const config = await readConfig(supabase);
  const next = config.categories.filter((c) => c.slug !== slug);
  if (next.length === 0) return { error: "En az bir kategori kalmalı." };
  const error = await writeConfig(supabase, user.id, config.id, next);
  return error ? { error } : {};
}

/** Creates an empty page in a category and returns its id. */
export async function createNotebookEntry(
  category: string,
  rawTitle?: string,
): Promise<{ id?: string; error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const title = (rawTitle ?? "").trim().slice(0, 300) || "Adsız not";
  const row = {
    user_id: user.id,
    kind: "other",
    title,
    authors: [],
    metadata: { category: NOTEBOOK_MARKER, nb_category: category, notes: [] },
  };
  // The `category` column (0008/0013) mirrors the slug so highlighted passages
  // land on the matching Post-it board; retry without it on older schemas.
  let res = await supabase
    .from("sources")
    .insert({ ...row, category })
    .select("id")
    .single();
  if (res.error) {
    res = await supabase.from("sources").insert(row).select("id").single();
  }
  if (res.error || !res.data) {
    return { error: res.error?.message ?? "Not oluşturulamadı." };
  }
  revalidatePath("/notebook");
  return { id: res.data.id as string };
}

export async function deleteNotebookEntry(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (id) {
    const { data } = await supabase
      .from("sources")
      .delete()
      .eq("id", id)
      .eq("kind", "other")
      .contains("metadata", { category: NOTEBOOK_MARKER })
      .select("metadata")
      .maybeSingle();
    // Remove the attached PDF too, so storage doesn't keep orphans.
    const pdf = pdfOf(data?.metadata as Record<string, unknown> | null);
    if (pdf) await supabase.storage.from(pdf.bucket).remove([pdf.path]);
  }
  revalidatePath("/notebook");
}

export async function setNotebookEntryTitle(id: string, title: string) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const next = title.trim().slice(0, 300);
  if (!next) return { error: "Başlık boş olamaz." };

  const { error } = await supabase
    .from("sources")
    .update({ title: next })
    .eq("id", id)
    .eq("kind", "other");

  revalidatePath(`/notebook/${id}`);
  revalidatePath("/notebook");
  return { error: error?.message ?? null };
}

/** Moves a page to another notebook category. */
export async function setNotebookEntryCategory(id: string, category: string) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const { data: existing } = await supabase
    .from("sources")
    .select("metadata")
    .eq("id", id)
    .maybeSingle();
  const metadata = {
    ...((existing?.metadata as Record<string, unknown> | null) ?? {}),
    category: NOTEBOOK_MARKER,
    nb_category: category,
  };

  let { error } = await supabase
    .from("sources")
    .update({ metadata, category })
    .eq("id", id);
  if (error) {
    ({ error } = await supabase.from("sources").update({ metadata }).eq("id", id));
  }

  revalidatePath(`/notebook/${id}`);
  revalidatePath("/notebook");
  revalidatePath("/notes");
  return { error: error?.message ?? null };
}

/** Sets a page's author(s) and year (stored in the `authors` / `year` columns). */
export async function setNotebookEntryMeta(
  id: string,
  patch: { authors?: string; year?: string },
) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const update: { authors?: string[]; year?: number | null } = {};
  if (patch.authors !== undefined) {
    update.authors = patch.authors
      .split(/[;,]/)
      .map((a) => a.trim().slice(0, 120))
      .filter(Boolean)
      .slice(0, 20);
  }
  if (patch.year !== undefined) {
    const raw = patch.year.trim();
    if (!raw) {
      update.year = null;
    } else {
      const year = Number(raw);
      if (!/^-?\d{1,4}$/.test(raw) || !Number.isInteger(year)) {
        return { error: "Yıl geçerli bir sayı olmalı." };
      }
      update.year = year;
    }
  }

  const { error } = await supabase
    .from("sources")
    .update(update)
    .eq("id", id)
    .eq("kind", "other")
    .contains("metadata", { category: NOTEBOOK_MARKER });

  revalidatePath(`/notebook/${id}`);
  revalidatePath("/notebook");
  return { error: error?.message ?? null };
}

/**
 * Attaches (or with `null`, removes) a page's PDF. The file is uploaded from
 * the browser first; only the pointer is stored in `metadata.pdf`. The
 * previous file is deleted from storage.
 */
export async function setNotebookEntryPdf(id: string, pdf: ArticlePdf | null) {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Oturum bulunamadı." };

  if (
    pdf &&
    (!PDF_BUCKETS.includes(pdf.bucket) || !isOwnPdfPath(user.id, pdf.path))
  ) {
    return { error: "Geçersiz PDF." };
  }

  const { data: existing } = await supabase
    .from("sources")
    .select("metadata")
    .eq("id", id)
    .eq("kind", "other")
    .contains("metadata", { category: NOTEBOOK_MARKER })
    .maybeSingle();
  if (!existing) return { error: "Not bulunamadı." };

  const current = (existing.metadata as Record<string, unknown> | null) ?? {};
  const previous = pdfOf(current);
  const metadata: Record<string, unknown> = { ...current };
  if (pdf) {
    metadata.pdf = {
      bucket: pdf.bucket,
      path: pdf.path,
      name: String(pdf.name).slice(0, 255),
      size: Number(pdf.size) || 0,
    };
  } else {
    delete metadata.pdf;
  }
  // Highlights are positions inside the old file; they don't carry over.
  if (previous?.path !== pdf?.path) delete metadata.pdfHighlights;

  const { error } = await supabase.from("sources").update({ metadata }).eq("id", id);
  if (!error && previous && previous.path !== pdf?.path) {
    await supabase.storage.from(previous.bucket).remove([previous.path]);
  }

  revalidatePath(`/notebook/${id}`);
  return { error: error?.message ?? null };
}
