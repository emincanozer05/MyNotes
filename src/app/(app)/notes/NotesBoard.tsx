"use client";

import { useMemo, useState } from "react";
import { CATEGORIES, categoryLabel, normalizeCategory } from "@/lib/categories";
import { CategoryIcon } from "@/components/CategoryIcon";
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
}: {
  cards: PostitData[];
  passages: PassageItem[];
  initialCategory: string;
  initialTag?: string;
  initialQ?: string;
}) {
  const [category, setCategory] = useState(normalizeCategory(initialCategory));
  const [tag, setTag] = useState(initialTag ?? "");
  const [q, setQ] = useState(initialQ ?? "");

  function syncUrl(next: { category: string; tag: string; q: string }) {
    const params = new URLSearchParams({ category: next.category });
    if (next.tag) params.set("tag", next.tag);
    if (next.q) params.set("q", next.q);
    window.history.replaceState(null, "", `/notes?${params.toString()}`);
  }

  function switchCategory(slug: (typeof CATEGORIES)[number]["slug"]) {
    setCategory(slug);
    setTag(""); // tags are category-scoped; the active one may not exist here
    syncUrl({ category: slug, tag: "", q });
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
          <h1 className="text-4xl font-extrabold tracking-tight">
            <span className="gradient-text">Post-it Notlar</span>
          </h1>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
            {categoryLabel(category)} panosu — notların ve etiketlediğin
            cümlelerin renkli post-it&apos;ler olur.
          </p>
        </div>
        <NewPostitButton category={category} />
      </div>

      {/* Kategori sekmeleri: her kategori kendi post-it'leri ve etiketleriyle */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => {
          const active = c.slug === category;
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => switchCategory(c.slug)}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                active
                  ? "bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow"
                  : "bg-stone-500/10 text-stone-600 hover:bg-stone-500/20 dark:text-stone-400"
              }`}
            >
              <CategoryIcon slug={c.slug} />
              {c.label}
            </button>
          );
        })}
      </div>

      <input
        value={q}
        onChange={(e) => changeQuery(e.target.value)}
        placeholder="Post-it'lerde ara…"
        className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
      />

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => switchTag("")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !tag
                ? "bg-gradient-to-r from-amber-500 to-rose-500 text-white"
                : "bg-stone-500/10 text-stone-600 hover:bg-stone-500/20 dark:text-stone-400"
            }`}
          >
            Tümü
          </button>
          {allTags.map((t) => {
            const active = tag === t.name;
            return (
              <button
                key={t.name}
                type="button"
                onClick={() => switchTag(active ? "" : t.name)}
                className="rounded-full px-3 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90"
                style={{
                  background: t.color ?? "#78716c",
                  opacity: active ? 1 : 0.55,
                }}
              >
                #{t.name}
              </button>
            );
          })}
        </div>
      )}

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
