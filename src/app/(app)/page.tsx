import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const MODULES = [
  { title: "Literatür", detail: "RCT makalelerini getir, konu başlığına göre kütüphaneni oluştur", href: "/library", grad: "from-rose-500 to-orange-500", icon: "❧" },
  { title: "Post-it Notlar", detail: "Renkli post-it'ler, [[bağlantılar]] ve #etiketler", href: "/notes", grad: "from-amber-500 to-yellow-500", icon: "✎" },
  { title: "Bilgi Grafiği", detail: "Not-etiket-kaynak ilişkilerinin etkileşimli haritası", href: "/graph", grad: "from-violet-500 to-fuchsia-500", icon: "⌘" },
  { title: "Ses Notu", detail: "Sahada konuş, transkript otomatik nota dönüşsün", href: "/voice", grad: "from-cyan-500 to-sky-500", icon: "♪" },
  { title: "Kitap Rafı", detail: "Kapaklı dijital kütüphane, zengin metin özetleri", href: "/bookshelf", grad: "from-emerald-500 to-teal-500", icon: "▥" },
  { title: "Bilgi Derinliği", detail: "Hangi konularda yüzeysel kaldığını gör", href: "/insights", grad: "from-indigo-500 to-blue-500", icon: "◔" },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [
    { count: articleCount },
    { count: noteCount },
    { count: tagCount },
    { count: dueCount },
  ] = await Promise.all([
    supabase.from("sources").select("*", { count: "exact", head: true }).eq("kind", "article"),
    supabase.from("notes").select("*", { count: "exact", head: true }),
    supabase.from("tags").select("*", { count: "exact", head: true }),
    supabase.from("flashcards").select("*", { count: "exact", head: true }).lte("due_at", nowIso),
  ]);

  const stats = [
    { label: "Makale", value: articleCount ?? 0, href: "/library", grad: "from-rose-500 to-orange-500" },
    { label: "Not", value: noteCount ?? 0, href: "/notes", grad: "from-amber-500 to-yellow-500" },
    { label: "Etiket", value: tagCount ?? 0, href: "/notes", grad: "from-violet-500 to-fuchsia-500" },
    { label: "Tekrarı gelen kart", value: dueCount ?? 0, href: "/flashcards", grad: "from-cyan-500 to-sky-500" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <div className="animate-in">
        <h1 className="text-4xl font-extrabold tracking-tight">
          <span className="gradient-text">Panel</span>
        </h1>
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
          Kütüphanenizin ve bilgi tabanınızın genel görünümü.
        </p>
      </div>

      <div className="stagger grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="glass-card group relative overflow-hidden rounded-2xl p-5"
          >
            <p className={`bg-gradient-to-br ${s.grad} bg-clip-text text-4xl font-black text-transparent`}>
              {s.value}
            </p>
            <p className="mt-1 text-sm font-medium text-stone-500 dark:text-stone-400">
              {s.label}
            </p>
          </Link>
        ))}
      </div>

      {(dueCount ?? 0) > 0 && (
        <div className="animate-in overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-500/10 to-rose-500/10 p-5">
          <p className="text-sm font-semibold">
            🔔 Bugün tekrarı gelen {dueCount} flashcard&apos;ınız var.
          </p>
          <Link
            href="/flashcards"
            className="mt-1 inline-block text-sm font-semibold text-amber-700 dark:text-amber-400 hover:underline"
          >
            Çalışmaya başla →
          </Link>
        </div>
      )}

      <div>
        <h2 className="text-lg font-bold">Modüller</h2>
        <div className="stagger mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <Link
              key={m.title}
              href={m.href}
              className="glass-card group rounded-2xl p-5"
            >
              <span
                className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${m.grad} text-lg text-white`}
              >
                {m.icon}
              </span>
              <p className="mt-3 font-bold">{m.title}</p>
              <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                {m.detail}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
