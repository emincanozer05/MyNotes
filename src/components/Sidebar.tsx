"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function Icon({ path }: { path: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px] shrink-0"
    >
      <path d={path} />
    </svg>
  );
}

// Lucide-style stroke paths
const NAV_ITEMS = [
  {
    href: "/",
    label: "Panel",
    icon: "M3 13h8V3H3v10zm10 8h8V11h-8v10zM3 21h8v-6H3v6zm10-12h8V3h-8v6z",
  },
  {
    href: "/library",
    label: "Literatür",
    icon: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5v15zm0 0A2.5 2.5 0 0 0 6.5 22H20v-5",
  },
  {
    href: "/notes",
    label: "Notlar",
    icon: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z",
  },
  {
    href: "/highlights",
    label: "Öne Çıkanlar",
    icon: "M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z",
  },
  {
    href: "/graph",
    label: "Bilgi Grafiği",
    icon: "M9 6a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM4 19a3 3 0 1 0 6 0 3 3 0 0 0-6 0zm10 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM10.5 8.5L7.8 16m5.7-7.5l2.7 7.5",
  },
  {
    href: "/calculators",
    label: "Hesaplayıcılar",
    icon: "M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm2 4h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01",
  },
  {
    href: "/flashcards",
    label: "Flashcard",
    icon: "M2 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8zm18-2h1a1 1 0 0 1 1 1v10",
  },
  {
    href: "/voice",
    label: "Ses Notu",
    icon: "M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3zm7 9a7 7 0 0 1-14 0m7 7v3m-4 0h8",
  },
  {
    href: "/bookshelf",
    label: "Kitap Rafı",
    icon: "M4 4h4v16H4V4zm6 0h4v16h-4V4zm7 .5l3.5 15L17 20l-3.5-15L17 4.5z",
  },
  {
    href: "/insights",
    label: "Bilgi Derinliği",
    icon: "M12 22a10 10 0 1 1 10-10M12 6v6l4 2m6-10v6h-6",
  },
];

export function Sidebar({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-stone-200/80 dark:border-stone-800/80 bg-white/70 dark:bg-stone-950/70 backdrop-blur-xl">
      <div className="px-4 py-5">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/30 transition-transform group-hover:scale-105">
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="h-5 w-5"
            >
              {/* barbell */}
              <path d="M2 12h2m16 0h2M6 8v8M9 6v12M15 6v12M18 8v8M9 12h6" />
            </svg>
          </span>
          <span className="text-lg font-bold tracking-tight">
            S&amp;C{" "}
            <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent dark:from-amber-400 dark:to-orange-400">
              Hub
            </span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        <p className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400 dark:text-stone-600">
          Modüller
        </p>
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                active
                  ? "bg-gradient-to-r from-amber-500/15 to-orange-500/10 text-amber-800 dark:text-amber-300"
                  : "text-stone-600 hover:translate-x-0.5 hover:bg-stone-100/80 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-900/80 dark:hover:text-stone-100"
              }`}
            >
              {active && (
                <span
                  aria-hidden
                  className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-amber-500 to-orange-600"
                />
              )}
              <span
                className={
                  active
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-stone-400 transition-colors group-hover:text-amber-600 dark:text-stone-500 dark:group-hover:text-amber-400"
                }
              >
                <Icon path={item.icon} />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-stone-200/80 dark:border-stone-800/80 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-stone-200 to-stone-300 text-xs font-bold uppercase text-stone-600 dark:from-stone-700 dark:to-stone-800 dark:text-stone-300">
            {userEmail.charAt(0) || "?"}
          </span>
          <p className="truncate text-xs text-stone-500" title={userEmail}>
            {userEmail}
          </p>
        </div>
      </div>
    </aside>
  );
}
