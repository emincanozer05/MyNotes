import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deleteTagHighlight } from "../tagHighlightsActions";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";

interface TagHighlightRow {
  id: string;
  text: string;
  section_title: string | null;
  created_at: string;
  tags: { id: string; name: string; color: string | null } | null;
  notes: { id: string; title: string } | null;
  sources: { id: string; title: string; kind: string } | null;
}

function sourceHref(kind: string, id: string): string {
  if (kind === "book") return `/bookshelf/${id}`;
  if (kind === "article") return `/library/${id}`;
  return `/courses/${id}`;
}

export default async function HighlightsPage() {
  const supabase = await createClient();
  const { data: highlights } = await supabase
    .from("tag_highlights")
    .select(
      "id, text, section_title, created_at, tags(id, name, color), notes(id, title), sources(id, title, kind)",
    )
    .order("created_at", { ascending: false });

  const rows = (highlights ?? []) as unknown as TagHighlightRow[];

  const groups = new Map<
    string,
    { name: string; color: string | null; items: TagHighlightRow[] }
  >();
  for (const row of rows) {
    if (!row.tags) continue;
    const key = row.tags.id;
    if (!groups.has(key)) {
      groups.set(key, { name: row.tags.name, color: row.tags.color, items: [] });
    }
    groups.get(key)!.items.push(row);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Etiketler</h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Notlarınızda, post-it&apos;lerinizde, kitap ve kurs özetlerinizde
          etiketlediğiniz pasajlar — renklerine göre gruplanmış.
        </p>
      </div>

      {groups.size > 0 ? (
        <div className="space-y-6">
          {[...groups.entries()].map(([tagId, group]) => (
            <div key={tagId} className="space-y-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white"
                style={{ background: group.color ?? "#78716c" }}
              >
                🏷 {group.name}
                <span className="opacity-80">· {group.items.length}</span>
              </span>

              <div className="space-y-2">
                {group.items.map((h) => {
                  const target = h.notes
                    ? { href: `/notes/${h.notes.id}`, label: h.notes.title }
                    : h.sources
                      ? {
                          href: sourceHref(h.sources.kind, h.sources.id),
                          label: h.section_title
                            ? `${h.sources.title} — ${h.section_title}`
                            : h.sources.title,
                        }
                      : null;

                  return (
                    <div
                      key={h.id}
                      className="rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 p-4"
                    >
                      <blockquote
                        className="border-l-2 pl-3 text-[15px] italic leading-relaxed"
                        style={{ borderColor: group.color ?? "#78716c" }}
                      >
                        “{h.text}”
                      </blockquote>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-xs text-stone-500">
                          {target ? (
                            <Link
                              href={target.href}
                              className="font-medium text-amber-700 dark:text-amber-400 hover:underline"
                            >
                              {target.label}
                            </Link>
                          ) : (
                            "Bağlı kayıt silinmiş"
                          )}
                        </p>
                        <form action={deleteTagHighlight}>
                          <input type="hidden" name="id" value={h.id} />
                          <ConfirmSubmit
                            message="Bu etiket kaldırılsın mı?"
                            className="text-xs text-stone-400 hover:text-red-600"
                          >
                            Kaldır
                          </ConfirmSubmit>
                        </form>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-stone-300 dark:border-stone-700 p-8 text-center text-sm text-stone-500">
          Henüz etiketlenmiş metniniz yok. Bir not, post-it, kitap veya kurs
          özetinde bir pasaj seçin — <strong>🏷 Etiket ekle</strong> düğmesi
          belirecek.
        </p>
      )}
    </div>
  );
}
