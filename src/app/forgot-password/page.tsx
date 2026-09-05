import Link from "next/link";
import { requestPasswordReset } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; info?: string }>;
}) {
  const { error, info } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Şifremi unuttum</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Hesabınızın e-posta adresini girin; şifrenizi yenilemeniz için bir
            bağlantı gönderelim.
          </p>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}
        {info && (
          <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            {info}
          </p>
        )}

        <form action={requestPasswordReset} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">
              E-posta
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500 dark:border-stone-700 dark:bg-stone-900"
            />
          </div>
          <button className="w-full rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
            Sıfırlama bağlantısı gönder
          </button>
        </form>

        <p className="text-center text-sm text-stone-500 dark:text-stone-400">
          <Link href="/login" className="font-medium hover:underline">
            Giriş ekranına dön
          </Link>
        </p>
      </div>
    </main>
  );
}
