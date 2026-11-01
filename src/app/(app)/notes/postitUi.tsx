"use client";

import { Icon } from "@/components/Icon";
import { useEffect, type CSSProperties, type ReactNode } from "react";

export interface PostitTag {
  name: string;
  color?: string | null;
}

/** Inline style that tints the card's left accent bar with a tag colour. */
export function accentStyle(color: string | null | undefined): CSSProperties | undefined {
  return color ? ({ "--postit-accent": color } as CSSProperties) : undefined;
}

/** Quiet tag list: a colour dot + name per tag. */
export function TagList({
  tags,
  max,
  size = "sm",
}: {
  tags: PostitTag[];
  max?: number;
  size?: "sm" | "lg";
}) {
  if (tags.length === 0) return null;
  const shown = max ? tags.slice(0, max) : tags;
  return (
    <span
      className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[var(--muted)] ${
        size === "lg" ? "text-xs" : "text-[11px]"
      }`}
    >
      {shown.map((t) => (
        <span key={t.name} className="inline-flex items-center gap-1">
          <span
            aria-hidden
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ background: t.color ?? "var(--border-strong)" }}
          />
          {t.name}
        </span>
      ))}
      {max && tags.length > max && <span>+{tags.length - max}</span>}
    </span>
  );
}

/** Hover-revealed delete control in the card's top-right corner. */
export function CardDeleteButton({
  title,
  onConfirm,
}: {
  title: string;
  /** Returns false to cancel the submit. */
  onConfirm: () => boolean;
}) {
  return (
    <button
      type="submit"
      title={title}
      aria-label={title}
      onClick={(e) => {
        e.stopPropagation();
        if (!onConfirm()) e.preventDefault();
      }}
      className="touch-show flex h-6 w-6 items-center justify-center rounded-md text-[var(--muted)] opacity-0 transition-all hover:bg-rose-500/10 hover:text-rose-500 focus:opacity-100 group-hover:opacity-100"
    >
      <Icon name="trash" className="h-3.5 w-3.5" />
    </button>
  );
}

/**
 * Expanded post-it: a plain centred panel over a dimmed backdrop, closed with
 * Escape, the × button or a click outside; optional "Kaynağa git" below.
 */
export function ExpandedPostit({
  accent,
  className = "",
  onClose,
  onGoToSource,
  children,
}: {
  accent?: string | null;
  className?: string;
  onClose: () => void;
  onGoToSource?: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/45 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`postit postit-expand relative flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden ${className}`}
        style={accentStyle(accent)}
      >
        <button
          type="button"
          onClick={onClose}
          title="Kapat"
          aria-label="Kapat"
          className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          <Icon name="x" className="h-4 w-4" />
        </button>
        {children}
      </div>

      {onGoToSource && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onGoToSource();
          }}
          className="btn-ghost inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold"
        >
          Kaynağa git <Icon name="arrow-right" />
        </button>
      )}
    </div>
  );
}
