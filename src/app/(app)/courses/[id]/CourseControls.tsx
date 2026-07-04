"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCourseStatus, setCourseCover } from "../actions";
import { COURSE_STATUSES, STATUS_META, type CourseStatus } from "../status";

export function CourseControls({
  courseId,
  status,
}: {
  courseId: string;
  status: CourseStatus;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function changeStatus(s: CourseStatus) {
    if (s === status) return;
    startTransition(async () => {
      await setCourseStatus(courseId, s);
      router.refresh();
    });
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      startTransition(async () => {
        await setCourseCover(courseId, dataUrl);
        router.refresh();
      });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
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

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={pending}
        className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-semibold transition-colors hover:bg-stone-500/10 disabled:opacity-60"
      >
        🖼 Görsel ekle
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
