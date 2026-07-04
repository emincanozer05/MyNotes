"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addOwnArticle } from "./actions";

const inputCls =
  "w-full rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-lime-500";

interface Fields {
  title: string;
  authors: string;
  journal: string;
  year: string;
  doi: string;
  topic: string;
  abstract: string;
}

const EMPTY: Fields = {
  title: "",
  authors: "",
  journal: "",
  year: "",
  doi: "",
  topic: "",
  abstract: "",
};

/** Form for manually adding an article; DOI/PMID auto-fills the fields. */
export function AddArticleForm({ onAdded }: { onAdded?: () => void }) {
  const router = useRouter();
  const [f, setF] = useState<Fields>(EMPTY);
  const [pending, startTransition] = useTransition();
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchNote, setFetchNote] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function set<K extends keyof Fields>(key: K, value: string) {
    setF((prev) => ({ ...prev, [key]: value }));
  }

  // Fetch metadata from CrossRef/PubMed and auto-fill the fields.
  async function autofill() {
    const input = f.doi.trim();
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
        setFetchNote("Bilgiler dolduruldu — kontrol edip Kaydet'e bas.");
      }
    } catch {
      setError("Sunucuya ulaşılamadı.");
    } finally {
      setFetching(false);
    }
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
    formData.set("abstract", f.abstract);
    startTransition(async () => {
      const res = await addOwnArticle(formData);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(true);
        setF(EMPTY);
        router.refresh();
        onAdded?.();
      }
    });
  }

  return (
    <div className="space-y-3">
      {/* DOI auto-fill row */}
      <div className="rounded-xl border border-lime-500/30 bg-lime-400/5 p-3">
        <label className="mb-1.5 block text-xs font-bold italic text-lime-700 dark:text-lime-400">
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
            onClick={autofill}
            disabled={fetching}
            className="shrink-0 rounded-md bg-lime-500 px-4 py-2 text-xs font-bold text-stone-900 transition-colors hover:bg-lime-400 disabled:opacity-50"
          >
            {fetching ? "Getiriliyor…" : "Doldur"}
          </button>
        </div>
        {fetchNote && (
          <p className="mt-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            ✓ {fetchNote}
          </p>
        )}
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
          disabled={pending}
          className="rounded-full bg-lime-400 px-5 py-2 text-xs font-bold text-stone-900 transition-colors hover:bg-lime-300 disabled:opacity-50"
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
            ✓ Eklendi — Notlarım sekmesinde.
          </p>
        )}
      </div>
    </div>
  );
}
