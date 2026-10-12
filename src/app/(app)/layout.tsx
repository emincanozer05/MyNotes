import { Suspense } from "react";
import { Sidebar } from "@/components/Sidebar";
import { BackButton } from "@/components/BackButton";
import { HeaderSearch } from "@/components/HeaderSearch";
import { ScrollToSearchText } from "@/components/ScrollToSearchText";
import { ExplainSelection } from "@/components/ExplainSelection";
import { createClient, getSessionUser } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The proxy middleware already validated/refreshed auth for this request,
  // so read the user from the session cookie (no extra network round-trip).
  const supabase = await createClient();
  const user = await getSessionUser(supabase);

  if (!user) throw new Error("Oturum bulunamadı: otomatik giriş başarısız oldu.");

  return (
    <div className="flex flex-1">
      <Sidebar userEmail={user.email ?? ""} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex items-center justify-between border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--surface)_86%,transparent)] pb-2.5 pt-[calc(env(safe-area-inset-top)+0.625rem)] pl-14 pr-4 backdrop-blur-md md:px-6">
          <div className="flex items-center gap-3">
            <BackButton />
            <span className="hidden text-xs font-medium text-[var(--muted)] sm:inline">
              Kuvvet &amp; Kondisyon Bilgi Platformu
            </span>
          </div>
          <div className="flex flex-1 justify-center px-4">
            <Suspense fallback={null}>
              <HeaderSearch />
            </Suspense>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto px-4 py-6 md:px-6 md:py-7">{children}</main>
        <ScrollToSearchText />
        <ExplainSelection />
      </div>
    </div>
  );
}
