import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchArticleMetadata, parseArticleInput } from "@/lib/metadata";

/** POST /api/import — body: { input: string } (DOI, doi.org URL, PMID or PubMed URL) */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    input?: string;
    preview?: boolean;
  } | null;

  const parsed = body?.input ? parseArticleInput(body.input) : null;
  if (!parsed) {
    return NextResponse.json(
      { error: "Geçerli bir DOI, PMID veya PubMed linki girin." },
      { status: 400 },
    );
  }

  let metadata;
  try {
    metadata = await fetchArticleMetadata(parsed);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Makale bilgisi alınamadı." },
      { status: 502 },
    );
  }

  // Preview mode: return the fetched metadata without persisting anything,
  // so a form can auto-fill its fields before the user confirms.
  if (body?.preview) {
    return NextResponse.json({ metadata }, { status: 200 });
  }

  const { data: source, error } = await supabase
    .from("sources")
    .insert({
      user_id: user.id,
      kind: "article",
      title: metadata.title,
      authors: metadata.authors,
      year: metadata.year,
      journal: metadata.journal,
      doi: metadata.doi,
      pmid: metadata.pmid,
      url: metadata.url,
      abstract: metadata.abstract,
    })
    .select()
    .single();

  if (error) {
    const isDuplicate = error.code === "23505";
    return NextResponse.json(
      {
        error: isDuplicate
          ? "Bu makale zaten kütüphanenizde."
          : `Kaydedilemedi: ${error.message}`,
      },
      { status: isDuplicate ? 409 : 500 },
    );
  }

  return NextResponse.json({ source }, { status: 201 });
}
