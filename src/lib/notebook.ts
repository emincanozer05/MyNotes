// "Not Defterim" (personal notebook) — shared types and constants.
//
// Like Kurslar/Eğitimler, notebook pages live in the shared `sources` table
// (kind "other") so no schema migration is needed:
//   - each page:   metadata.category = NOTEBOOK_MARKER, metadata.nb_category =
//                  its notebook category slug, metadata.notes = titled notes;
//                  the `category` column mirrors the slug so highlighted
//                  passages land on the matching Post-it board.
//   - categories:  a single per-user settings row with metadata.category =
//                  NOTEBOOK_CONFIG_MARKER and metadata.categories = the list
//                  (slug, label, icon). Missing row = the defaults below.
// Both rows are protected by the `sources` RLS policies (user_id).

import type { IconName } from "@/components/Icon";

export const NOTEBOOK_MARKER = "notebook";
export const NOTEBOOK_CONFIG_MARKER = "notebook-config";

export interface NotebookCategory {
  slug: string;
  label: string;
  icon: IconName;
}

/** Default categories (no "Spor" — the notebook is for everything else). */
export const DEFAULT_NOTEBOOK_CATEGORIES: NotebookCategory[] = [
  { slug: "tarih", label: "Tarih", icon: "landmark" },
  { slug: "bilim", label: "Bilim", icon: "flask" },
  { slug: "felsefe", label: "Felsefe", icon: "lightbulb" },
  { slug: "kisisel-gelisim", label: "Kişisel Gelişim", icon: "tag" },
];

/** Icons offered in the category icon picker. */
export const NOTEBOOK_ICONS: IconName[] = [
  "tag",
  "landmark",
  "flask",
  "lightbulb",
  "sprout",
  "brain",
  "heart",
  "globe",
  "book",
  "notebook",
  "graduation",
  "music",
  "code",
  "palette",
  "briefcase",
  "leaf",
  "compass",
  "target",
  "camera",
  "film",
  "coffee",
  "plane",
  "users",
  "calculator",
  "chart",
  "flag",
  "home",
  "star",
  "sparkles",
  "quote",
];

export function isNotebookIcon(value: unknown): value is IconName {
  return typeof value === "string" && (NOTEBOOK_ICONS as string[]).includes(value);
}

/** Validates a stored category list; falls back to the defaults. */
export function parseNotebookCategories(value: unknown): NotebookCategory[] {
  if (!Array.isArray(value)) return DEFAULT_NOTEBOOK_CATEGORIES;
  const out: NotebookCategory[] = [];
  const seen = new Set<string>();
  for (const v of value) {
    const c = v as Partial<NotebookCategory> | null;
    if (!c || typeof c.slug !== "string" || typeof c.label !== "string") continue;
    if (!c.slug || seen.has(c.slug)) continue;
    seen.add(c.slug);
    out.push({
      slug: c.slug,
      label: c.label,
      icon: isNotebookIcon(c.icon) ? c.icon : "tag",
    });
  }
  return out;
}

/** HTML → plain text (used for card previews and in-tab search). */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<img[^>]*>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])[^>]*>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Case/diacritic-insensitive key for Turkish search. */
export function searchKey(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i");
}
