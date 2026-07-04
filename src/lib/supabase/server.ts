import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Current user from the session cookie WITHOUT a network round-trip.
 *
 * `auth.getUser()` calls the Supabase Auth server on every invocation, which
 * adds real latency to each server action. The proxy middleware already
 * refreshes/validates the token before the request reaches here, and Postgres
 * RLS re-validates the JWT on every query — so reading the id from the session
 * cookie is safe and much faster for write actions.
 */
export async function getSessionUser(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user ?? null;
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component; session refresh is handled in proxy.ts.
          }
        },
      },
    },
  );
}
