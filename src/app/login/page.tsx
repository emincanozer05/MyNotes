import { login, signup } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; info?: string }>;
}) {
  const { error, info } = await searchParams;

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden p-6">
      {/* Decorative background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="animate-float-slow absolute -top-32 right-[10%] h-96 w-96 rounded-full bg-gradient-to-br from-amber-400/25 to-orange-500/15 blur-3xl" />
        <div className="animate-float-slow absolute -bottom-40 left-[5%] h-[28rem] w-[28rem] rounded-full bg-gradient-to-tr from-stone-400/15 to-amber-300/15 blur-3xl [animation-delay:-4s]" />
      </div>

      <div className="animate-fade-up w-full max-w-md">
        <div className="card p-8 sm:p-10">
          <div className="space-y-3 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/40">
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="h-7 w-7"
              >
                <path d="M2 12h2m16 0h2M6 8v8M9 6v12M15 6v12M18 8v8M9 12h6" />
              </svg>
            </span>
            <h1 className="text-3xl font-bold tracking-tight">
              S&amp;C{" "}
              <span className="bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent dark:from-amber-400 dark:to-orange-400">
                Hub
              </span>
            </h1>
            <p className="text-sm leading-relaxed text-stone-500 dark:text-stone-400">
              Kuvvet &amp; Kondisyon bilgi platformu — literatür, notlar ve
              koçluk araçları tek yerde.
            </p>
          </div>

          {error && (
            <p className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}
          {info && (
            <p className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
              {info}
            </p>
          )}

          <form className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                E-posta
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="ornek@eposta.com"
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3.5 py-2.5 text-sm placeholder:text-stone-400 dark:placeholder:text-stone-600"
              />
            </div>
            <div className="space-y-1.5">
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
                placeholder="••••••••"
                className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3.5 py-2.5 text-sm placeholder:text-stone-400 dark:placeholder:text-stone-600"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button formAction={login} className="btn-primary flex-1 py-2.5">
                Giriş Yap
              </button>
              <button
                formAction={signup}
                className="btn-secondary flex-1 py-2.5"
              >
                Kayıt Ol
              </button>
            </div>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-stone-400 dark:text-stone-600">
          Verileriniz cihazlar arası senkronize ve yalnızca size özeldir.
        </p>
      </div>
    </main>
  );
}
