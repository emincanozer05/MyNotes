import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

interface TagDepth {
  tag: string;
  noteCount: number;
  sourceCount: number;
}

function depthBadge(sourceCount: number) {
  if (sourceCount >= 5)
    return { label: "Derin", icon: "●", cls: "text-[#006300] dark:text-[#0ca30c]" };
  if (sourceCount >= 2)
    return { label: "Orta", icon: "◐", cls: "text-stone-600 dark:text-stone-400" };
  return { label: "Yüzeysel", icon: "○", cls: "text-[#d03b3b]" };
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
        <h1 className="text-2xl font-bold tracking-tight">Bilgi Derinliği</h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Her konuda kaç <em>benzersiz kaynaktan</em> not aldığınızı gösterir —
          tek kaynağa dayanan konular yüzeysel kalma riski taşır.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Etiketli konu", value: rows.length },
          { label: "Benzersiz kaynak", value: totalSources },
          { label: "Yüzeysel konu", value: shallow.length },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 p-4"
          >
            <p className="text-3xl font-bold">{s.value}</p>
            <p className="text-sm text-stone-500 dark:text-stone-400">{s.label}</p>
          </div>
        ))}
      </div>

      {rows.length > 0 ? (
        <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 p-5">
          <h2 className="text-sm font-semibold">
            Konu başına benzersiz kaynak sayısı
          </h2>
          <ul className="mt-4 space-y-3">
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
                    <span className="shrink-0 text-xs text-stone-500 [font-variant-numeric:tabular-nums]">
                      {r.sourceCount} kaynak · {r.noteCount} not ·{" "}
                      <span className={`font-semibold ${badge.cls}`}>
                        {badge.icon} {badge.label}
                      </span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-stone-100 dark:bg-stone-800">
                    <div
                      className="h-2 rounded-full bg-[#2a78d6] dark:bg-[#3987e5]"
                      style={{ width: `${(r.sourceCount / maxSources) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          {shallow.length > 0 && (
            <p className="mt-4 border-t border-stone-100 dark:border-stone-900 pt-3 text-xs text-stone-500">
              💡 {shallow.map((r) => `#${r.tag}`).join(", ")} konularında tek
              kaynağa dayanıyorsunuz — farklı yazarlardan ikinci bir kaynak
              eklemek bakış açınızı genişletir.
            </p>
          )}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-stone-300 dark:border-stone-700 p-8 text-center text-sm text-stone-500">
          Analiz için etiketli not gerekiyor. Notlarınıza <code>#etiket</code>{" "}
          ekledikçe bu panel dolacak.
        </p>
      )}
    </div>
  );
}
