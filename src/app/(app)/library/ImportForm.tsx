"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ImportForm() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Bir hata oluştu.");
      } else {
        setSuccess(`Eklendi: ${data.source.title}`);
        setInput("");
        router.refresh();
      }
    } catch {
      setError("Sunucuya ulaşılamadı.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="DOI (10.1234/…), doi.org linki, PMID veya PubMed linki yapıştırın"
          required
          className="flex-1 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
        />
        <button
          disabled={loading}
          className="btn-primary disabled:opacity-50"
        >
          {loading ? "Getiriliyor…" : "İçe Aktar"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {success && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">{success}</p>
      )}
    </form>
  );
}
