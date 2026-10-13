"use client";

import { Icon } from "@/components/Icon";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_PDF_BYTES,
  PDF_BUCKETS,
  extractPdfMeta,
  formatBytes,
  pdfPathFor,
  type ArticlePdf,
} from "@/lib/articlePdf";
import { addOwnArticle } from "./actions";

const inputCls =
  "w-full rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500";

interface Fields {
  title: string;
  authors: string;
  journal: string;
  year: string;
  doi: string;
  topic: string;
  tags: string;
  abstract: string;
}

const EMPTY: Fields = {
  title: "",
  authors: "",
  journal: "",
  year: "",
  doi: "",
  topic: "",
  tags: "",
  abstract: "",
};

/**
 * Form for manually adding an article; DOI/PMID auto-fills the fields. An
 * optional PDF is uploaded straight from the browser to the user's private
 * storage folder, and a DOI/title found inside it pre-fills the form.
 */
export function AddArticleForm({ onAdded }: { onAdded?: () => void }) {
  const router = useRouter();
  const [f, setF] = useState<Fields>(EMPTY);
  const [pending, startTransition] = useTransition();
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchNote, setFetchNote] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pdf, setPdf] = useState<ArticlePdf | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfNote, setPdfNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof Fields>(key: K, value: string) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  // Fetch metadata from CrossRef/PubMed and auto-fill the fields.
  async function autofill(fromPdf?: string) {
    const input = (fromPdf ?? f.doi).trim();
    if (!input) {
      setError("Önce DOI veya PubMed kimliği yapıştır.");
      return;
    }
    setError(null);
    setFetchNote(null);
    setFetching(true);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, preview: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Bilgi alınamadı.");
      } else {
        const m = data.metadata;
        setF((prev) => ({
          ...prev,
          title: m.title ?? prev.title,
          authors: (m.authors ?? []).join(", ") || prev.authors,
          journal: m.journal ?? prev.journal,
          year: m.year ? String(m.year) : prev.year,
          doi: m.doi ?? prev.doi,
          abstract: m.abstract ?? prev.abstract,
        }));
        setFetchNote(
          fromPdf
            ? "PDF'teki DOI ile bilgiler dolduruldu — kontrol edip Kaydet'e bas."
            : "Bilgiler dolduruldu — kontrol edip Kaydet'e bas.",
        );
      }
    } catch {
      setError("Sunucuya ulaşılamadı.");
    } finally {
      setFetching(false);
    }
  }

  async function handlePdf(file: File) {
    setError(null);
    setPdfNote(null);
    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const magic = await file.slice(0, 5).text().catch(() => "");
    if (!isPdf || !magic.startsWith("%PDF")) {
      setError("Lütfen bir PDF dosyası seç.");
      return;
    }
    if (file.size > MAX_PDF_BYTES) {
      setError(`PDF çok büyük (${formatBytes(file.size)}). En fazla ${formatBytes(MAX_PDF_BYTES)} yüklenebilir.`);
      return;
    }

    setPdfBusy(true);
    const hadDoi = Boolean(f.doi.trim());
    const hadTitle = Boolean(f.title.trim());
    // Read the PDF's own metadata while it uploads.
    const metaPromise = extractPdfMeta(file).catch(() => ({}) as { doi?: string; title?: string });
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setError("Oturum bulunamadı; sayfayı yenileyip tekrar dene.");
        return;
      }

      let uploaded: ArticlePdf | null = null;
      let lastError = "";
      for (const bucket of PDF_BUCKETS) {
        const path = pdfPathFor(session.user.id, bucket);
        const { error: upErr } = await supabase.storage
          .from(bucket)
          .upload(path, file, { contentType: "application/pdf", upsert: false });
        if (!upErr) {
          uploaded = { bucket, path, name: file.name, size: file.size };
          break;
        }
        lastError = upErr.message;
        // Only fall back to the next bucket when this one doesn't exist.
        if (!/bucket not found/i.test(upErr.message)) break;
      }
      if (!uploaded) {
        setError(
          /bucket not found/i.test(lastError)
            ? "PDF depolama alanı bulunamadı (0014 migration'ı uygulanmalı)."
            : `PDF yüklenemedi: ${lastError}`,
        );
        return;
      }

      // Replacing a file: drop the previous upload.
      if (pdf) void supabase.storage.from(pdf.bucket).remove([pdf.path]);
      setPdf(uploaded);

      const meta = await metaPromise;
      if (meta.doi && !hadDoi) {
        setF((prev) => ({ ...prev, doi: meta.doi! }));
        await autofill(meta.doi);
      } else if (meta.title && !hadTitle) {
        setF((prev) => ({ ...prev, title: meta.title! }));
        setPdfNote("Başlık PDF'ten alındı; diğer bilgileri kontrol et.");
      } else if (!hadDoi && !hadTitle) {
        setPdfNote("PDF'te DOI bulunamadı; bilgileri elle gir ya da DOI yapıştır.");
      }
    } catch {
      setError("PDF yüklenirken bağlantı hatası oluştu. Tekrar dene.");
    } finally {
      setPdfBusy(false);
    }
  }

  function removePdf() {
    if (pdf) void createClient().storage.from(pdf.bucket).remove([pdf.path]);
    setPdf(null);
    setPdfNote(null);
  }

  function handleSubmit() {
    setError(null);
    setSuccess(false);
    if (!f.title.trim()) {
      setError("Makale başlığı zorunludur.");
      return;
    }
    const formData = new FormData();
    formData.set("title", f.title);
    formData.set("authors", f.authors);
    formData.set("journal", f.journal);
    formData.set("year", f.year);
    formData.set("doi", f.doi);
    formData.set("topic", f.topic);
    formData.set("tags", f.tags);
    formData.set("abstract", f.abstract);
    if (pdf) {
      formData.set("pdf_bucket", pdf.bucket);
      formData.set("pdf_path", pdf.path);
      formData.set("pdf_name", pdf.name);
      formData.set("pdf_size", String(pdf.size));
    }
    startTransition(async () => {
      const res = await addOwnArticle(formData);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(true);
        setF(EMPTY);
        // The file now belongs to the saved article.
        setPdf(null);
        setPdfNote(null);
        router.refresh();
        onAdded?.();
      }
    });
  }

  return (
    <div className="space-y-3">
      {/* DOI auto-fill row */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-400/5 p-3">
        <label className="mb-1.5 block text-xs font-bold italic text-amber-700 dark:text-amber-400">
          DOI / PubMed ile otomatik doldur
        </label>
        <div className="flex gap-2">
          <input
            value={f.doi}
            onChange={(e) => set("doi", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                autofill();
              }
            }}
            placeholder="10.1234/… , doi.org linki, PMID veya PubMed linki"
            className={inputCls}
          />
          <button
            type="button"
            onClick={() => autofill()}
            disabled={fetching}
            className="shrink-0 rounded-md bg-amber-500 px-4 py-2 text-xs font-bold text-stone-900 transition-colors hover:bg-amber-400 disabled:opacity-50"
          >
            {fetching ? "Getiriliyor…" : "Doldur"}
          </button>
        </div>
        {fetchNote && (
          <p className="mt-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <Icon name="check" strokeWidth={2.4} /> {fetchNote}
          </p>
        )}
      </div>

      {/* PDF upload */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] p-3">
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ""; // allow picking the same file again
            if (file) void handlePdf(file);
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={pdfBusy}
          className="btn-ghost shrink-0 rounded-full px-4 py-2 text-xs font-semibold disabled:opacity-50"
        >
          {pdfBusy ? (
            "Yükleniyor…"
          ) : (
            <>
              <Icon name="file" /> {pdf ? "PDF'i değiştir" : "PDF yükle"}
            </>
          )}
        </button>
        {pdf ? (
          <span className="flex min-w-0 items-center gap-2 text-xs">
            <span className="truncate font-medium" title={pdf.name}>
              {pdf.name}
            </span>
            <span className="shrink-0 text-stone-500">{formatBytes(pdf.size)} · yüklendi</span>
            <button
              type="button"
              onClick={removePdf}
              disabled={pdfBusy}
              className="shrink-0 rounded px-1.5 text-stone-500 hover:text-rose-500"
            >
              Kaldır
            </button>
          </span>
        ) : (
          !pdfBusy && (
            <span className="text-xs text-stone-500">
              Opsiyonel · en fazla {formatBytes(MAX_PDF_BYTES)} · DOI&apos;si varsa bilgiler otomatik dolar
            </span>
          )
        )}
        {pdfNote && <p className="w-full text-xs text-stone-500">{pdfNote}</p>}
      </div>

      <input
        value={f.title}
        onChange={(e) => set("title", e.target.value)}
        required
        placeholder="Makale başlığı *"
        className={inputCls}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          value={f.authors}
          onChange={(e) => set("authors", e.target.value)}
          placeholder="Yazarlar (virgülle ayır: Bompa T, Haff G)"
          className={inputCls}
        />
        <input
          value={f.journal}
          onChange={(e) => set("journal", e.target.value)}
          placeholder="Dergi"
          className={inputCls}
        />
        <input
          value={f.year}
          onChange={(e) => set("year", e.target.value)}
          type="number"
          min={1900}
          max={2100}
          placeholder="Yıl"
          className={inputCls}
        />
        <input
          value={f.topic}
          onChange={(e) => set("topic", e.target.value)}
          placeholder="Konu başlığı (örn. Kuvvet & Güç)"
          className={inputCls}
        />
      </div>
      <input
        value={f.tags}
        onChange={(e) => set("tags", e.target.value)}
        placeholder="Etiketler (virgülle ayır: hipertrofi, periodizasyon)"
        className={inputCls}
      />
      <textarea
        value={f.abstract}
        onChange={(e) => set("abstract", e.target.value)}
        rows={3}
        placeholder="Özet (opsiyonel)"
        className={inputCls}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={pending || pdfBusy}
          className="rounded-full bg-amber-400 px-5 py-2 text-xs font-bold text-stone-900 transition-colors hover:bg-amber-300 disabled:opacity-50"
        >
          {pending ? "Kaydediliyor…" : "Kaydet (Notlarım'a)"}
        </button>
        {error && (
          <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}
        {success && (
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <Icon name="check" strokeWidth={2.4} /> Eklendi — Notlarım sekmesinde.
          </p>
        )}
      </div>
    </div>
  );
}
