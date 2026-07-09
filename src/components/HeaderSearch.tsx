"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

/** Global search box shown in the app header; submits to /search?q=… */
export function HeaderSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      role="search"
      className="flex w-full max-w-md items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1"
    >
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Tüm notlarda ara…"
        aria-label="Tüm notlarda ara"
        className="w-full bg-transparent text-sm text-[var(--foreground)] placeholder:text-stone-400 focus:outline-none"
      />
      <button
        type="submit"
        aria-label="Ara"
        title="Ara"
        className="shrink-0 rounded-full px-2 py-0.5 text-sm text-stone-500 transition-colors hover:bg-amber-500/10 hover:text-amber-600"
      >
        ⌕
      </button>
    </form>
  );
}
