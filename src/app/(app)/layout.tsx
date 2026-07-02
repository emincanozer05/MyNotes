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
        <header className="flex items-center justify-end border-b border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 px-6 py-2.5">
          <form action={logout}>
            <button className="text-xs font-medium text-stone-500 hover:text-stone-800 dark:hover:text-stone-200">
              Çıkış yap
            </button>
          </form>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
