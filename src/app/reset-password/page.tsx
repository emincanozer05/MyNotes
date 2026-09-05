import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { updatePassword } from "./actions";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  // Reached with the session the recovery link created (or an already
  // signed-in user changing their password); without one there is nothing to
  // update.
  const supabase = await createClient();
  const user = await getSessionUser(supabase);

  if (!user) {
    redirect(
      `/forgot-password?error=${encodeURIComponent("Şifre yenileme bağlantısı geçersiz veya süresi dolmuş. Yeni bir bağlantı isteyin.")}`,
    );
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Yeni şifre belirle</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {user.email} hesabı için yeni bir şifre girin.
          </p>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <form action={updatePassword} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium">
              Yeni şifre
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500 dark:border-stone-700 dark:bg-stone-900"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="passwordConfirm" className="text-sm font-medium">
              Yeni şifre (tekrar)
            </label>
            <input
              id="passwordConfirm"
              name="passwordConfirm"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500 dark:border-stone-700 dark:bg-stone-900"
            />
          </div>
          <button className="w-full rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
            Şifreyi güncelle
          </button>
        </form>
      </div>
    </main>
  );
}
