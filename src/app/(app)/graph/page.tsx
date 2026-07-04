import { createClient } from "@/lib/supabase/server";
import { GraphView, type GraphEdge, type GraphNode } from "./GraphView";

const LEGEND = [
  { label: "Not", cls: "bg-[#337ea9] dark:bg-[#529cca]" },
  { label: "Etiket", cls: "bg-[#448361] dark:bg-[#4f9768]" },
  { label: "Kaynak", cls: "bg-[#d9730d] dark:bg-[#e0791a]" },
];

export default async function GraphPage() {
  const supabase = await createClient();

  const [{ data: notes }, { data: links }, { data: noteTags }, { data: tags }] =
    await Promise.all([
      supabase.from("notes").select("id, title, source_id, source_title"),
      supabase.from("note_links").select("from_note, to_note"),
      supabase.from("note_tags").select("note_id, tag_id"),
      supabase.from("tags").select("id, name"),
    ]);

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const n of notes ?? []) {
    nodes.push({ id: n.id, label: n.title, type: "note" });
  }
  for (const t of tags ?? []) {
    nodes.push({ id: t.id, label: `#${t.name}`, type: "tag" });
  }

  // sources: one node per unique reference (library id or inline title).
  // Source-less notes (optional reference) contribute no source node.
  const sourceKeys = new Map<string, string>(); // key -> node id
  for (const n of notes ?? []) {
    if (!n.source_id && !n.source_title) continue;
    const key = n.source_id ?? `title:${n.source_title.toLocaleLowerCase("tr")}`;
    if (!sourceKeys.has(key)) {
      const nodeId = `src:${key}`;
      sourceKeys.set(key, nodeId);
      nodes.push({ id: nodeId, label: n.source_title, type: "source" });
    }
    edges.push({ source: n.id, target: sourceKeys.get(key)! });
  }

  for (const l of links ?? []) {
    edges.push({ source: l.from_note, target: l.to_note });
  }
  for (const nt of noteTags ?? []) {
    edges.push({ source: nt.note_id, target: nt.tag_id });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bilgi Grafiği</h1>
        <p className="mt-1.5 text-sm text-[var(--muted)]">
          Notlar, etiketler ve kaynaklar arasındaki ilişki ağı. Düğümleri
          sürükleyebilir, üzerine gelerek komşularını görebilir, nota veya
          etikete tıklayarak gidebilirsiniz.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {LEGEND.map((l) => (
          <span
            key={l.label}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-medium text-[var(--muted)]"
          >
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${l.cls}`} />
            {l.label}
          </span>
        ))}
      </div>

      {nodes.length > 0 ? (
        <div className="glass-card rounded-2xl p-2">
          <GraphView nodes={nodes} edges={edges} />
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted)]">
          Grafik için önce not oluşturun; notlar, etiketler ve kaynaklar burada
          ağ olarak görünecek.
        </p>
      )}
    </div>
  );
}
