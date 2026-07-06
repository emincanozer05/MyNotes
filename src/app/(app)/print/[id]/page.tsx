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
  return { href: "/courses", label: "← Kurslar & Eğitimler" };
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
        <header className="flex min-h-[8rem] items-center gap-6 border-b-2 border-stone-800 pb-6">
          {source.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={source.cover_url}
              alt=""
              className="h-32 w-auto flex-shrink-0 rounded border border-stone-300 object-cover"
            />
          )}
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              S&amp;C Hub — Not Föyü
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

        <div className="mt-6 space-y-6 [&_a]:text-amber-700 [&_blockquote]:border-l-4 [&_blockquote]:border-amber-500 [&_blockquote]:pl-3 [&_blockquote]:italic [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-bold [&_img]:my-2 [&_img]:h-auto [&_img]:max-w-full [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6">
          {notes.length > 0 ? (
            notes.map((n) => (
              <section key={n.id} className="break-inside-avoid">
                <h2 className="border-l-4 border-amber-500 pl-2 text-base font-bold">
                  {n.title}
                </h2>
                <div
                  className="mt-2 text-[11pt] leading-relaxed text-stone-800"
                  dangerouslySetInnerHTML={{
                    __html: n.html || "<p>—</p>",
                  }}
                />
              </section>
            ))
          ) : summary.replace(/<[^>]*>/g, "").trim() ? (
            <div
              className="text-[11pt] leading-relaxed text-stone-800"
              dangerouslySetInnerHTML={{ __html: summary }}
            />
          ) : (
            <p className="text-sm text-stone-500">Henüz not yok.</p>
          )}
        </div>

        <footer className="mt-8 border-t border-stone-300 pt-2 text-xs text-stone-400">
          {new Date().toLocaleDateString("tr-TR")} · S&amp;C Hub
        </footer>
      </div>
    </div>
  );
}
