"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Panel", icon: "◈" },
  { href: "/library", label: "Literatür", icon: "☰" },
  { href: "/notes", label: "Post-it Notlar", icon: "✎" },
  { href: "/bookshelf", label: "Kitap Rafı", icon: "▥" },
  { href: "/courses", label: "Kurslar ve Eğitimler (S&C)", icon: "❖" },
  { href: "/insights", label: "Bilgi Derinliği", icon: "◔" },
  { href: "/backup", label: "Yedekleme", icon: "⤓" },
];

export function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <aside className="no-print flex w-56 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
      <div className="px-4 py-5">
        <Link
          href="/"
          className="group flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-90"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-rose-500 text-sm font-black text-white shadow-[var(--shadow-1)]">
            N
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-lg font-extrabold tracking-tight gradient-text">
              NoteFlow
            </span>
            <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              S&amp;C Hub
            </span>
          </span>
        </Link>
      </div>
      <nav className="flex-1 space-y-0.5 px-2">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              // These tabs are dynamic routes (Supabase queries per request), so
              // the default prefetch only warms the loading skeleton and the real
              // content still waits for a server round-trip on click. `prefetch`
              // fetches the full route data ahead of time; combined with the 30s
              // client router cache (next.config staleTimes.dynamic) tab switches
              // land on real content instantly. The Sidebar lives in the persistent
              // app layout, so this prefetch happens once per link, not per nav.
              prefetch
              aria-current={active ? "page" : undefined}
              className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                active
                  ? "bg-[var(--surface-2)] font-bold text-[var(--foreground)]"
                  : "font-bold text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
              }`}
            >
              {/* Accent rail marks the active section at a glance */}
              <span
                aria-hidden
                className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[var(--brand-1)] transition-opacity ${
                  active ? "opacity-100" : "opacity-0"
                }`}
              />
              <span
                aria-hidden
                className={`w-4 text-center transition-colors ${
                  active ? "text-[var(--brand-1)]" : "opacity-70"
                }`}
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-2 flex items-center gap-2 border-t border-[var(--border)] px-4 py-3">
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--surface-2)] text-[11px] font-bold uppercase text-[var(--muted)]"
        >
          {userEmail.charAt(0) || "?"}
        </span>
        <p className="truncate text-xs text-[var(--muted)]" title={userEmail}>
          {userEmail}
        </p>
      </div>
    </aside>
  );
}
