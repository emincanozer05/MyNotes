"use client";

import { RichTextEditor } from "@/components/RichTextEditor";
import { saveArticleSummary } from "../actions";

export function ArticleEditor({
  articleId,
  initialHtml,
}: {
  articleId: string;
  initialHtml: string;
}) {
  return (
    <RichTextEditor
      initialHtml={initialHtml}
      accent="lime"
      saveLabel="Özeti Kaydet"
      placeholder="Makaleden çıkardığın bilgileri buraya özetle… Biçimlendir, görsel ekle."
      onSave={(html) => saveArticleSummary(articleId, html)}
    />
  );
}
