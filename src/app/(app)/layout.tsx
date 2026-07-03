import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="flex flex-1">
      <div className="aurora" aria-hidden />
      <Sidebar userEmail={user.email ?? ""} />
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_75%,transparent)] px-6 py-2.5 backdrop-blur-md">
          <span className="text-xs font-medium text-stone-400">
            Kuvvet &amp; Kondisyon Bilgi Platformu
          </span>
          <form action={logout}>
            <button className="rounded-full px-3 py-1 text-xs font-medium text-stone-500 transition-colors hover:bg-rose-500/10 hover:text-rose-500">
              Çıkış yap
            </button>
          </form>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
