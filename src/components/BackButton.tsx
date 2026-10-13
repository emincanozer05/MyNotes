"use client";

import { Icon } from "@/components/Icon";
import { useRouter } from "next/navigation";

/** Small "go back" control shown in the app header. */
export function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.back()}
      title="Geri"
      aria-label="Geri dön"
      className="flex items-center gap-1.5 rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold text-stone-500 transition-colors hover:bg-stone-500/10 hover:text-stone-700 dark:hover:text-stone-300"
    >
      <Icon name="arrow-left" className="h-3.5 w-3.5" />
      Geri
    </button>
  );
}
