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
      onSave={(html) => saveArticleSummary(articleId, html)}
      placeholder="Makaleden aldığınız bilgileri buraya özetleyin… Biçimlendirin, görsel ekleyin, boyutlandırın."
    />
  );
}
