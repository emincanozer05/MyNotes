import { createClient } from "@/lib/supabase/server";
import { GraphView, type GraphEdge, type GraphNode } from "./GraphView";

const LEGEND = [
  { label: "Not", cls: "bg-[#2a78d6] dark:bg-[#3987e5]" },
  { label: "Etiket", cls: "bg-[#1baf7a] dark:bg-[#199e70]" },
  { label: "Kaynak", cls: "bg-[#eda100] dark:bg-[#c98500]" },
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

  // sources: one node per unique reference (library id or inline title)
  const sourceKeys = new Map<string, string>(); // key -> node id
  for (const n of notes ?? []) {
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
        <h1 className="text-2xl font-bold tracking-tight">Bilgi Grafiği</h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Notlar, etiketler ve kaynaklar arasındaki ilişki ağı. Düğümleri
          sürükleyebilir, üzerine gelerek komşularını görebilir, nota veya
          etikete tıklayarak gidebilirsiniz.
        </p>
      </div>

      <div className="flex gap-4">
        {LEGEND.map((l) => (
          <span key={l.label} className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-400">
            <span className={`inline-block h-3 w-3 rounded-full ${l.cls}`} />
            {l.label}
          </span>
        ))}
      </div>

      {nodes.length > 0 ? (
        <GraphView nodes={nodes} edges={edges} />
      ) : (
        <p className="rounded-lg border border-dashed border-stone-300 dark:border-stone-700 p-8 text-center text-sm text-stone-500">
          Grafik için önce not oluşturun; notlar, etiketler ve kaynaklar burada
          ağ olarak görünecek.
        </p>
      )}
    </div>
  );
}
