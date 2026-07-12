// Content categories that partition the Post-it board and the Bookshelf.
// Each category keeps its own isolated set of tags (see the `category` column
// on the `tags` table); tags never cross from one category to another.
//
// The four categories below are built-in and always available. Users can add
// their own categories on top of these ("+" button on both boards); those live
// in the `categories` table (migration 0010) and are fetched at request time
// (see `src/app/(app)/categoriesActions.ts`). Because the Bookshelf and the
// Post-it board both read the same list, a category added on one shows up on
// the other.

export interface Category {
  slug: string;
  label: string;
}

// Tab icons are flat SVGs in `src/components/CategoryIcon.tsx` (no emoji).
export const CATEGORIES: readonly Category[] = [
  { slug: "spor", label: "Spor" },
  { slug: "tarih", label: "Tarih" },
  { slug: "bilim", label: "Bilim" },
  { slug: "felsefe", label: "Felsefe" },
] as const;

// Kept as `string` now that categories are user-extensible; the built-in slugs
// are no longer an exhaustive union.
export type CategorySlug = string;

export const CATEGORY_SLUGS: string[] = CATEGORIES.map((c) => c.slug);

export const DEFAULT_CATEGORY = "spor";

/** True only for the four built-in categories (not user-added ones). */
export function isBuiltInCategory(slug: string): boolean {
  return CATEGORY_SLUGS.includes(slug);
}

/**
 * Coerces any input to a usable category slug. Any non-empty string is kept
 * as-is (it may be a built-in or a user-added slug); everything else falls
 * back to the default. The full list of valid slugs is only known at request
 * time (built-in + the user's own), so this no longer validates membership.
 */
export function normalizeCategory(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return DEFAULT_CATEGORY;
}

/**
 * Turns a human label into a URL/DB-safe slug. Turkish letters are folded to
 * ASCII so slugs stay clean (e.g. "Beslenme & Sağlık" -> "beslenme-saglik").
 */
export function slugifyCategory(label: string): string {
  const fold: Record<string, string> = {
    ç: "c",
    ğ: "g",
    ı: "i",
    ö: "o",
    ş: "s",
    ü: "u",
  };
  return label
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (c) => fold[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/**
 * Human label for a slug. Pass the full category list (built-in + custom) to
 * resolve user-added labels; without it only the built-ins are known and an
 * unknown slug echoes back as-is.
 */
export function categoryLabel(
  slug: string,
  categories: readonly Category[] = CATEGORIES,
): string {
  return categories.find((c) => c.slug === slug)?.label ?? slug;
}
