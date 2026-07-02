export type SourceKind = "article" | "book" | "other";

export interface Source {
  id: string;
  user_id: string;
  kind: SourceKind;
  title: string;
  authors: string[];
  year: number | null;
  journal: string | null;
  doi: string | null;
  pmid: string | null;
  url: string | null;
  abstract: string | null;
  cover_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ArticleMetadata {
  title: string;
  authors: string[];
  year: number | null;
  journal: string | null;
  doi: string | null;
  pmid: string | null;
  url: string | null;
  abstract: string | null;
}
