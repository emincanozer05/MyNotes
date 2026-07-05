import { createClient } from "@/lib/supabase/server";
import { BackupPanel } from "./BackupPanel";

async function countOf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: string,
) {
  const { count } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  return count ?? 0;
}

export default async function BackupPage() {
  const supabase = await createClient();

  const [sources, notes, tags, flashcards, voice] = await Promise.all([
    countOf(supabase, "sources"),
    countOf(supabase, "notes"),
    countOf(supabase, "tags"),
    countOf(supabase, "flashcards"),
    countOf(supabase, "voice_notes"),
  ]);

  const stats = [
    { label: "Kaynak", value: sources },
    { label: "Not", value: notes },
    { label: "Etiket", value: tags },
    { label: "Flashcard", value: flashcards },
    { label: "Ses notu", value: voice },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-4xl font-extrabold tracking-tight">
          <span className="gradient-text">Yedekleme</span>
        </h1>
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
          Tüm verilerin Supabase&apos;te güvenle saklanır. Ekstra güvence için
          buradan dosya olarak yedek al; gerekirse geri yükle.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="glass-card rounded-xl p-4 text-center"
          >
            <p className="text-2xl font-black">{s.value}</p>
            <p className="mt-0.5 text-xs text-stone-500">{s.label}</p>
          </div>
        ))}
      </div>

      <BackupPanel />

      <p className="rounded-xl border border-[var(--border)] p-4 text-xs text-stone-500">
        💡 İpucu: Önemli çalışmalardan sonra düzenli olarak yedek indir. Yedek
        dosyası; makale, kitap, not, etiket ve flashcard verilerini
        içerir. Ses <b>kayıtlarının</b> ses dosyaları depoda tutulur; yedek JSON
        yalnızca başlık ve transkript bilgisini taşır.
      </p>
    </div>
  );
}
