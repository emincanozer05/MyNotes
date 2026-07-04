"use client";

import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

// True only after the component has mounted on the client (false during SSR),
// without calling setState in an effect.
function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

/**
 * Centered modal rendered through a portal on <body>.
 *
 * Portaling to body is deliberate: rendering the overlay inside the page tree
 * (which contains animated / backdrop-filtered "glass" layers) caused the
 * dialog to be trapped by a transformed ancestor — it stuck to the top and the
 * blurred backdrop produced dark boxes behind headings. On body it always
 * centers in the viewport and the backdrop is uniform.
 */
export function Modal({
  open,
  onClose,
  children,
  maxWidth = "max-w-lg",
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  labelledBy?: string;
}) {
  const mounted = useMounted();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />
      <div
        className={`animate-pop relative z-10 my-auto w-full ${maxWidth} rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
