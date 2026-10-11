"use client";

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
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1 sm:max-w-sm">
        <span
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-400"
        >
          🔎
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
          className="flex overflow-hidden rounded-full border border-[var(--border)] text-xs font-semibold"
        >
          {(
            [
              { id: "grid", label: "▦ Kart" },
              { id: "list", label: "☰ Liste" },
            ] as const
          ).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => onViewChange(v.id)}
              aria-pressed={view === v.id}
              className={`px-3 py-1.5 transition-colors ${
                view === v.id
                  ? "bg-[var(--accent-soft)] text-[var(--accent-text)]"
                  : "bg-[var(--surface-2)] text-stone-500 hover:text-[var(--foreground)]"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      <span className="ml-auto text-xs text-stone-500" aria-live="polite">
        {shown === total ? `${total} makale` : `${shown} / ${total} makale`}
      </span>
    </div>
  );
}

/**
 * Pill filter row ("Etiket:" / "Konu:"). Collapses to the first few entries
 * with a "+N daha" toggle so long tag lists don't push the cards off screen.
 */
export function FilterChips({
  label,
  allLabel,
  items,
  active,
  onChange,
  prefix = "",
  expanded,
  onToggleExpanded,
  limit = 8,
}: {
  label: string;
  allLabel: string;
  items: { value: string; count: number }[];
  active: string;
  onChange: (value: string) => void;
  prefix?: string;
  expanded: boolean;
  onToggleExpanded: () => void;
  limit?: number;
}) {
  // Keep the active chip visible even when it would be collapsed away.
  const collapsed = !expanded && items.length > limit;
  let visible = collapsed ? items.slice(0, limit) : items;
  if (collapsed && active !== "all" && !visible.some((i) => i.value === active)) {
    const current = items.find((i) => i.value === active);
    if (current) visible = [...visible, current];
  }
  const hidden = items.length - visible.length;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs font-semibold text-stone-500">{label}</span>
      <button
        type="button"
        onClick={() => onChange("all")}
        aria-pressed={active === "all"}
        className={`rounded-full px-3 py-1 text-xs font-semibold ${
          active === "all" ? "btn-gradient" : "chip"
        }`}
      >
        {allLabel}
      </button>
      {visible.map((i) => (
        <button
          key={i.value}
          type="button"
          onClick={() => onChange(active === i.value ? "all" : i.value)}
          aria-pressed={active === i.value}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            active === i.value ? "btn-gradient" : "chip chip-accent"
          }`}
        >
          {prefix}
          {i.value} ({i.count})
        </button>
      ))}
      {items.length > limit && (
        <button
          type="button"
          onClick={onToggleExpanded}
          className="rounded-full px-2.5 py-1 text-xs font-semibold text-stone-500 hover:text-amber-600 dark:hover:text-amber-400"
        >
          {expanded ? "Daha az göster ↑" : `+${hidden} daha ↓`}
        </button>
      )}
    </div>
  );
}
