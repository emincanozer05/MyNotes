// Shared course status metadata (importable by both server and client code).

export const COURSE_STATUSES = ["reading", "done", "planned"] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

export const STATUS_META: Record<
  CourseStatus,
  { label: string; pill: string; dot: string }
> = {
  reading: {
    label: "Okunuyor",
    pill: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  done: {
    label: "Tamamlandı",
    pill: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  planned: {
    label: "Planlandı",
    pill: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
    dot: "bg-sky-500",
  },
};

export function normalizeStatus(v: unknown): CourseStatus {
  return COURSE_STATUSES.includes(v as CourseStatus)
    ? (v as CourseStatus)
    : "reading";
}
