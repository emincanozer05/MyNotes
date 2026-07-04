// Instant navigation feedback: shown by Next.js while a route's server
// component streams. Keeps clicks feeling snappy instead of "hanging".
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-9 w-52 rounded-lg bg-stone-400/20" />
        <div className="h-4 w-80 max-w-full rounded bg-stone-400/15" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-36 rounded-2xl border border-[var(--border)] bg-[var(--surface)]/60"
          />
        ))}
      </div>
    </div>
  );
}
