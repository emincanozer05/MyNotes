import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { extractTaggedPassages } from "@/lib/wiki";

const MODULES = [
  { title: "Literatür", detail: "RCT makalelerini getir, konu başlığına göre kütüphaneni oluştur", href: "/library", grad: "from-rose-500 to-orange-500", icon: "❧" },
  { title: "Post-it Notlar", detail: "Spor, Tarih, Bilim ve Felsefe kategorilerinde renkli post-it'ler", href: "/notes", grad: "from-amber-500 to-yellow-500", icon: "✎" },
  { title: "Kitap Rafı", detail: "Kategorilere ayrılmış kapaklı dijital kütüphane, zengin metin özetleri", href: "/bookshelf", grad: "from-emerald-500 to-teal-500", icon: "▥" },
  { title: "Bilgi Derinliği", detail: "Hangi konularda yüzeysel kaldığını gör", href: "/insights", grad: "from-indigo-500 to-blue-500", icon: "◔" },
];

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { count: articleCount },
    { count: courseCount },
    { count: noteCount },
    { count: bookCount },
    boardRes,
  ] = await Promise.all([
    supabase.from("sources").select("*", { count: "exact", head: true }).eq("kind", "article"),
    supabase.from("sources").select("*", { count: "exact", head: true }).eq("kind", "other"),
    supabase.from("notes").select("*", { count: "exact", head: true }),
    supabase.from("sources").select("*", { count: "exact", head: true }).eq("kind", "book"),
    // board_sources() (migration 0009) returns the rich-text fields with
    // <img> tags stripped in the database, so embedded base64 images never
    // cross the network just to count highlighted passages.
    supabase.rpc("board_sources"),
  ]);

  // Fallback for a DB without the 0009 migration: raw metadata (heavier).
  const sourceMetas = boardRes.error
    ? (await supabase.from("sources").select("metadata")).data
    : boardRes.data;

  // The notes board shows tagged passages (highlights inside article summaries
  // and book/course notes) as post-its too, so the panel counts them together
  // with the notes — the total across every category matches the board.
  const passageCount = (
    (sourceMetas ?? []) as {
      metadata: { summary?: string; notes?: { html: string }[] } | null;
    }[]
  ).reduce(
    (sum, s) =>
      sum +
      extractTaggedPassages(s.metadata?.summary).length +
      (s.metadata?.notes ?? []).reduce(
        (n, tn) => n + extractTaggedPassages(tn.html).length,
        0,
      ),
    0,
  );
  const postitCount = (noteCount ?? 0) + passageCount;

  const stats = [
    { label: "Makale", value: articleCount ?? 0, href: "/library", grad: "from-rose-500 to-orange-500" },
    { label: "Kurs", value: courseCount ?? 0, href: "/courses", grad: "from-amber-500 to-yellow-500" },
    { label: "Post-it", value: postitCount, href: "/notes", grad: "from-violet-500 to-fuchsia-500" },
    { label: "Kitap", value: bookCount ?? 0, href: "/bookshelf", grad: "from-emerald-500 to-teal-500" },
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
            className="glass-card card-lift group relative overflow-hidden rounded-2xl p-5"
          >
            {/* Hairline of the stat's own colour along the top edge */}
            <span
              aria-hidden
              className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${s.grad}`}
            />
            <p className={`bg-gradient-to-br ${s.grad} bg-clip-text text-4xl font-black text-transparent`}>
              {s.value}
            </p>
            <p className="mt-1 text-sm font-medium text-[var(--muted)]">
              {s.label}
            </p>
          </Link>
        ))}
      </div>

      <div>
        <h2 className="section-rule text-lg font-bold">Modüller</h2>
        <div className="stagger mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <Link
              key={m.title}
              href={m.href}
              className="glass-card card-lift group flex flex-col rounded-2xl p-5"
            >
              <span
                className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${m.grad} text-lg text-white shadow-[var(--shadow-1)]`}
              >
                {m.icon}
              </span>
              <p className="mt-3 flex items-center gap-1.5 font-bold">
                {m.title}
                <span
                  aria-hidden
                  className="translate-x-0 text-[var(--muted)] opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
                >
                  →
                </span>
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">{m.detail}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
