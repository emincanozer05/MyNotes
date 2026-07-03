import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deleteHighlight } from "../notes/actions";

interface HighlightRow {
  id: string;
  text: string;
  created_at: string;
  notes: {
    id: string;
    title: string;
    source_title: string;
    source_author: string;
    source_year: number | null;
    source_page: string | null;
  } | null;
}

export default async function HighlightsPage() {
  const supabase = await createClient();
  const { data: highlights } = await supabase
    .from("highlights")
    .select(
      "id, text, created_at, notes(id, title, source_title, source_author, source_year, source_page)",
    )
    .order("created_at", { ascending: false });

  const rows = (highlights ?? []) as unknown as HighlightRow[];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Öne Çıkanlar</h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Notlarınızda vurguladığınız tüm pasajlar — kaynak künyeleriyle.
        </p>
      </div>

      {rows.length > 0 ? (
        <div className="space-y-3">
          {rows.map((h) => (
            <div
              key={h.id}
              className="card p-4"
            >
              <blockquote className="border-l-2 border-amber-400 pl-3 text-[15px] italic leading-relaxed">
                “{h.text}”
              </blockquote>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-stone-500">
                  {h.notes ? (
                    <>
                      <Link
                        href={`/notes/${h.notes.id}`}
                        className="font-medium text-amber-700 dark:text-amber-400 hover:underline"
                      >
                        {h.notes.title}
                      </Link>{" "}
                      · {h.notes.source_author}
                      {h.notes.source_year && ` (${h.notes.source_year})`},{" "}
                      <em>{h.notes.source_title}</em>
                      {h.notes.source_page && `, s. ${h.notes.source_page}`}
                    </>
                  ) : (
                    "Bağlı not silinmiş"
                  )}
                </p>
                <form action={deleteHighlight}>
                  <input type="hidden" name="id" value={h.id} />
                  <button className="text-xs text-stone-400 hover:text-red-600">
                    Kaldır
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-stone-300 dark:border-stone-700 p-8 text-center text-sm text-stone-500">
          Henüz alıntınız yok. Bir notu açıp önemli bir pasajı seçin —{" "}
          <strong>❝ Alıntıya ekle</strong> düğmesi belirecek.
        </p>
      )}
    </div>
  );
}
