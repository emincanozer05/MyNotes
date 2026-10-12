import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh the auth token; do not run logic between createServerClient and
  // getClaims. Unlike getUser(), getClaims() verifies the JWT locally against
  // the project's cached public signing keys instead of calling the Supabase
  // Auth server on every request — removing a network round-trip from every
  // navigation. It still refreshes an expired session via getSession(), and
  // falls back to getUser() automatically on legacy HS256 projects.
  const { data } = await supabase.auth.getClaims();

  // Single-owner site: when there is no valid session, sign in automatically
  // with the owner credentials from the server environment. The new session
  // cookies land on both the request (so this very render sees them) and the
  // response (so the browser keeps them).
  if (!data?.claims) {
    const email = process.env.OWNER_EMAIL;
    const password = process.env.OWNER_PASSWORD;
    if (!email || !password) {
      return new NextResponse(
        "Otomatik giriş yapılandırılmamış: OWNER_EMAIL ve OWNER_PASSWORD ortam değişkenlerini tanımlayın.",
        { status: 503 },
      );
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return new NextResponse(
        `Otomatik giriş başarısız: ${error.message}`,
        { status: 503 },
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except static assets
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
