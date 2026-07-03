import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const MODULES = [
  {
    title: "Literatür",
    detail: "DOI/PubMed yapıştır, makale otomatik kütüphanene eklensin",
    href: "/library",
    icon: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15zm0 0A2.5 2.5 0 0 0 6.5 22H20v-5",
  },
  {
    title: "Notlar",
    detail: "Kaynak referanslı notlar, [[bağlantılar]] ve #etiketler",
    href: "/notes",
    icon: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z",
  },
  {
    title: "Hesaplayıcılar",
    detail: "1RM, Kuvvet-Hız profili, Karvonen nabız bölgeleri",
    href: "/calculators",
    icon: "M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm2 4h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01",
  },
  {
    title: "Bilgi Grafiği",
    detail: "Not-etiket-kaynak ilişkilerinin etkileşimli haritası",
    href: "/graph",
    icon: "M9 6a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM4 19a3 3 0 1 0 6 0 3 3 0 0 0-6 0zm10 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM10.5 8.5L7.8 16m5.7-7.5l2.7 7.5",
  },
  {
    title: "Ses Notu",
    detail: "Sahada konuş, transkript otomatik nota dönüşsün",
    href: "/voice",
    icon: "M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3zm7 9a7 7 0 0 1-14 0m7 7v3m-4 0h8",
  },
  {
    title: "Bilgi Derinliği",
    detail: "Hangi konularda yüzeysel kaldığını gör",
    href: "/insights",
    icon: "M12 22a10 10 0 1 1 10-10M12 6v6l4 2m6-10v6h-6",
  },
];

const STAT_STYLES = [
  "from-amber-500/15 to-orange-500/10 text-amber-600 dark:text-amber-400",
  "from-sky-500/15 to-blue-500/10 text-sky-600 dark:text-sky-400",
  "from-emerald-500/15 to-teal-500/10 text-emerald-600 dark:text-emerald-400",
  "from-violet-500/15 to-purple-500/10 text-violet-600 dark:text-violet-400",
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
    <div className="mx-auto max-w-4xl space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Panel
          <span className="ml-2 inline-block h-2 w-2 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 align-middle" />
        </h1>
        <p className="mt-1.5 text-sm text-stone-500 dark:text-stone-400">
          Kütüphanenizin ve bilgi tabanınızın genel görünümü.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s, i) => (
          <Link key={s.label} href={s.href} className="card card-link group p-5">
            <span
              className={`inline-block rounded-lg bg-gradient-to-br px-2 py-0.5 text-xs font-semibold ${STAT_STYLES[i]}`}
            >
              {s.label}
            </span>
            <p className="mt-3 text-4xl font-bold tabular-nums tracking-tight transition-colors group-hover:text-amber-700 dark:group-hover:text-amber-400">
              {s.value}
            </p>
          </Link>
        ))}
      </div>

      {(dueCount ?? 0) > 0 && (
        <div className="relative overflow-hidden rounded-xl border border-amber-200 dark:border-amber-900 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950 dark:to-stone-950 p-5">
          <div
            aria-hidden
            className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-400/20 blur-2xl"
          />
          <p className="text-sm font-semibold">
            🔔 Bugün tekrarı gelen {dueCount} flashcard&apos;ınız var.
          </p>
          <Link
            href="/flashcards"
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-400 transition-all hover:gap-2"
          >
            Çalışmaya başla <span aria-hidden>→</span>
          </Link>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold tracking-tight">Modüller</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {MODULES.map((m) => (
            <Link key={m.title} href={m.href} className="card card-link group p-5">
              <div className="flex items-start gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/15 to-orange-500/10 text-amber-600 dark:text-amber-400 transition-transform duration-300 group-hover:scale-110">
                  <svg
                    aria-hidden
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-5 w-5"
                  >
                    <path d={m.icon} />
                  </svg>
                </span>
                <div className="min-w-0">
                  <p className="font-semibold">
                    {m.title}
                    <span
                      aria-hidden
                      className="ml-1.5 inline-block text-amber-600 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100 dark:text-amber-400"
                    >
                      →
                    </span>
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-stone-500 dark:text-stone-400">
                    {m.detail}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
