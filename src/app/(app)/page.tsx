import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const MODULES = [
  { title: "Literatür", detail: "DOI/PubMed yapıştır, makale otomatik kütüphanene eklensin", href: "/library" },
  { title: "Notlar", detail: "Kaynak referanslı notlar, [[bağlantılar]] ve #etiketler", href: "/notes" },
  { title: "Hesaplayıcılar", detail: "1RM, Kuvvet-Hız profili, Karvonen nabız bölgeleri", href: "/calculators" },
  { title: "Bilgi Grafiği", detail: "Not-etiket-kaynak ilişkilerinin etkileşimli haritası", href: "/graph" },
  { title: "Ses Notu", detail: "Sahada konuş, transkript otomatik nota dönüşsün", href: "/voice" },
  { title: "Bilgi Derinliği", detail: "Hangi konularda yüzeysel kaldığını gör", href: "/insights" },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [
    { count: articleCount },
    { count: noteCount },
    { count: highlightCount },
    { count: dueCount },
  ] = await Promise.all([
    supabase.from("sources").select("*", { count: "exact", head: true }).eq("kind", "article"),
    supabase.from("notes").select("*", { count: "exact", head: true }),
    supabase.from("highlights").select("*", { count: "exact", head: true }),
    supabase.from("flashcards").select("*", { count: "exact", head: true }).lte("due_at", nowIso),
  ]);

  const stats = [
    { label: "Makale", value: articleCount ?? 0, href: "/library" },
    { label: "Not", value: noteCount ?? 0, href: "/notes" },
    { label: "Alıntı", value: highlightCount ?? 0, href: "/highlights" },
    { label: "Tekrarı gelen kart", value: dueCount ?? 0, href: "/flashcards" },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Panel</h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Kütüphanenizin ve bilgi tabanınızın genel görünümü.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 p-4 hover:border-amber-400 transition-colors"
          >
            <p className="text-3xl font-bold">{s.value}</p>
            <p className="text-sm text-stone-500 dark:text-stone-400">{s.label}</p>
          </Link>
        ))}
      </div>

      {(dueCount ?? 0) > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 p-4">
          <p className="text-sm font-semibold">
            🔔 Bugün tekrarı gelen {dueCount} flashcard&apos;ınız var.
          </p>
          <Link
            href="/flashcards"
            className="mt-1 inline-block text-sm font-medium text-amber-700 dark:text-amber-400 hover:underline"
          >
            Çalışmaya başla →
          </Link>
        </div>
      )}

      <div>
        <h2 className="font-semibold">Modüller</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {MODULES.map((m) => (
            <Link
              key={m.title}
              href={m.href}
              className="rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 p-4 hover:border-amber-400 transition-colors"
            >
              <p className="font-medium">{m.title}</p>
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{m.detail}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
