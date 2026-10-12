import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeCategory } from "@/lib/categories";
import { pdfHighlightsOf, pdfOf } from "@/lib/articlePdf";
import type { UserTag } from "../../../tagsActions";
import { PdfViewer } from "./PdfViewer";

export default async function ArticlePdfPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; hl?: string }>;
}) {
  const { id } = await params;
  const { page, hl } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("sources")
    .select("id, title, category, metadata")
    .eq("id", id)
    .eq("kind", "article")
    .maybeSingle();

  const metadata = (data?.metadata ?? null) as Record<string, unknown> | null;
  if (!data || !pdfOf(metadata)) notFound();

  // Tags already used in this article's category, offered when filing a post-it.
  const category = normalizeCategory(
    (metadata as { category?: string } | null)?.category ?? (data.category as string | undefined),
  );
  const { data: tagRows } = await supabase
    .from("tags")
    .select("id, name, color")
    .eq("category", category)
    .order("name");

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
        tagCategory={category}
        initialTags={(tagRows ?? []) as UserTag[]}
        initialPage={Number(page) > 0 ? Math.floor(Number(page)) : null}
        initialHighlightId={hl ?? null}
      />
    </div>
  );
}
