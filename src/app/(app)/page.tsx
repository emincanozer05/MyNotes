import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { extractTaggedPassages } from "@/lib/wiki";
import { Icon, type IconName } from "@/components/Icon";
import { PageHeader } from "@/components/PageHeader";

const MODULES: { title: string; detail: string; href: string; icon: IconName }[] = [
  { title: "Literatür", detail: "Günlük PubMed akışı, kaydettiğin makaleler ve özetlerin", href: "/library", icon: "newspaper" },
  { title: "Post-it Notlar", detail: "Kategorilere ayrılmış notlar ve etiketlediğin pasajlar", href: "/notes", icon: "sticky-note" },
  { title: "Kitap Rafı", detail: "Kapaklı dijital kütüphane ve zengin metin özetleri", href: "/bookshelf", icon: "library" },
  { title: "Ne, nedir?", detail: "Kavram ve ifadelerin kısa tanımları", href: "/glossary", icon: "help" },
  { title: "Kurslar ve Eğitimler", detail: "S&C kursların, ilerleme durumu ve notların", href: "/courses", icon: "graduation" },
  { title: "Not Defterim", detail: "Kategorilere ayrılmış kişisel notların", href: "/notebook", icon: "notebook" },
  { title: "Network Haritası", detail: "Kişisel ve profesyonel ağını interaktif grafikte yönet", href: "/network", icon: "network" },
  { title: "Kariyer Yol Haritası", detail: "Kariyer hedeflerin, gelişim alanların ve görevlerin", href: "/career", icon: "tree" },
];

export default async function DashboardPage() {
  const supabase = await createClient();

  const [
    { count: articleCount },
    { count: courseCount },
    { count: noteCount },
    { count: bookCount },
    boardRes,
    { count: contactCount },
  ] = await Promise.all([
    supabase.from("sources").select("*", { count: "exact", head: true }).eq("kind", "article"),
    supabase
      .from("sources")
      .select("*", { count: "exact", head: true })
      .eq("kind", "other")
      .contains("metadata", { category: "course" }),
    supabase.from("notes").select("*", { count: "exact", head: true }),
    supabase.from("sources").select("*", { count: "exact", head: true }).eq("kind", "book"),
    // board_sources() (migration 0009) returns the rich-text fields with
    // <img> tags stripped in the database, so embedded base64 images never
    // cross the network just to count highlighted passages.
    supabase.rpc("board_sources"),
    // Network Haritası (migration 0012); count is null without the table.
    supabase.from("contacts").select("*", { count: "exact", head: true }),
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

  // Item counts shown in the module list (modules without one show nothing).
  const counts: Record<string, { value: number; label: string }> = {
    "/library": { value: articleCount ?? 0, label: "makale" },
    "/notes": { value: postitCount, label: "post-it" },
    "/bookshelf": { value: bookCount ?? 0, label: "kitap" },
    "/courses": { value: courseCount ?? 0, label: "kurs" },
    "/network": { value: contactCount ?? 0, label: "kişi" },
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Panel"
        description="Kütüphanenizin ve bilgi tabanınızın genel görünümü."
      />

      <ul className="item-table">
        {MODULES.map((m) => {
          const c = counts[m.href];
          return (
            <li key={m.href} className="item-row">
              <Link href={m.href} className="group flex items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--surface-2)] text-[var(--muted)] group-hover:text-[var(--accent-text)]">
                  <Icon name={m.icon} className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{m.title}</span>
                  <span className="block truncate text-xs text-[var(--muted)]">
                    {m.detail}
                  </span>
                </span>
                {c && (
                  <span className="shrink-0 text-right text-xs text-[var(--muted)]">
                    <span className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                      {c.value}
                    </span>{" "}
                    {c.label}
                  </span>
                )}
                <Icon
                  name="arrow-right"
                  className="h-4 w-4 shrink-0 text-[var(--muted)] opacity-0 transition-opacity group-hover:opacity-100"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
