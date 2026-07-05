"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const TABLE_LABELS: Record<string, string> = {
  sources: "Kaynaklar (makale/kitap)",
  notes: "Notlar",
  tags: "Etiketler",
  note_tags: "Not-etiket bağları",
  note_links: "Not bağlantıları",
  tag_highlights: "Etiketlenmiş metinler",
  flashcards: "Flashcard'lar",
  voice_notes: "Ses notları",
};

export function BackupPanel() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<Record<string, string | number> | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      setError("Dosya okunamadı — geçerli bir yedek (.json) dosyası seçin.");
      return;
    }
    const data = parsed as { app?: string; tables?: unknown };
    if (data?.app !== "sc-hub" || !data?.tables) {
      setError("Bu dosya bir S&C Hub yedeği değil.");
      return;
    }
    if (
      !window.confirm(
        "Yedekteki kayıtlar hesabına geri yüklenecek (aynı kimlikli kayıtların üzerine yazılır). Devam edilsin mi?",
      )
    ) {
      return;
    }

    setImporting(true);
    try {
      const res = await fetch("/api/backup/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Geri yükleme başarısız.");
      } else {
        setResult(json.result);
        router.refresh();
      }
    } catch {
      setError("Sunucuya ulaşılamadı.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Export */}
      <section className="glass-card rounded-2xl p-5">
        <h2 className="text-lg font-bold">Yedeği indir</h2>
        <p className="mt-1 text-sm text-stone-500">
          Tüm verilerini (makaleler, notlar, etiketler, alıntılar,
          flashcard&apos;lar, ses notu bilgileri) tek bir <code>.json</code>{" "}
          dosyası olarak indir.
          Dosyayı güvenli bir yerde sakla.
        </p>
        <a
          href="/api/backup/export"
          className="btn-gradient mt-4 inline-block rounded-full px-5 py-2.5 text-sm font-semibold"
        >
          ⬇ Yedeği indir (.json)
        </a>
      </section>

      {/* Import */}
      <section className="glass-card rounded-2xl p-5">
        <h2 className="text-lg font-bold">Yedekten geri yükle</h2>
        <p className="mt-1 text-sm text-stone-500">
          Daha önce indirdiğin bir yedek dosyasını seç; kayıtlar hesabına geri
          yüklenir. Aynı kimlikli kayıtlar güncellenir, eksik olanlar geri gelir
          (mevcut verilerin silinmez).
        </p>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className="mt-4 rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-stone-500/10 disabled:opacity-60"
        >
          {importing ? "Geri yükleniyor…" : "⬆ Yedek dosyası seç"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />

        {error && (
          <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
            {error}
          </p>
        )}

        {result && (
          <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
            <p className="font-semibold text-emerald-700 dark:text-emerald-400">
              ✓ Geri yükleme tamamlandı
            </p>
            <ul className="mt-2 space-y-0.5 text-xs text-stone-600 dark:text-stone-400">
              {Object.entries(result).map(([table, n]) => (
                <li key={table}>
                  {TABLE_LABELS[table] ?? table}:{" "}
                  <span className="font-medium">
                    {typeof n === "number" ? `${n} kayıt` : n}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
