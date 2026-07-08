"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateArticleTags } from "./actions";

/**
 * "Etiket ekle" — assign or change an article's tags. Tags are entered as a
 * comma-separated list; existing tags are offered in a datalist for reuse.
 */
export function ArticleTagsEditor({
  articleId,
  current,
  allTags,
}: {
  articleId: string;
  current: string[];
  allTags: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current.join(", "));
  const [pending, startTransition] = useTransition();
  const listId = useId();

  function save() {
    startTransition(async () => {
      await updateArticleTags(articleId, value);
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        {current.map((tag) => (
          <span
            key={tag}
            className="rounded-full border border-sky-500/40 bg-sky-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300"
          >
            #{tag}
          </span>
        ))}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setValue(current.join(", "));
            setEditing(true);
          }}
          className="rounded-full border border-dashed border-stone-400/50 px-2.5 py-0.5 text-[11px] font-semibold text-stone-500 transition-colors hover:border-sky-500/50 hover:text-sky-600"
          title="Etiketleri düzenle"
        >
          {current.length > 0 ? "✎" : "+ Etiket ekle"}
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        list={listId}
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        placeholder="Etiketler (virgülle ayır)"
        className="w-48 rounded-md border border-sky-500/50 bg-[var(--surface)] px-2 py-0.5 text-xs outline-none focus:ring-2 focus:ring-sky-500"
      />
      <datalist id={listId}>
        {allTags.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="rounded-md bg-sky-500 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-sky-600 disabled:opacity-50"
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
    </span>
  );
}
