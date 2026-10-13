"use client";

import { useLinkStatus } from "next/link";

/**
 * Click feedback for a card link: a dimmed overlay with a spinner shown while
 * the navigation it started is pending. Must be rendered inside a `<Link>`
 * whose box is `relative`. Always mounted (opacity toggled) so it never shifts
 * the layout.
 */
export function LinkPendingOverlay({ className = "rounded-lg" }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-0 z-[1] flex items-center justify-center bg-black/45 backdrop-blur-[1px] transition-opacity duration-150 ${
        pending ? "opacity-100" : "opacity-0"
      } ${className}`}
    >
      <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-white/30 border-t-white" />
    </span>
  );
}
