"use client";

import { Icon } from "@/components/Icon";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCourseTitle } from "../actions";

/** Course title that turns into an input on click and saves on Enter/blur. */
export function EditableTitle({ courseId, title }: { courseId: string; title: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  // Enter/Escape unmount the input, which fires blur: skip that second commit.
  const doneRef = useRef(false);

  function start() {
    doneRef.current = false;
    setValue(title);
    setError(null);
    setEditing(true);
  }

  function commit() {
    if (doneRef.current) return;
    doneRef.current = true;
    const next = value.trim();
    if (!next || next === title) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const res = await setCourseTitle(courseId, next);
      if (res?.error) {
        setError(res.error);
        doneRef.current = false;
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  function cancel() {
    doneRef.current = true;
    setEditing(false);
  }

  if (editing) {
    return (
      <div>
        <input
          autoFocus
          value={value}
          disabled={pending}
          maxLength={300}
          aria-label="Kurs başlığı"
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            else if (e.key === "Escape") cancel();
          }}
          className="w-full rounded-lg border border-[var(--border-strong)] bg-transparent px-2 py-1 text-2xl font-bold leading-tight outline-none focus:border-amber-500 disabled:opacity-60"
        />
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <h1 className="group text-2xl font-bold leading-tight">
      <button
        type="button"
        onClick={start}
        title="Başlığı düzenle"
        className="inline-flex items-start gap-2 text-left"
      >
        <span>{title}</span>
        <span className="touch-show mt-1.5 text-sm text-stone-500 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100">
          <Icon name="pencil" />
        </span>
      </button>
    </h1>
  );
}
