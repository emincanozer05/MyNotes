"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { formatBytes, type ArticlePdf } from "@/lib/articlePdf";
import { removeUserPdf, uploadUserPdf, validatePdfFile } from "@/lib/uploadPdf";
import { setNotebookEntryPdf } from "../actions";

/**
 * Attach / replace / remove the PDF of a notebook page; opening it goes to
 * the in-app reader (`/notebook/[id]/pdf`) shared with Literatür.
 */
export function EntryPdfField({
  entryId,
  pdf: initialPdf,
}: {
  entryId: string;
  pdf: ArticlePdf | null;
}) {
  const router = useRouter();
  const [pdf, setPdf] = useState(initialPdf);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setError(null);
    const invalid = await validatePdfFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setBusy("upload");
    try {
      const res = await uploadUserPdf(file);
      if (!res.pdf) {
        setError(res.error);
        return;
      }
      const saved = await setNotebookEntryPdf(entryId, res.pdf);
      if (saved.error) {
        removeUserPdf(res.pdf);
        setError(saved.error);
        return;
      }
      setPdf(res.pdf);
      router.refresh();
    } catch {
      setError("PDF yüklenirken bağlantı hatası oluştu. Tekrar dene.");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!window.confirm("PDF bu nottan kaldırılsın mı?")) return;
    setError(null);
    setBusy("remove");
    try {
      const res = await setNotebookEntryPdf(entryId, null);
      if (res.error) {
        setError(res.error);
        return;
      }
      setPdf(null);
      router.refresh();
    } catch {
      setError("PDF kaldırılamadı.");
    } finally {
      setBusy(null);
    }
  }

  const ghostBtn =
    "inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] disabled:opacity-60";

  return (
    <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2" data-no-explain>
      <span className="shrink-0 font-semibold uppercase tracking-wide">PDF</span>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />

      {pdf ? (
        <>
          <Link
            href={`/notebook/${entryId}/pdf`}
            title="PDF'i aç: vurgula, post-it olarak kaydet"
            className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md bg-[var(--surface-2)] px-2 py-1 font-medium text-[var(--foreground)] hover:text-amber-600"
          >
            <Icon name="file-text" className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{pdf.name}</span>
            {pdf.size > 0 && (
              <span className="shrink-0 font-normal text-[var(--muted)]">
                {formatBytes(pdf.size)}
              </span>
            )}
          </Link>
          <Link
            href={`/notebook/${entryId}/pdf`}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-2.5 py-1 font-semibold text-white hover:bg-amber-700"
          >
            <Icon name="highlighter" className="h-3.5 w-3.5" />
            Oku ve not al
          </Link>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy !== null}
            className={ghostBtn}
          >
            <Icon name="upload" className="h-3.5 w-3.5" />
            {busy === "upload" ? "Yükleniyor…" : "Değiştir"}
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={busy !== null}
            className={`${ghostBtn} hover:text-rose-600`}
          >
            <Icon name="trash" className="h-3.5 w-3.5" />
            {busy === "remove" ? "Kaldırılıyor…" : "Kaldır"}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy !== null}
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-[var(--border-strong)] px-2.5 py-1 font-medium text-[var(--foreground)] hover:border-amber-500 hover:text-amber-600 disabled:opacity-60"
        >
          <Icon name="upload" className="h-3.5 w-3.5" />
          {busy === "upload" ? "Yükleniyor…" : "PDF ekle"}
        </button>
      )}

      {error && <span className="text-rose-600 dark:text-rose-400">{error}</span>}
    </div>
  );
}
