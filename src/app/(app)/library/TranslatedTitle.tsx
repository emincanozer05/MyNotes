"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

// Module-level cache so the same title isn't re-translated across hovers.
const cache = new Map<string, string>();

// True only after client mount (false during SSR) without setState-in-effect.
function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * Article title that links to its source and, on hover, shows an automatic
 * Turkish translation in a floating tooltip.
 *
 * The tooltip is rendered through a portal on <body> and positioned with
 * fixed coordinates so it is never clipped by a card's `overflow: hidden`.
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
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const [translated, setTranslated] = useState<string | null>(
    cache.get(text) ?? null,
  );
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);
  const mounted = useMounted();

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
    const r = anchorRef.current?.getBoundingClientRect();
    if (r) {
      const width = 288; // w-72
      const left = Math.min(r.left, window.innerWidth - width - 12);
      setPos({ left: Math.max(12, left), top: r.bottom + 6 });
    }
    setOpen(true);
    void ensureTranslation();
  }

  const inner = href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="transition-colors hover:text-amber-600 hover:underline dark:hover:text-amber-400"
      onClick={(e) => e.stopPropagation()}
    >
      {text}
    </a>
  ) : (
    text
  );

  return (
    <span
      ref={anchorRef}
      className={`inline ${className}`}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setOpen(false)}
    >
      {inner}
      {mounted &&
        open &&
        pos &&
        createPortal(
          <span
            role="tooltip"
            style={{ left: pos.left, top: pos.top }}
            className="pointer-events-none fixed z-[120] block w-72 max-w-[85vw] rounded-xl border border-amber-500/40 bg-[var(--surface)] p-3 text-xs font-normal not-italic leading-relaxed text-stone-700 shadow-2xl dark:text-stone-200"
          >
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
              🇹🇷 Türkçe çeviri
            </span>
            {loading && !translated ? "Çevriliyor…" : (translated ?? "—")}
          </span>,
          document.body,
        )}
    </span>
  );
}
