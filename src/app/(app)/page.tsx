import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const UPCOMING = [
  { title: "Not Sistemi", detail: "Kaynak referansı, highlight, Zettelkasten bağlantıları, etiketler", phase: "Aşama 2" },
  { title: "Hesaplayıcılar", detail: "1RM (Epley/Brzycki), Kuvvet-Hız profili, Karvonen nabız bölgeleri", phase: "Aşama 3" },
  { title: "Bilgi Grafiği & Flashcard", detail: "Etkileşimli kavram haritası ve SM-2 aralıklı tekrar", phase: "Aşama 4" },
  { title: "Feynman Modu & Saha Araçları", detail: "AI sadeleştirme, kitap rafı, ses notu transkripti, bilgi derinliği", phase: "Aşama 5" },
];

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ count: articleCount }, { count: noteCount }, { count: highlightCount }] =
    await Promise.all([
      supabase.from("sources").select("*", { count: "exact", head: true }).eq("kind", "article"),
      supabase.from("notes").select("*", { count: "exact", head: true }),
      supabase.from("highlights").select("*", { count: "exact", head: true }),
    ]);

  const stats = [
    { label: "Makale", value: articleCount ?? 0, href: "/library" },
    { label: "Not", value: noteCount ?? 0, href: "/notes" },
    { label: "Alıntı", value: highlightCount ?? 0, href: "/highlights" },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Panel</h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Kütüphanenizin ve bilgi tabanınızın genel görünümü.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
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

      <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 p-5">
        <h2 className="font-semibold">Hızlı başlangıç</h2>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Bir makalenin DOI numarasını veya PubMed linkini yapıştırarak
          kütüphanenizi oluşturmaya başlayın.
        </p>
        <Link
          href="/library"
          className="mt-3 inline-block rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
        >
          Literatüre git →
        </Link>
      </div>

      <div>
        <h2 className="font-semibold">Yol haritası</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {UPCOMING.map((m) => (
            <div
              key={m.title}
              className="rounded-lg border border-dashed border-stone-300 dark:border-stone-700 p-4"
            >
              <p className="text-xs font-medium text-amber-600">{m.phase}</p>
              <p className="mt-0.5 font-medium">{m.title}</p>
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{m.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
