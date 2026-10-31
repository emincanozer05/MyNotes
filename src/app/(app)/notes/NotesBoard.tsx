"use client";

import { useMemo, useState } from "react";
import {
  CATEGORIES,
  categoryLabel,
  normalizeCategory,
  type Category,
} from "@/lib/categories";
import { CategoryIcon } from "@/components/CategoryIcon";
import { AddCategoryButton } from "@/components/AddCategoryButton";
import { PostitCard, type PostitData } from "./PostitCard";
import { PassagePostitCard } from "./PassagePostitCard";
import { NewPostitButton } from "./NewPostitButton";

/** A tagged passage promoted to a post-it, with a link back to its source. */
export interface PassageItem {
  key: string;
  text: string;
  tagName: string;
  tagColor: string | null;
  /** Every tag on the passage (a highlight can carry several). */
  tags: { name: string; color: string | null }[];
  sourceLabel: string;
  href: string;
  tilt: string;
  category: string;
  /** Source + location the highlight lives in, so it can be un-highlighted. */
  sourceId: string;
  /** Titled note id the passage sits in, or "" for the legacy summary. */
  noteRef: string;
  /** Passage index within its note/summary (extractTaggedPassages order). */
  passageIndex: number;
}

/**
 * Client-side post-it board: notes and tagged passages for every category
 * arrive pre-fetched, so category tabs, tag chips and search all filter
 * instantly with no server round-trip. The URL query stays in sync so links
 * and the back button keep working.
 */
export function NotesBoard({
  cards,
  passages,
  initialCategory,
  initialTag,
  initialQ,
  categories: initialCategories = CATEGORIES,
}: {
  cards: PostitData[];
  passages: PassageItem[];
  initialCategory: string;
  initialTag?: string;
  initialQ?: string;
  categories?: readonly Category[];
}) {
  const [category, setCategory] = useState(normalizeCategory(initialCategory));
  const [tag, setTag] = useState(initialTag ?? "");
  const [q, setQ] = useState(initialQ ?? "");
  // Optimistically-added categories merge with the server list so the new tab
  // shows instantly; router.refresh() then reconciles the two.
  const [added, setAdded] = useState<Category[]>([]);
  const categories = useMemo(() => {
    const seen = new Set<string>();
    const out: Category[] = [];
    for (const c of [...initialCategories, ...added]) {
      if (!seen.has(c.slug)) {
        seen.add(c.slug);
        out.push(c);
      }
    }
    return out;
  }, [initialCategories, added]);

  function syncUrl(next: { category: string; tag: string; q: string }) {
    const params = new URLSearchParams({ category: next.category });
    if (next.tag) params.set("tag", next.tag);
    if (next.q) params.set("q", next.q);
    window.history.replaceState(null, "", `/notes?${params.toString()}`);
  }

  function switchCategory(slug: string) {
    setCategory(slug);
    setTag(""); // tags are category-scoped; the active one may not exist here
    syncUrl({ category: slug, tag: "", q });
  }

  function handleAdded(c: Category) {
    setAdded((prev) => (prev.some((x) => x.slug === c.slug) ? prev : [...prev, c]));
    switchCategory(c.slug);
  }

  function switchTag(name: string) {
    setTag(name);
    syncUrl({ category, tag: name, q });
  }

  function changeQuery(value: string) {
    setQ(value);
    syncUrl({ category, tag, q: value });
  }

  // Everything shown on the board is scoped to the active category first, so
  // the tag chips below (and their colours) only reflect this category.
  const categoryNotes = useMemo(
    () => cards.filter((n) => n.category === category),
    [cards, category],
  );
  const categoryPassages = useMemo(
    () => passages.filter((it) => it.category === category),
    [passages, category],
  );

  // Distinct tags (name + colour) within this category, for the filter.
  const allTags = useMemo(() => {
    const tagColorByName = new Map<string, string | null>();
    for (const n of categoryNotes) {
      for (const t of n.tags) {
        if (!tagColorByName.has(t.name)) tagColorByName.set(t.name, null);
      }
    }
    for (const it of categoryPassages) {
      for (const t of it.tags) {
        if (!tagColorByName.has(t.name)) tagColorByName.set(t.name, t.color);
      }
    }
    return [...tagColorByName.entries()]
      .map(([name, color]) => ({ name, color }))
      .sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [categoryNotes, categoryPassages]);

  // How many post-its in this category carry each tag (dropdown counts).
  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of categoryNotes)
      for (const t of n.tags) m.set(t.name, (m.get(t.name) ?? 0) + 1);
    for (const it of categoryPassages)
      for (const t of it.tags) m.set(t.name, (m.get(t.name) ?? 0) + 1);
    return m;
  }, [categoryNotes, categoryPassages]);

  // Apply the active tag / search filters within the category subset.
  const needle = q.trim().toLocaleLowerCase("tr");
  const shownNotes = categoryNotes.filter((n) => {
    if (tag && !n.tags.some((t) => t.name === tag)) return false;
    if (!needle) return true;
    const plain = n.content.replace(/<[^>]*>/g, " ").toLocaleLowerCase("tr");
    return (
      n.title.toLocaleLowerCase("tr").includes(needle) || plain.includes(needle)
    );
  });
  const shownPassages = categoryPassages.filter(
    (it) =>
      (!tag || it.tags.some((t) => t.name === tag)) &&
      (!needle ||
        it.text.toLocaleLowerCase("tr").includes(needle) ||
        it.sourceLabel.toLocaleLowerCase("tr").includes(needle)),
  );

  const total = shownNotes.length + shownPassages.length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="gradient-text">Post-it Notlar</span>
          </h1>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
            {`${categoryLabel(category, categories)} panosu — `}notların ve
            etiketlediğin cümlelerin renkli post-it&apos;ler olur.
          </p>
        </div>
        <NewPostitButton category={category} />
      </div>

      {/* Kategori sekmeleri: her kategori kendi post-it'leri ve etiketleriyle */}
      <div className="flex flex-wrap items-center gap-1.5">
        {categories.map((c) => {
          const active = c.slug === category;
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => switchCategory(c.slug)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                active
                  ? "bg-[var(--foreground)] text-[var(--surface)]"
                  : "bg-stone-500/10 text-stone-600 hover:bg-stone-500/20 dark:text-stone-400"
              }`}
            >
              <CategoryIcon slug={c.slug} />
              {c.label}
            </button>
          );
        })}
        <AddCategoryButton onAdded={handleAdded} />
      </div>

      {/* Search + tag filter on one row; tags live in a compact dropdown */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => changeQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") changeQuery("");
          }}
          placeholder="Post-it'lerde ara…"
          aria-label="Post-it'lerde ara"
          className="min-w-[200px] flex-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm outline-none transition-colors focus:border-[var(--brand-1)]"
        />
        {allTags.length > 0 && (
          <label className="flex items-center gap-2 text-xs font-semibold text-stone-500">
            <span className="hidden sm:inline">Etiket:</span>
            <span className="relative flex items-center">
              {/* Colour dot of the active tag (native options can't show it) */}
              <span
                aria-hidden
                className="pointer-events-none absolute left-3 h-2.5 w-2.5 rounded-full"
                style={{
                  background: tag
                    ? (allTags.find((t) => t.name === tag)?.color ?? "#78716c")
                    : "transparent",
                  border: tag ? "none" : "1px solid var(--border-strong)",
                }}
              />
              <select
                value={tag}
                onChange={(e) => switchTag(e.target.value)}
                aria-label="Etikete göre filtrele"
                className={`max-w-[14rem] rounded-full border py-2 pl-7 pr-2 text-sm font-medium outline-none transition-colors focus:border-[var(--brand-1)] ${
                  tag
                    ? "border-[var(--brand-1)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]"
                }`}
              >
                <option value="">Tüm etiketler ({allTags.length})</option>
                {allTags.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({tagCounts.get(t.name) ?? 0})
                  </option>
                ))}
              </select>
            </span>
            {tag && (
              <button
                type="button"
                onClick={() => switchTag("")}
                aria-label="Etiket filtresini temizle"
                title="Filtreyi temizle"
                className="flex h-6 w-6 items-center justify-center rounded-full text-base leading-none text-stone-400 transition-colors hover:bg-stone-500/10 hover:text-stone-600"
              >
                ×
              </button>
            )}
          </label>
        )}
        <span className="ml-auto text-xs text-stone-500" aria-live="polite">
          {total} post-it
        </span>
      </div>

      {total > 0 ? (
        <div className="grid grid-cols-2 gap-4 pt-3 sm:grid-cols-3 lg:grid-cols-4">
          {shownNotes.map((n) => (
            <PostitCard key={`note-${n.id}`} note={n} />
          ))}
          {shownPassages.map((it) => (
            <PassagePostitCard
              key={it.key}
              passage={{
                key: it.key,
                text: it.text,
                tagName: it.tagName,
                tagColor: it.tagColor,
                tags: it.tags,
                sourceLabel: it.sourceLabel,
                href: it.href,
                tilt: it.tilt,
                sourceId: it.sourceId,
                noteRef: it.noteRef,
                passageIndex: it.passageIndex,
              }}
            />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-stone-300 dark:border-stone-700 p-10 text-center text-sm text-stone-500">
          {tag || q
            ? "Bu filtreye uyan post-it bulunamadı."
            : "Henüz post-it'in yok. + Yeni Not ile ilk post-it'ini yapıştır."}
        </p>
      )}
    </div>
  );
}
