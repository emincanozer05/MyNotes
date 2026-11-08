"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setNotebookEntryMeta } from "../actions";

type Field = "authors" | "year";

/** Inline "Yazar" and "Yıl" inputs for a notebook page; save on blur/Enter. */
export function EntryMetaFields({
  entryId,
  authors,
  year,
}: {
  entryId: string;
  authors: string[];
  year: number | null;
}) {
  const router = useRouter();
  const start = { authors: authors.join(", "), year: year?.toString() ?? "" };
  const initial = useRef(start);
  const [values, setValues] = useState(start);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  // Escape restores the value and blurs: skip the commit that blur triggers.
  const skipRef = useRef(false);

  function commit(field: Field) {
    if (skipRef.current) {
      skipRef.current = false;
      return;
    }
    const next = values[field].trim();
    if (next === initial.current[field].trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await setNotebookEntryMeta(entryId, { [field]: next });
      if (res.error) {
        setError(res.error);
        return;
      }
      initial.current = { ...initial.current, [field]: next };
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1500);
      router.refresh();
    });
  }

  function onKeyDown(field: Field) {
    return (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.currentTarget.blur();
      } else if (e.key === "Escape") {
        skipRef.current = true;
        setValues((v) => ({ ...v, [field]: initial.current[field] }));
        e.currentTarget.blur();
      }
    };
  }

  const inputClass =
    "min-w-0 rounded-md border border-transparent bg-[var(--surface-2)] px-2 py-1 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted)] hover:border-[var(--border-strong)] focus:border-amber-500 disabled:opacity-60";

  return (
    <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2" data-no-explain>
      <label className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-md">
        <span className="shrink-0 font-semibold uppercase tracking-wide">Yazar</span>
        <input
          value={values.authors}
          disabled={pending}
          maxLength={600}
          placeholder="Yazar adı (birden fazlaysa virgülle ayır)"
          onChange={(e) => setValues((v) => ({ ...v, authors: e.target.value }))}
          onBlur={() => commit("authors")}
          onKeyDown={onKeyDown("authors")}
          className={`${inputClass} w-full`}
        />
      </label>
      <label className="flex items-center gap-2">
        <span className="shrink-0 font-semibold uppercase tracking-wide">Yıl</span>
        <input
          value={values.year}
          disabled={pending}
          inputMode="numeric"
          maxLength={5}
          placeholder="Örn. 1927"
          onChange={(e) =>
            setValues((v) => ({ ...v, year: e.target.value.replace(/[^\d-]/g, "") }))
          }
          onBlur={() => commit("year")}
          onKeyDown={onKeyDown("year")}
          className={`${inputClass} w-24 tabular-nums`}
        />
      </label>
      {error && <span className="text-rose-600 dark:text-rose-400">{error}</span>}
      {saved && !error && <span className="text-emerald-600 dark:text-emerald-400">Kaydedildi</span>}
    </div>
  );
}
