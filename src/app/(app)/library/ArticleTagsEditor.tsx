"use client";

import { Icon } from "@/components/Icon";
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
  subtle = false,
}: {
  articleId: string;
  current: string[];
  allTags: string[];
  /** Quiet chips; the edit control appears only while hovering the `.group`. */
  subtle?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  // Tags being edited as a list; the input only holds the tag being typed, so
  // picking a datalist suggestion never wipes the ones already added.
  const [list, setList] = useState<string[]>(current);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();
  const listId = useId();

  function addFromInput(): string[] {
    const parts = input
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const next = [...list];
    for (const p of parts) {
      if (!next.some((t) => t.toLocaleLowerCase("tr") === p.toLocaleLowerCase("tr"))) {
        next.push(p);
      }
    }
    setList(next);
    setInput("");
    return next;
  }

  function save() {
    const finalList = addFromInput();
    startTransition(async () => {
      await updateArticleTags(articleId, finalList.join(","));
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
            className={
              subtle
                ? "rounded bg-[var(--surface-2)] px-1.5 py-px text-[11px] font-medium text-[var(--muted)]"
                : "rounded-full border border-sky-500/40 bg-sky-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300"
            }
          >
            {tag}
          </span>
        ))}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setList(current);
            setInput("");
            setEditing(true);
          }}
          className={
            subtle
              ? "touch-show rounded px-1 py-px text-[11px] font-medium text-[var(--muted)] opacity-0 transition-all hover:text-[var(--accent-text)] focus:opacity-100 group-hover:opacity-100"
              : "rounded-full border border-dashed border-stone-400/50 px-2.5 py-0.5 text-[11px] font-semibold text-stone-500 transition-colors hover:border-sky-500/50 hover:text-sky-600"
          }
          title="Etiketleri düzenle"
        >
          {current.length > 0 ? (
            <Icon name="pencil" className="h-3 w-3" />
          ) : (
            "+ Etiket ekle"
          )}
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {list.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full border border-sky-500/40 bg-sky-400/10 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300"
        >
          {tag}
          <button
            type="button"
            onClick={() => setList((prev) => prev.filter((t) => t !== tag))}
            title={`${tag} etiketini kaldır`}
            className="text-sky-500/70 hover:text-rose-500"
          >
            ×
          </button>
        </span>
      ))}
      <input
        list={listId}
        value={input}
        autoFocus
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (input.trim()) addFromInput();
            else save();
          }
          if (e.key === ",") {
            e.preventDefault();
            addFromInput();
          }
          if (e.key === "Escape") setEditing(false);
          if (e.key === "Backspace" && !input) {
            setList((prev) => prev.slice(0, -1));
          }
        }}
        placeholder="Etiket yaz, Enter'a bas"
        className="w-36 rounded-md border border-sky-500/50 bg-[var(--surface)] px-2 py-0.5 text-xs outline-none focus:ring-2 focus:ring-sky-500"
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
        <Icon name="x" className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}
