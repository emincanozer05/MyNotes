"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { COURSE_STATUSES, STATUS_META, type CourseStatus } from "@/lib/status";
import { setBookStatus } from "../actions";

/** Clickable reading-status pills on the book detail page. */
export function BookStatusControls({
  bookId,
  status,
}: {
  bookId: string;
  status: CourseStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function changeStatus(s: CourseStatus) {
    if (s === status) return;
    startTransition(async () => {
      await setBookStatus(bookId, s);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {COURSE_STATUSES.map((s) => {
        const meta = STATUS_META[s];
        const active = s === status;
        return (
          <button
            key={s}
            type="button"
            disabled={pending}
            onClick={() => changeStatus(s)}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-60 ${
              active
                ? meta.pill
                : "border border-[var(--border)] text-stone-500 hover:bg-stone-500/10"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
