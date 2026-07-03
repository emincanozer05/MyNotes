"use client";

import { useState } from "react";

// Cache translations for the session so re-hovering a title is instant and we
// don't re-hit the API for the same string.
const cache = new Map<string, string>();

/**
 * Article title that links to its source on click and shows an auto Turkish
 * translation in a tooltip on hover.
 */
export function TranslatableTitle({
  title,
  href,
  className = "",
}: {
  title: string;
  href?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [translation, setTranslation] = useState<string | null>(
    cache.get(title) ?? null,
  );
  const [loading, setLoading] = useState(false);

  async function ensureTranslation() {
    if (cache.has(title) || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: title }),
      });
      const data = await res.json();
      if (res.ok && data.translation) {
        cache.set(title, data.translation);
        setTranslation(data.translation);
      } else {
        setTranslation(data.error ?? "Çeviri alınamadı.");
      }
    } catch {
      setTranslation("Çeviriye ulaşılamadı.");
    } finally {
      setLoading(false);
    }
  }

  function handleEnter() {
    setOpen(true);
    ensureTranslation();
  }

  return (
    <span
      className="relative inline-block"
      onMouseEnter={handleEnter}
      onMouseLeave={() => setOpen(false)}
    >
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`${className} hover:underline`}
        >
          {title}
        </a>
      ) : (
        <span className={className}>{title}</span>
      )}

      {open && (
        <span
          role="tooltip"
          className="pointer-events-none absolute left-0 top-full z-30 mt-1.5 w-max max-w-xs rounded-lg border border-lime-500/40 bg-[var(--surface)] px-3 py-2 text-[12px] not-italic font-medium leading-snug text-stone-700 shadow-xl dark:text-stone-200"
        >
          <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-wider text-lime-600 dark:text-lime-400">
            🇹🇷 Türkçe
          </span>
          {loading && !translation ? "Çeviriliyor…" : translation}
        </span>
      )}
    </span>
  );
}
