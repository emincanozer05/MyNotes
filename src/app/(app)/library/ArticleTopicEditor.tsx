"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateArticleTopic } from "./actions";

/**
 * "Konu ekle" — assign or change an article's topic. Existing topics are
 * offered in an alphabetically sorted dropdown, and a new one can be typed.
 */
export function ArticleTopicEditor({
  articleId,
  current,
  topics,
}: {
  articleId: string;
  current: string;
  topics: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current === "Diğer" ? "" : current);
  const [pending, startTransition] = useTransition();
  const listId = useId();

  function save() {
    startTransition(async () => {
      await updateArticleTopic(articleId, value);
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    const isSet = current && current !== "Diğer";
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setEditing(true);
        }}
        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
          isSet
            ? "border-amber-500/50 bg-amber-400/10 text-amber-700 hover:bg-amber-400/20 dark:text-amber-300"
            : "border-dashed border-stone-400/50 text-stone-500 hover:border-amber-500/50 hover:text-amber-600"
        }`}
        title="Konuyu düzenle"
      >
        {isSet ? `${current} ✎` : "+ Konu ekle"}
      </button>
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
        placeholder="Konu seç / yaz"
        className="w-40 rounded-md border border-amber-500/50 bg-[var(--surface)] px-2 py-0.5 text-xs outline-none focus:ring-2 focus:ring-amber-500"
      />
      <datalist id={listId}>
        {topics.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="rounded-md bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white hover:bg-amber-600 disabled:opacity-50"
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
