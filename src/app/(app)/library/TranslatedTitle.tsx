"use client";

import { useRef, useState } from "react";

// Module-level cache so the same title isn't re-translated across hovers.
const cache = new Map<string, string>();

/**
 * Article title that links to its source and, on hover, shows an automatic
 * Turkish translation in a floating tooltip.
 */
export function TranslatedTitle({
  text,
  href,
  className = "",
}: {
  text: string;
  href?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [translated, setTranslated] = useState<string | null>(
    cache.get(text) ?? null,
  );
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  async function ensureTranslation() {
    if (fetchedRef.current || cache.has(text)) {
      const c = cache.get(text);
      if (c) setTranslated(c);
      return;
    }
    fetchedRef.current = true;
    setLoading(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (res.ok && data.translated) {
        cache.set(text, data.translated);
        setTranslated(data.translated);
      }
    } catch {
      /* leave translation empty on failure */
    } finally {
      setLoading(false);
    }
  }

  function handleEnter() {
    setOpen(true);
    void ensureTranslation();
  }

  const inner = href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="transition-colors hover:text-lime-600 hover:underline dark:hover:text-lime-400"
      onClick={(e) => e.stopPropagation()}
    >
      {text}
    </a>
  ) : (
    text
  );

  return (
    <span
      className={`relative inline-block ${className}`}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setOpen(false)}
    >
      {inner}
      {open && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-0 top-full z-30 mt-1.5 block w-72 max-w-[85vw] rounded-xl border border-lime-500/40 bg-[var(--surface)] p-3 text-xs font-normal not-italic leading-relaxed text-stone-700 shadow-xl dark:text-stone-200"
        >
          <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-lime-600 dark:text-lime-400">
            🇹🇷 Türkçe çeviri
          </span>
          {loading && !translated ? "Çevriliyor…" : (translated ?? "—")}
        </span>
      )}
    </span>
  );
}
