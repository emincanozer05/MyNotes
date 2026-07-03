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
      onSave={(html) => saveBookSummary(bookId, html)}
      placeholder="Kitaptan aldığınız bilgileri buraya özetleyin… Biçimlendirin, görsel ekleyin."
    />
  );
}
