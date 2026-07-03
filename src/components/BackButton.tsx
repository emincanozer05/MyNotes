"use client";

import { useRouter } from "next/navigation";

/** Small "go back" button used in the app header. */
export function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      title="Geri git"
      className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-stone-600 transition-colors hover:bg-stone-500/10 hover:text-stone-900 dark:text-stone-300 dark:hover:text-white"
    >
      <span aria-hidden className="text-sm leading-none">
        ←
      </span>
      Geri
    </button>
  );
}
