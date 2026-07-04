import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

interface TagDepth {
  tag: string;
  noteCount: number;
  sourceCount: number;
}

function depthBadge(sourceCount: number) {
  if (sourceCount >= 5)
    return {
      label: "Derin",
      cls: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
    };
  if (sourceCount >= 2)
    return {
      label: "Orta",
      cls: "bg-amber-500/12 text-amber-700 dark:text-amber-400",
    };
  return {
    label: "Yüzeysel",
    cls: "bg-rose-500/12 text-rose-700 dark:text-rose-400",
  };
}

export default async function InsightsPage() {
  const supabase = await createClient();

  const [{ data: noteTags }, { data: tags }, { data: notes }] =
    await Promise.all([
      supabase.from("note_tags").select("note_id, tag_id"),
      supabase.from("tags").select("id, name"),
      supabase.from("notes").select("id, source_id, source_title, source_author"),
    ]);

  const tagName = new Map((tags ?? []).map((t) => [t.id, t.name]));
  // unique source key: library id or normalized inline reference
  const noteSource = new Map(
    (notes ?? []).map((n) => [
      n.id,
      n.source_id ??
        (n.source_title
          ? `${n.source_title}|${n.source_author}`.toLocaleLowerCase("tr").trim()
          : null),
    ]),
  );

  const perTag = new Map<string, { notes: Set<string>; sources: Set<string> }>();
  for (const nt of noteTags ?? []) {
    const name = tagName.get(nt.tag_id);
    const source = noteSource.get(nt.note_id);
    if (!name || !source) continue;
    if (!perTag.has(name)) perTag.set(name, { notes: new Set(), sources: new Set() });
    const entry = perTag.get(name)!;
    entry.notes.add(nt.note_id);
    entry.sources.add(source);
  }

  const rows: TagDepth[] = [...perTag.entries()]
    .map(([tag, v]) => ({ tag, noteCount: v.notes.size, sourceCount: v.sources.size }))
    .sort((a, b) => b.sourceCount - a.sourceCount || b.noteCount - a.noteCount);

  const maxSources = Math.max(1, ...rows.map((r) => r.sourceCount));
  const totalSources = new Set(
    [...noteSource.values()].filter((s): s is string => Boolean(s)),
  ).size;
  const shallow = rows.filter((r) => r.sourceCount <= 1);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bilgi Derinliği</h1>
        <p className="mt-1.5 text-sm text-[var(--muted)]">
          Her konuda kaç <em>benzersiz kaynaktan</em> not aldığınızı gösterir —
          tek kaynağa dayanan konular yüzeysel kalma riski taşır.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Etiketli konu", value: rows.length },
          { label: "Benzersiz kaynak", value: totalSources },
          { label: "Yüzeysel konu", value: shallow.length },
        ].map((s) => (
          <div key={s.label} className="glass-card rounded-xl p-4">
            <p className="text-3xl font-bold [font-variant-numeric:tabular-nums]">
              {s.value}
            </p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">{s.label}</p>
          </div>
        ))}
      </div>

      {rows.length > 0 ? (
        <div className="glass-card rounded-xl p-5">
          <h2 className="text-sm font-semibold text-[var(--muted)]">
            Konu başına benzersiz kaynak sayısı
          </h2>
          <ul className="mt-4 space-y-3.5">
            {rows.map((r) => {
              const badge = depthBadge(r.sourceCount);
              return (
                <li key={r.tag}>
                  <div className="flex items-baseline justify-between gap-3">
                    <Link
                      href={`/notes?tag=${encodeURIComponent(r.tag)}`}
                      className="text-sm font-medium hover:underline"
                    >
                      #{r.tag}
                    </Link>
                    <span className="flex shrink-0 items-center gap-2 text-xs text-[var(--muted)] [font-variant-numeric:tabular-nums]">
                      {r.sourceCount} kaynak · {r.noteCount} not
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badge.cls}`}
                      >
                        {badge.label}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
                    <div
                      className="h-full rounded-full bg-[var(--brand-4)]"
                      style={{ width: `${(r.sourceCount / maxSources) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          {shallow.length > 0 && (
            <p className="mt-4 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
              💡 {shallow.map((r) => `#${r.tag}`).join(", ")} konularında tek
              kaynağa dayanıyorsunuz — farklı yazarlardan ikinci bir kaynak
              eklemek bakış açınızı genişletir.
            </p>
          )}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
          Analiz için etiketli not gerekiyor. Notlarınıza <code>#etiket</code>{" "}
          ekledikçe bu panel dolacak.
        </p>
      )}
    </div>
  );
}
