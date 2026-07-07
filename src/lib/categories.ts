// Content categories that partition the Post-it board and the Bookshelf.
// Each category keeps its own isolated set of tags (see the `category` column
// on the `tags` table); tags never cross from one category to another.

// Tab icons are flat SVGs in `src/components/CategoryIcon.tsx` (no emoji).
export const CATEGORIES = [
  { slug: "spor", label: "Spor" },
  { slug: "tarih", label: "Tarih" },
  { slug: "bilim", label: "Bilim" },
  { slug: "felsefe", label: "Felsefe" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug) as CategorySlug[];

export const DEFAULT_CATEGORY: CategorySlug = "spor";

export function isCategory(value: unknown): value is CategorySlug {
  return (
    typeof value === "string" &&
    (CATEGORY_SLUGS as string[]).includes(value)
  );
}

/** Coerces any input to a valid category, falling back to the default. */
export function normalizeCategory(value: unknown): CategorySlug {
  return isCategory(value) ? value : DEFAULT_CATEGORY;
}

export function categoryLabel(slug: string): string {
  return CATEGORIES.find((c) => c.slug === slug)?.label ?? slug;
}
