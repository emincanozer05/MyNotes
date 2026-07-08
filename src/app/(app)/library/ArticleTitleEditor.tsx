"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateArticleTitle } from "./actions";
import { TranslatedTitle } from "./TranslatedTitle";

/**
 * Article title with an inline edit mode: the pencil next to the title swaps
 * it for a text input so the title can be corrected by hand.
 */
export function ArticleTitleEditor({
  articleId,
  title,
  href,
}: {
  articleId: string;
  title: string;
  href?: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updateArticleTitle(articleId, value);
      if (res.error) {
        setError(res.error);
      } else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  if (!editing) {
    return (
      <span className="inline">
        <TranslatedTitle text={title} href={href} />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setValue(title);
            setEditing(true);
          }}
          className="ml-1.5 align-middle text-xs text-stone-400 transition-colors hover:text-amber-600 dark:hover:text-amber-400"
          title="Başlığı düzenle"
        >
          ✎
        </button>
      </span>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <input
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        placeholder="Makale başlığı"
        className="min-w-0 flex-1 rounded-md border border-amber-500/50 bg-[var(--surface)] px-2 py-1 text-sm font-semibold outline-none focus:ring-2 focus:ring-amber-500"
      />
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="rounded-md bg-amber-500 px-2 py-1 text-[11px] font-bold text-white hover:bg-amber-600 disabled:opacity-50"
      >
        {pending ? "…" : "Kaydet"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-[11px] text-stone-400 hover:text-stone-600"
      >
        ✕
      </button>
      {error && (
        <span className="w-full text-xs font-medium text-rose-600 dark:text-rose-400">
          {error}
        </span>
      )}
    </span>
  );
}
