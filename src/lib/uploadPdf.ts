"use client";

import { createClient } from "@/lib/supabase/client";
import {
  MAX_PDF_BYTES,
  PDF_BUCKETS,
  formatBytes,
  pdfPathFor,
  type ArticlePdf,
} from "@/lib/articlePdf";

/** Rejects non-PDF or oversized files; returns a Turkish error message. */
export async function validatePdfFile(file: File): Promise<string | null> {
  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const magic = await file.slice(0, 5).text().catch(() => "");
  if (!isPdf || !magic.startsWith("%PDF")) return "Lütfen bir PDF dosyası seç.";
  if (file.size > MAX_PDF_BYTES) {
    return `PDF çok büyük (${formatBytes(file.size)}). En fazla ${formatBytes(MAX_PDF_BYTES)} yüklenebilir.`;
  }
  return null;
}

/**
 * Uploads a PDF from the browser straight into the user's private storage
 * folder. Tries the dedicated `article-pdfs` bucket first and falls back to
 * `voice-notes` only when that bucket doesn't exist (0014 not applied).
 */
export async function uploadUserPdf(
  file: File,
): Promise<{ pdf: ArticlePdf; error?: undefined } | { pdf?: undefined; error: string }> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return { error: "Oturum bulunamadı; sayfayı yenileyip tekrar dene." };

  let lastError = "";
  for (const bucket of PDF_BUCKETS) {
    const path = pdfPathFor(session.user.id, bucket);
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { contentType: "application/pdf", upsert: false });
    if (!error) return { pdf: { bucket, path, name: file.name, size: file.size } };
    lastError = error.message;
    if (!/bucket not found/i.test(error.message)) break;
  }
  return {
    error: /bucket not found/i.test(lastError)
      ? "PDF depolama alanı bulunamadı (0014 migration'ı uygulanmalı)."
      : `PDF yüklenemedi: ${lastError}`,
  };
}

/** Best-effort removal of an uploaded file (e.g. when it's replaced). */
export function removeUserPdf(pdf: ArticlePdf) {
  void createClient().storage.from(pdf.bucket).remove([pdf.path]);
}
