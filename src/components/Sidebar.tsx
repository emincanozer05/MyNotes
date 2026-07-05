"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Panel", icon: "◈" },
  { href: "/library", label: "Literatür", icon: "❧" },
  { href: "/notes", label: "Post-it Notlar", icon: "✎" },
  { href: "/flashcards", label: "Flashcard", icon: "▤" },
  { href: "/voice", label: "Ses Notu", icon: "♪" },
  { href: "/bookshelf", label: "Kitap Rafı", icon: "▥" },
  { href: "/courses", label: "Kurslar / Eğitimler", icon: "❖" },
  { href: "/insights", label: "Bilgi Derinliği", icon: "◔" },
  { href: "/backup", label: "Yedekleme", icon: "⤓" },
];

export function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <aside className="no-print flex w-56 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
      <div className="px-4 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-rose-500 text-sm font-black text-white">
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
              className={`group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                active
                  ? "bg-[var(--surface-2)] font-semibold text-[var(--foreground)]"
                  : "font-medium text-[var(--muted)] hover:bg-[var(--surface-2)]"
              }`}
            >
              <span aria-hidden className="w-4 text-center opacity-80">
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
