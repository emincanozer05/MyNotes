"use client";

import { useEffect, useRef } from "react";
import { RichTextEditor } from "@/components/RichTextEditor";
import { parseNoteHash, scrollToPassage } from "@/lib/passageScroll";
import { saveArticleSummary } from "../actions";

export function ArticleEditor({
  articleId,
  initialHtml,
}: {
  articleId: string;
  initialHtml: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);

  // When arriving with a `#note-legacy~<passage>` fragment (a post-it's
  // "Kaynağa git"), scroll straight to the highlighted passage in the summary.
  useEffect(() => {
    const target = parseNoteHash(window.location.hash);
    if (!target) return;
    return scrollToPassage(() => wrapRef.current, target.passageIndex);
  }, []);

  return (
    <div ref={wrapRef} className="scroll-mt-20">
      <RichTextEditor
        initialHtml={initialHtml}
        accent="amber"
        saveLabel="Özeti Kaydet"
        placeholder="Makaleden çıkardığın bilgileri buraya özetle… Biçimlendir, görsel ekle."
        onSave={(html) => saveArticleSummary(articleId, html)}
      />
    </div>
  );
}
