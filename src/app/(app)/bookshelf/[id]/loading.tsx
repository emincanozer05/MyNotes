// Detail-page skeleton so opening a book/course gives instant feedback while
// the server renders the notes editor.
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse space-y-6">
      <div className="h-4 w-24 rounded bg-stone-400/20" />
      <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="h-7 w-4/5 rounded-lg bg-stone-400/20" />
        <div className="h-4 w-3/5 rounded bg-stone-400/15" />
        <div className="flex gap-2 pt-1">
          <div className="h-6 w-28 rounded-full bg-stone-400/15" />
          <div className="h-6 w-20 rounded-full bg-stone-400/15" />
        </div>
      </div>
      <div className="space-y-3">
        <div className="h-6 w-40 rounded-lg bg-stone-400/20" />
        <div className="h-80 rounded-2xl border border-[var(--border)] bg-[var(--surface)]" />
      </div>
    </div>
  );
}
