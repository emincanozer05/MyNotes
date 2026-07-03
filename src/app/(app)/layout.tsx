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
      <Sidebar userEmail={user.email ?? ""} />
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-end border-b border-stone-200/80 dark:border-stone-800/80 bg-white/60 dark:bg-stone-950/60 px-6 py-2.5 backdrop-blur-xl">
          <form action={logout}>
            <button className="rounded-lg border border-transparent px-3 py-1.5 text-xs font-medium text-stone-500 transition-colors hover:border-stone-200 hover:bg-white hover:text-stone-800 dark:hover:border-stone-800 dark:hover:bg-stone-900 dark:hover:text-stone-200">
              Çıkış yap
            </button>
          </form>
        </header>
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="animate-fade-up">{children}</div>
        </main>
      </div>
    </div>
  );
}
