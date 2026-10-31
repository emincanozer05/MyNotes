"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import type { NotebookCategory } from "@/lib/notebook";
import { setNotebookEntryCategory } from "../actions";

/** Moves a notebook page to another category. */
export function EntryCategoryPicker({
  entryId,
  categories,
  current,
}: {
  entryId: string;
  categories: NotebookCategory[];
  current: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const active = categories.find((c) => c.slug === value);

  function change(slug: string) {
    const prev = value;
    setValue(slug);
    setError(null);
    startTransition(async () => {
      const res = await setNotebookEntryCategory(entryId, slug);
      if (res.error) {
        setValue(prev);
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      <label className="relative inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-2)] py-1 pl-2.5 pr-2 font-semibold text-[var(--foreground)]">
        {active && <Icon name={active.icon} className="h-3.5 w-3.5" />}
        <span className="sr-only">Kategori</span>
        <select
          value={value}
          disabled={pending}
          onChange={(e) => change(e.target.value)}
          className="cursor-pointer appearance-none bg-transparent pr-4 outline-none disabled:opacity-60"
        >
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
        <Icon
          name="chevron-down"
          className="pointer-events-none absolute right-2 h-3 w-3 text-[var(--muted)]"
        />
      </label>
      {error && <span className="text-rose-600 dark:text-rose-400">{error}</span>}
    </span>
  );
}
