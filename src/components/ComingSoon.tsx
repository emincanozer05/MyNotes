export function ComingSoon({
  title,
  phase,
  description,
}: {
  title: string;
  phase: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <div className="mt-6 rounded-lg border border-dashed border-stone-300 dark:border-stone-700 p-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
          {phase}
        </p>
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
          {description}
        </p>
      </div>
    </div>
  );
}
