/**
 * Route-level loading UI. Shown instantly on navigation while the target
 * server component streams in, so clicks feel responsive instead of hanging
 * on a blank screen.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse space-y-6">
      <div className="space-y-3">
        <div className="h-9 w-56 rounded-lg bg-stone-500/15" />
        <div className="h-4 w-80 max-w-full rounded bg-stone-500/10" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-40 rounded-2xl border border-[var(--border)] bg-stone-500/10"
          />
        ))}
      </div>
    </div>
  );
}
