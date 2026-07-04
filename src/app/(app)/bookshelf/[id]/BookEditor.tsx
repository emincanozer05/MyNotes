"use client";

import { RichTextEditor } from "@/components/RichTextEditor";
import { saveBookSummary } from "../actions";

export function BookEditor({
  bookId,
  initialHtml,
}: {
  bookId: string;
  initialHtml: string;
}) {
  return (
    <RichTextEditor
      initialHtml={initialHtml}
      accent="amber"
      saveLabel="Özeti Kaydet"
      placeholder="Kitaptan aldığınız bilgileri buraya özetleyin… Biçimlendirin, görsel ekleyin."
      onSave={(html) => saveBookSummary(bookId, html)}
    />
  );
}
