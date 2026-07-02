import { login, signup } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; info?: string }>;
}) {
  const { error, info } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">S&amp;C Hub</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Kuvvet &amp; Kondisyon bilgi platformu — literatür, notlar ve
            koçluk araçları tek yerde.
          </p>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
        {info && (
          <p className="rounded-md bg-emerald-50 dark:bg-emerald-950 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
            {info}
          </p>
        )}

        <form className="space-y-4">
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
              className="w-full rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium">
              Şifre
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="current-password"
              className="w-full rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>
          <div className="flex gap-3">
            <button
              formAction={login}
              className="flex-1 rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
            >
              Giriş Yap
            </button>
            <button
              formAction={signup}
              className="flex-1 rounded-md border border-stone-300 dark:border-stone-700 px-4 py-2 text-sm font-semibold hover:bg-stone-100 dark:hover:bg-stone-800"
            >
              Kayıt Ol
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
