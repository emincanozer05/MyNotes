import { Icon } from "@/components/Icon";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { normalizeCategory } from "@/lib/categories";
import { pdfHighlightsOf, pdfOf } from "@/lib/articlePdf";
import { NOTEBOOK_MARKER } from "@/lib/notebook";
import type { UserTag } from "../../../tagsActions";
import { PdfViewer } from "../../../library/[id]/pdf/PdfViewer";

/** The in-app PDF reader (highlights + post-its) for a Not Defterim page. */
export default async function NotebookPdfPage({
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
    .eq("kind", "other")
    .contains("metadata", { category: NOTEBOOK_MARKER })
    .maybeSingle();

  const metadata = (data?.metadata ?? null) as Record<string, unknown> | null;
  if (!data || !pdfOf(metadata)) notFound();

  // Post-its land on the board of the page's notebook category.
  const category = normalizeCategory(
    (metadata as { nb_category?: string } | null)?.nb_category ??
      (data.category as string | undefined),
  );
  const { data: tagRows } = await supabase
    .from("tags")
    .select("id, name, color")
    .eq("category", category)
    .order("name");

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <Link
        href={`/notebook/${data.id}`}
        className="text-sm text-stone-500 hover:text-amber-600"
      >
        <Icon name="arrow-left" /> Not sayfası
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
