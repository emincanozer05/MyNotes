import { Icon } from "@/components/Icon";
import { PageHeader } from "@/components/PageHeader";
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

  const [sources, notes, tags] = await Promise.all([
    countOf(supabase, "sources"),
    countOf(supabase, "notes"),
    countOf(supabase, "tags"),
  ]);

  const stats = [
    { label: "Kaynak", value: sources },
    { label: "Not", value: notes },
    { label: "Etiket", value: tags },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Yedekleme"
        description={
          <>
            Tüm verilerin Supabase&apos;te güvenle saklanır. Ekstra güvence için
            buradan dosya olarak yedek al; gerekirse geri yükle.
          </>
        }
      />

      <div className="item-table grid grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="border-[var(--border)] px-4 py-3 [&:not(:first-child)]:border-l"
          >
            <p className="text-lg font-semibold tabular-nums">{s.value}</p>
            <p className="text-xs text-[var(--muted)]">{s.label}</p>
          </div>
        ))}
      </div>

      <BackupPanel />

      <p className="rounded-lg border border-[var(--border)] p-3 text-xs text-[var(--muted)]">
        <Icon name="lightbulb" className="h-4 w-4 text-amber-500" /> İpucu: Önemli çalışmalardan sonra düzenli olarak yedek indir. Yedek
        dosyası; makale, kitap, not ve etiket verilerini içerir.
      </p>
    </div>
  );
}
