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
  abstract: string;
  topic: string;
}

const EMPTY: Fields = {
  title: "",
  authors: "",
  journal: "",
  year: "",
  doi: "",
  abstract: "",
  topic: "",
};

/**
 * Add-your-own-article flow: paste a DOI/PMID, the fields auto-fill from the
 * metadata lookup, then "Kaydet" persists it. Saved articles land in the
 * "Not Aldıklarım" tab (my notes), not the curated "Kaydedilenler" list.
 */
export function AddArticleForm({ onAdded }: { onAdded?: () => void }) {
  const router = useRouter();
  const [doiInput, setDoiInput] = useState("");
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filled, setFilled] = useState(false);
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof Fields>(key: K, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  async function handleFetch() {
    const input = doiInput.trim();
    if (!input) return;
    setFetching(true);
    setFetchError(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, preview: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFetchError(data.error ?? "Makale bilgisi alınamadı.");
      } else {
        const m = data.metadata as {
          title: string;
          authors: string[];
          journal: string | null;
          year: number | null;
          doi: string | null;
          abstract: string | null;
        };
        setFields({
          title: m.title ?? "",
          authors: (m.authors ?? []).join(", "),
          journal: m.journal ?? "",
          year: m.year ? String(m.year) : "",
          doi: m.doi ?? input,
          abstract: m.abstract ?? "",
          topic: "",
        });
        setFilled(true);
      }
    } catch {
      setFetchError("Sunucuya ulaşılamadı.");
    } finally {
      setFetching(false);
    }
  }

  function handleSave() {
    setError(null);
    const fd = new FormData();
    fd.set("title", fields.title);
    fd.set("authors", fields.authors);
    fd.set("journal", fields.journal);
    fd.set("year", fields.year);
    fd.set("doi", fields.doi);
    fd.set("abstract", fields.abstract);
    fd.set("topic", fields.topic);
    startSaving(async () => {
      const res = await addOwnArticle(fd);
      if (res.error) {
        setError(res.error);
      } else {
        // Straight into the article's summary editor (like a book summary).
        router.refresh();
        onAdded?.();
        if (res.id) router.push(`/library/${res.id}`);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Step 1 — DOI lookup */}
      <div>
        <label className="mb-1 block text-xs font-semibold text-stone-500">
          DOI / PubMed kimliği yapıştır → bilgiler otomatik dolsun
        </label>
        <div className="flex gap-2">
          <input
            value={doiInput}
            onChange={(e) => setDoiInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleFetch();
              }
            }}
            placeholder="10.1234/… , doi.org linki, PMID veya PubMed linki"
            className={inputCls}
          />
          <button
            type="button"
            onClick={handleFetch}
            disabled={fetching || !doiInput.trim()}
            className="shrink-0 rounded-full bg-lime-400 px-4 py-2 text-xs font-bold text-stone-900 transition-colors hover:bg-lime-300 disabled:opacity-50"
          >
            {fetching ? "Getiriliyor…" : "Getir"}
          </button>
        </div>
        {fetchError && (
          <p className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
            {fetchError}
          </p>
        )}
      </div>

      {/* Step 2 — review / edit auto-filled fields, then save */}
      {(filled || fields.title) && (
        <div className="animate-in space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <input
            value={fields.title}
            onChange={(e) => setField("title", e.target.value)}
            placeholder="Makale başlığı *"
            className={inputCls}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              value={fields.authors}
              onChange={(e) => setField("authors", e.target.value)}
              placeholder="Yazarlar (virgülle)"
              className={inputCls}
            />
            <input
              value={fields.journal}
              onChange={(e) => setField("journal", e.target.value)}
              placeholder="Dergi"
              className={inputCls}
            />
            <input
              value={fields.year}
              onChange={(e) => setField("year", e.target.value)}
              type="number"
              placeholder="Yıl"
              className={inputCls}
            />
            <input
              value={fields.doi}
              onChange={(e) => setField("doi", e.target.value)}
              placeholder="DOI"
              className={inputCls}
            />
          </div>
          <input
            value={fields.topic}
            onChange={(e) => setField("topic", e.target.value)}
            placeholder="Konu başlığı (örn. Kuvvet & Güç) — boşsa 'Diğer'"
            className={inputCls}
          />
          <textarea
            value={fields.abstract}
            onChange={(e) => setField("abstract", e.target.value)}
            rows={3}
            placeholder="Özet"
            className={inputCls}
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !fields.title.trim()}
              className="rounded-full bg-lime-400 px-5 py-2 text-xs font-bold text-stone-900 transition-colors hover:bg-lime-300 disabled:opacity-50"
            >
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </button>
            <span className="text-xs text-stone-500">
              Kaydet dedikten sonra makale özeti sayfasına gideceksin.
            </span>
          </div>
          {error && (
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
