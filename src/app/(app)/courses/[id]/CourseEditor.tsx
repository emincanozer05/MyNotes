"use client";

import { RichTextEditor } from "@/components/RichTextEditor";
import { saveCourseSummary } from "../actions";

export function CourseEditor({
  courseId,
  initialHtml,
}: {
  courseId: string;
  initialHtml: string;
}) {
  return (
    <RichTextEditor
      initialHtml={initialHtml}
      accent="amber"
      saveLabel="Notu Kaydet"
      placeholder="Bu kurstan/eğitimden aldığınız bilgileri buraya yazın… Biçimlendirin, görsel ekleyin."
      onSave={(html) => saveCourseSummary(courseId, html)}
    />
  );
}
