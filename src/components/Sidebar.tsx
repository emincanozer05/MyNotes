"use client";

import { CloseIcon } from "@/components/CloseIcon";
import { Icon, type IconName } from "@/components/Icon";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Panel", icon: "dashboard" },
  { href: "/library", label: "Literatür", icon: "newspaper" },
  { href: "/notes", label: "Post-it Notlar", icon: "sticky-note" },
  { href: "/bookshelf", label: "Kitap Rafı", icon: "library" },
  { href: "/glossary", label: "Ne, nedir?", icon: "help" },
  { href: "/courses", label: "Kurslar ve Eğitimler (S&C)", icon: "graduation" },
  { href: "/network", label: "Network Haritası", icon: "network" },
  { href: "/backup", label: "Yedekleme", icon: "archive" },
];

export function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  // Off-canvas drawer state on small screens (always visible from md up).
  const [open, setOpen] = useState(false);

  // Close the drawer after navigating.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* Menu button — small screens only, sits in the header's left gap */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menüyü aç"
        className="no-print fixed left-3 top-[calc(env(safe-area-inset-top)+0.5rem)] z-30 flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-base text-[var(--muted)] md:hidden"
      >
        <Icon name="menu" className="h-5 w-5" />
      </button>
      {open && (
        <div
          aria-hidden
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
        />
      )}

      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-transform duration-200 md:sticky md:top-0 md:z-auto md:h-screen md:w-56 md:translate-x-0 ${
          open ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-4 pb-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
          <Link
            href="/"
            className="group flex items-center gap-2.5 rounded-lg transition-opacity hover:opacity-90"
          >
            {/* Wordmark logo (same as the app icon), drawn as text so it
                follows the light/dark theme. */}
            <span className="pl-1 text-xl font-normal leading-none tracking-[0.32em]">
              NOTE
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Menüyü kapat"
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-[var(--muted)] hover:bg-[var(--surface-2)] md:hidden"
          >
            <CloseIcon />
          </button>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2">
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
                className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-[var(--surface-2)] text-[var(--foreground)]"
                    : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
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
                  className={`flex w-4 justify-center transition-colors ${
                    active ? "text-[var(--brand-1)]" : "opacity-70"
                  }`}
                >
                  <Icon name={item.icon} className="h-4 w-4" />
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
    </>
  );
}
