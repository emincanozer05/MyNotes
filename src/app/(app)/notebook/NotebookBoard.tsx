"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { LinkPendingOverlay } from "@/components/LinkPending";
import { searchKey, type NotebookCategory } from "@/lib/notebook";
import { createNotebookEntry, deleteNotebookEntry } from "./actions";
import { CategoryDialog } from "./CategoryDialog";

export interface NotebookEntryCard {
  id: string;
  title: string;
  category: string;
  createdAt: string;
  noteTitles: string[];
  /** Plain text of every titled note (preview + search). */
  text: string;
}

const dateFmt = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Short excerpt around the first match (or the start of the text). */
function excerpt(text: string, query: string, size = 160): string {
  if (!text) return "";
  if (query) {
    const idx = searchKey(text).indexOf(searchKey(query));
    if (idx > 40) {
      const start = idx - 40;
      return `…${text.slice(start, start + size)}${start + size < text.length ? "…" : ""}`;
    }
  }
  return text.length > size ? `${text.slice(0, size)}…` : text;
}

export function NotebookBoard({
  entries,
  categories: initialCategories,
  initialCategory,
}: {
  entries: NotebookEntryCard[];
  categories: NotebookCategory[];
  initialCategory: string;
}) {
  const router = useRouter();
  const [categories, setCategories] = useState(initialCategories);
  const [category, setCategory] = useState(initialCategory);
  const [dialog, setDialog] = useState<"add" | "edit" | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, startCreate] = useTransition();
  const [createError, setCreateError] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Keep local state in step with server refreshes (e.g. after router.refresh).
  const [lastCategories, setLastCategories] = useState(initialCategories);
  if (lastCategories !== initialCategories) {
    setLastCategories(initialCategories);
    setCategories(initialCategories);
  }

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const active = categories.find((c) => c.slug === category) ?? categories[0];
  const known = useMemo(() => new Set(categories.map((c) => c.slug)), [categories]);
  // Pages whose category no longer exists fall under the first tab.
  const entryCategory = (e: NotebookEntryCard) =>
    known.has(e.category) ? e.category : categories[0]?.slug;
  const categoryBySlug = (slug: string | undefined) =>
    categories.find((c) => c.slug === slug) ?? categories[0];

  const q = query.trim();
  const searching = q.length > 0;
  const shown = searching
    ? entries.filter((e) =>
        searchKey(`${e.title} ${e.noteTitles.join(" ")} ${e.text}`).includes(searchKey(q)),
      )
    : entries.filter((e) => entryCategory(e) === active?.slug);

  function switchCategory(slug: string) {
    setCategory(slug);
    window.history.replaceState(null, "", `/notebook?category=${slug}`);
  }

  function closeSearch() {
    setSearchOpen(false);
    setQuery("");
  }

  function createEntry() {
    if (!active) return;
    setCreateError(null);
    startCreate(async () => {
      const res = await createNotebookEntry(active.slug);
      if (res.error || !res.id) {
        setCreateError(res.error ?? "Not oluşturulamadı.");
        return;
      }
      router.push(`/notebook/${res.id}`);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Not Defterim</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Kategorilere ayrılmış kişisel notların — her sayfada başlıklı notlar
            tut, biçimlendir, görsel ekle.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
            aria-label="Notlarda ara"
            aria-pressed={searchOpen}
            title="Ara"
            className={`flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
              searchOpen
                ? "border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--foreground)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            }`}
          >
            <Icon name="search" className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={createEntry}
            disabled={creating || !active}
            className="btn-gradient rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {creating ? "Oluşturuluyor…" : "+ Yeni Not"}
          </button>
        </div>
      </div>

      {createError && (
        <p className="text-sm text-rose-600 dark:text-rose-400">{createError}</p>
      )}

      {searchOpen && (
        <div className="relative">
          <Icon
            name="search"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
          />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && closeSearch()}
            placeholder="Tüm kategorilerde başlık ve not içeriğinde ara…"
            aria-label="Not Defterim'de ara"
            className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] py-2.5 pl-10 pr-4 text-sm outline-none focus:border-[var(--border-strong)]"
          />
        </div>
      )}

      {/* Kategori sekmeleri */}
      <div className="flex flex-wrap items-center gap-1.5">
        {categories.map((c) => {
          const isActive = !searching && c.slug === active?.slug;
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => {
                if (searching) closeSearch();
                switchCategory(c.slug);
              }}
              aria-pressed={isActive}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-[var(--foreground)] text-[var(--surface)]"
                  : "bg-[var(--surface-2)] text-[var(--muted)] hover:bg-[var(--surface-3)] hover:text-[var(--foreground)]"
              }`}
            >
              <Icon name={c.icon} className="h-4 w-4" />
              {c.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setDialog("add")}
          className="flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-sm font-semibold text-[var(--muted)] transition-colors hover:bg-[var(--surface-3)] hover:text-[var(--foreground)]"
        >
          <Icon name="plus" className="h-3.5 w-3.5" />
          Kategori
        </button>
        {active && !searching && (
          <button
            type="button"
            onClick={() => setDialog("edit")}
            aria-label={`${active.label} kategorisini düzenle`}
            title="Kategoriyi düzenle (ad, simge)"
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            <Icon name="pencil" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {searching && (
        <p className="text-xs text-[var(--muted)]">
          “{q}” için {shown.length} sonuç
        </p>
      )}

      {shown.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((e) => {
            const cat = categoryBySlug(entryCategory(e));
            const preview = excerpt(e.text, q);
            return (
              <div
                key={e.id}
                className="glass-card group relative flex flex-col rounded-xl"
              >
                <form action={deleteNotebookEntry} className="absolute right-2 top-2 z-10">
                  <input type="hidden" name="id" value={e.id} />
                  <ConfirmSubmit
                    ariaLabel="Notu sil"
                    title="Sil"
                    message={`"${e.title}" silinsin mi?`}
                    className="touch-show flex h-7 w-7 items-center justify-center rounded-full text-[var(--muted)] opacity-0 transition-all hover:bg-rose-500/10 hover:text-rose-600 group-hover:opacity-100"
                  >
                    <Icon name="trash" className="h-3.5 w-3.5" />
                  </ConfirmSubmit>
                </form>
                <Link
                  href={`/notebook/${e.id}`}
                  className="relative flex flex-1 flex-col p-4"
                >
                  <LinkPendingOverlay className="rounded-xl" />
                  <h3 className="line-clamp-2 pr-7 text-sm font-bold leading-snug">
                    {e.title}
                  </h3>
                  {preview ? (
                    <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-[var(--muted)]">
                      {preview}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs italic text-[var(--muted)]">Boş sayfa</p>
                  )}
                  <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-3 text-[11px] text-[var(--muted)]">
                    {searching && cat && (
                      <span className="flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2 py-0.5 font-medium">
                        <Icon name={cat.icon} className="h-3 w-3" />
                        {cat.label}
                      </span>
                    )}
                    {e.noteTitles.length > 0 && (
                      <span>{e.noteTitles.length} başlık</span>
                    )}
                    {e.noteTitles.length > 0 && <span aria-hidden>·</span>}
                    <time dateTime={e.createdAt}>
                      {dateFmt.format(new Date(e.createdAt))}
                    </time>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-[var(--border-strong)] p-10 text-center text-sm text-[var(--muted)]">
          {searching
            ? "Aramanla eşleşen not bulunamadı."
            : `${active?.label ?? "Bu"} kategorisinde henüz not yok. Sağ üstteki “+ Yeni Not” ile başla.`}
        </p>
      )}

      <CategoryDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        editing={dialog === "edit" ? (active ?? null) : null}
        onSaved={(c) => {
          setCategories((prev) =>
            prev.some((x) => x.slug === c.slug)
              ? prev.map((x) => (x.slug === c.slug ? c : x))
              : [...prev, c],
          );
          switchCategory(c.slug);
          router.refresh();
        }}
        onDeleted={(slug) => {
          const rest = categories.filter((c) => c.slug !== slug);
          setCategories(rest);
          if (rest[0]) switchCategory(rest[0].slug);
          router.refresh();
        }}
      />
    </div>
  );
}
