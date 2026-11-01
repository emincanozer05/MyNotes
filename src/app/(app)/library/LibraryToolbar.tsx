"use client";

import { Icon } from "@/components/Icon";

export type SortId = "added" | "year" | "title";
export type ViewId = "grid" | "list";

const SORT_OPTIONS: { id: SortId; label: string }[] = [
  { id: "added", label: "Son eklenen" },
  { id: "year", label: "Yayın yılı (yeni → eski)" },
  { id: "title", label: "Başlık (A → Z)" },
];

/**
 * Search box + sort + view toggle shared by the "Kaydedilenler" and
 * "Notlarım" tabs. State lives in the parent so it survives tab switches.
 */
export function LibraryToolbar({
  query,
  onQueryChange,
  sort,
  onSortChange,
  view,
  onViewChange,
  shown,
  total,
  showViewToggle = true,
  children,
}: {
  query: string;
  onQueryChange: (q: string) => void;
  sort: SortId;
  onSortChange: (s: SortId) => void;
  view: ViewId;
  onViewChange: (v: ViewId) => void;
  shown: number;
  total: number;
  showViewToggle?: boolean;
  /** Extra filters (dropdowns) placed after the view toggle. */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
        <span
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 text-xs text-stone-400"
        >
          <Icon name="search" className="h-3.5 w-3.5" />
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onQueryChange("");
          }}
          placeholder="Başlık, yazar, dergi veya etiket ara…"
          aria-label="Listede ara"
          className="w-full rounded-full border border-[var(--border)] bg-[var(--surface-2)] py-2 pl-8 pr-8 text-xs font-medium outline-none transition-colors focus:border-[var(--brand-1)] focus:bg-[var(--surface)]"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            aria-label="Aramayı temizle"
            className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-sm leading-none text-stone-400 transition-colors hover:bg-stone-500/10 hover:text-stone-600"
          >
            ×
          </button>
        )}
      </div>

      <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-500">
        <span className="hidden sm:inline">Sırala:</span>
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortId)}
          aria-label="Sıralama"
          className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] py-1.5 pl-3 pr-2 text-xs font-medium text-[var(--foreground)] outline-none transition-colors focus:border-[var(--brand-1)]"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      {showViewToggle && (
        <div
          role="group"
          aria-label="Görünüm"
          className="flex overflow-hidden rounded-md border border-[var(--border-strong)] text-xs font-semibold"
        >
          {(
            [
              { id: "list", label: "Liste", icon: "list" },
              { id: "grid", label: "Kart", icon: "grid" },
            ] as const
          ).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onViewChange(v.id)}
              aria-pressed={view === v.id}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                view === v.id
                  ? "bg-[var(--accent-soft)] text-[var(--accent-text)]"
                  : "bg-[var(--surface-2)] text-stone-500 hover:text-[var(--foreground)]"
              }`}
            >
              <Icon name={v.icon} className="h-3.5 w-3.5" />
              {v.label}
            </button>
          ))}
        </div>
      )}

      {children}

      <span className="ml-auto text-xs text-stone-500" aria-live="polite">
        {shown === total ? `${total} makale` : `${shown} / ${total} makale`}
      </span>
    </div>
  );
}

/**
 * Compact dropdown filter (tags / topics) that sits inside the toolbar row
 * instead of a long chip strip, keeping the cards above the fold.
 */
export function FilterSelect({
  label,
  allLabel,
  items,
  active,
  onChange,
  prefix = "",
}: {
  label: string;
  allLabel: string;
  items: { value: string; count: number }[];
  active: string;
  onChange: (value: string) => void;
  prefix?: string;
}) {
  const isActive = active !== "all";
  return (
    <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-500">
      <span className="hidden sm:inline">{label}</span>
      <span className="relative">
        <select
          value={active}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className={`max-w-[13rem] rounded-full border py-1.5 pl-3 pr-2 text-xs font-medium outline-none transition-colors focus:border-[var(--brand-1)] ${
            isActive
              ? "border-[var(--brand-1)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
              : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--foreground)]"
          }`}
        >
          <option value="all">{allLabel}</option>
          {items.map((i) => (
            <option key={i.value} value={i.value}>
              {prefix}
              {i.value} ({i.count})
            </option>
          ))}
        </select>
      </span>
      {isActive && (
        <button
          type="button"
          onClick={() => onChange("all")}
          aria-label={`${label} filtresini temizle`}
          title="Filtreyi temizle"
          className="flex h-5 w-5 items-center justify-center rounded-full text-sm leading-none text-stone-400 transition-colors hover:bg-stone-500/10 hover:text-stone-600"
        >
          ×
        </button>
      )}
    </label>
  );
}
