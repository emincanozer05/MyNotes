import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Source } from "@/lib/types";
import { PrintButton } from "./PrintButton";

interface TitledNote {
  id: string;
  title: string;
  html: string;
}

function backInfo(kind: string): { href: string; label: string } {
  if (kind === "book") return { href: "/bookshelf", label: "← Kitap Rafı" };
  if (kind === "article") return { href: "/library", label: "← Literatür" };
  return { href: "/courses", label: "← Kurslar ve Eğitimler (S&C)" };
}

export default async function PrintSourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("sources")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();
  const source = data as Source;
  const meta = (source.metadata as {
    notes?: TitledNote[];
    summary?: string;
  } | null) ?? {};

  const notes = Array.isArray(meta.notes) ? meta.notes : [];
  const summary = meta.summary ?? "";
  const back = backInfo(source.kind);

  return (
    <div className="space-y-4">
      <div className="no-print mx-auto flex max-w-[210mm] items-center justify-between">
        <Link href={back.href} className="text-sm text-stone-500 hover:text-amber-600">
          {back.label}
        </Link>
        <PrintButton />
      </div>

      <div className="a4-sheet">
        <header className="flex min-h-[11rem] items-center gap-6 border-b-2 border-stone-800 pb-6">
          {source.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={source.cover_url}
              alt=""
              className="h-44 w-auto flex-shrink-0 rounded border border-stone-300 object-cover"
            />
          )}
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              NoteFlow — Not Föyü
            </p>
            <h1 className="mt-2 text-2xl font-bold leading-snug">{source.title}</h1>
            {(source.authors.length > 0 || source.year) && (
              <p className="mt-1 text-base text-stone-600">
                {source.authors.join(", ")}
                {source.authors.length > 0 && source.year ? " · " : ""}
                {source.year ?? ""}
              </p>
            )}
          </div>
        </header>

        {/* Headings/lists/quotes come from `.note-html`, so the printout keeps
            the same type scale the editor shows (h1 16pt, h2 14pt, bold). */}
        <div className="mt-6 space-y-6 [&_a]:text-amber-700">
          {notes.length > 0 ? (
            notes.map((n) => (
              <section key={n.id} className="break-inside-avoid">
                <h2 className="border-l-4 border-amber-500 pl-2 text-[16pt] font-bold leading-snug">
                  {n.title}
                </h2>
                <div
                  className="note-html mt-2 text-[11pt] text-stone-800"
                  dangerouslySetInnerHTML={{
                    __html: n.html || "<p>—</p>",
                  }}
                />
              </section>
            ))
          ) : summary.replace(/<[^>]*>/g, "").trim() ? (
            <div
              className="note-html text-[11pt] text-stone-800"
              dangerouslySetInnerHTML={{ __html: summary }}
            />
          ) : (
            <p className="text-sm text-stone-500">Henüz not yok.</p>
          )}
        </div>

        <footer className="mt-8 border-t border-stone-300 pt-2 text-xs text-stone-400">
          {new Date().toLocaleDateString("tr-TR")} · NoteFlow
        </footer>
      </div>
    </div>
  );
}
