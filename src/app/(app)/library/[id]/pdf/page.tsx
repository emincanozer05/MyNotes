import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { pdfHighlightsOf, pdfOf } from "@/lib/articlePdf";
import { PdfViewer } from "./PdfViewer";

export default async function ArticlePdfPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("sources")
    .select("id, title, metadata")
    .eq("id", id)
    .eq("kind", "article")
    .maybeSingle();

  const metadata = (data?.metadata ?? null) as Record<string, unknown> | null;
  if (!data || !pdfOf(metadata)) notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <Link
        href={`/library/${data.id}`}
        className="text-sm text-stone-500 hover:text-amber-600"
      >
        ← Makale
      </Link>
      <PdfViewer
        articleId={data.id}
        title={data.title}
        initialHighlights={pdfHighlightsOf(metadata)}
      />
    </div>
  );
}
