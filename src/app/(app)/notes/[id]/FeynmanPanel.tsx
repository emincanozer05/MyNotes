"use client";

import { useState } from "react";

const AUDIENCES = [
  { value: "athlete", label: "Sporcuya anlat" },
  { value: "assistant-coach", label: "Asistan antrenöre anlat" },
  { value: "social-media", label: "Sosyal medya içeriği yap" },
];

export function FeynmanPanel({ noteId }: { noteId: string }) {
  const [audience, setAudience] = useState("athlete");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/feynman", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteId, audience }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Bir hata oluştu.");
      else setResult(data.text);
    } catch {
      setError("Sunucuya ulaşılamadı.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-lg border border-stone-200 dark:border-stone-800 p-4">
      <h2 className="text-sm font-semibold">🎓 Feynman Modu — &quot;Bunu Birine Anlat&quot;</h2>
      <p className="mt-1 text-xs text-stone-500">
        Bu akademik notu yapay zekâ ile hedef kitleye göre sadeleştirin.
      </p>
      <div className="mt-3 flex gap-2">
        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          className="flex-1 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
        >
          {AUDIENCES.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
        >
          {loading ? "Yazıyor…" : "Anlat"}
        </button>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {result && (
        <div className="mt-3">
          <div className="whitespace-pre-wrap rounded-md bg-stone-50 dark:bg-stone-900 p-4 text-sm leading-relaxed">
            {result}
          </div>
          <button
            onClick={copy}
            className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-500 hover:underline"
          >
            {copied ? "Kopyalandı ✓" : "Panoya kopyala"}
          </button>
        </div>
      )}
    </div>
  );
}
