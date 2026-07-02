"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Panel", icon: "◈" },
  { href: "/library", label: "Literatür", icon: "❧" },
  { href: "/notes", label: "Notlar", icon: "✎" },
  { href: "/highlights", label: "Öne Çıkanlar", icon: "❝" },
  { href: "/graph", label: "Bilgi Grafiği", icon: "⌘" },
  { href: "/calculators", label: "Hesaplayıcılar", icon: "∑" },
  { href: "/flashcards", label: "Flashcard", icon: "▤" },
  { href: "/bookshelf", label: "Kitap Rafı", icon: "▥" },
  { href: "/insights", label: "Bilgi Derinliği", icon: "◔" },
];

export function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950">
      <div className="px-4 py-5">
        <Link href="/" className="text-lg font-bold tracking-tight">
          S&amp;C Hub
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
              className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                  : "text-stone-600 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-900"
              }`}
            >
              <span aria-hidden className="w-4 text-center">
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-stone-200 dark:border-stone-800 px-4 py-3">
        <p className="truncate text-xs text-stone-500" title={userEmail}>
          {userEmail}
        </p>
      </div>
    </aside>
  );
}
