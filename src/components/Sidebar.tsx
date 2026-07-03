"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Panel", icon: "◈" },
  { href: "/library", label: "Literatür", icon: "❧" },
  { href: "/notes", label: "Post-it Notlar", icon: "✎" },
  { href: "/highlights", label: "Öne Çıkanlar", icon: "❝" },
  { href: "/graph", label: "Bilgi Grafiği", icon: "⌘" },
  { href: "/flashcards", label: "Flashcard", icon: "▤" },
  { href: "/voice", label: "Ses Notu", icon: "♪" },
  { href: "/bookshelf", label: "Kitap Rafı", icon: "▥" },
  { href: "/insights", label: "Bilgi Derinliği", icon: "◔" },
];

export function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] backdrop-blur-md">
      <div className="px-4 py-5">
        <Link href="/" className="group flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 via-rose-500 to-violet-500 text-sm font-black text-white shadow-lg transition-transform group-hover:scale-110 group-hover:rotate-6">
            S
          </span>
          <span className="text-lg font-extrabold tracking-tight gradient-text">
            S&amp;C Hub
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
              className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                active
                  ? "bg-gradient-to-r from-amber-500/15 to-rose-500/10 text-amber-700 dark:text-amber-300"
                  : "text-stone-600 hover:bg-stone-500/10 hover:translate-x-0.5 dark:text-stone-400"
              }`}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-gradient-to-b from-amber-500 to-rose-500" />
              )}
              <span
                aria-hidden
                className={`w-4 text-center transition-transform group-hover:scale-125 ${
                  active ? "text-rose-500" : ""
                }`}
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-[var(--border)] px-4 py-3">
        <p className="truncate text-xs text-stone-500" title={userEmail}>
          {userEmail}
        </p>
      </div>
    </aside>
  );
}
