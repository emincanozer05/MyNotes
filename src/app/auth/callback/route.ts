import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getSiteOrigin, sanitizeNextPath } from "@/lib/site-url";

/**
 * Landing point for the links Supabase mails out (password recovery, e-mail
 * confirmation). Newer templates send `token_hash` + `type`, the PKCE flow
 * sends `code`; both are turned into a session cookie here before the user is
 * forwarded to `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const origin = await getSiteOrigin();
  const next = sanitizeNextPath(searchParams.get("next"), "/");

  const failure = (message: string) =>
    NextResponse.redirect(
      `${origin}/forgot-password?error=${encodeURIComponent(message)}`,
    );

  const providerError =
    searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError) {
    return failure(`Bağlantı doğrulanamadı: ${providerError}`);
  }

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (error) {
      return failure(
        "Bağlantı geçersiz veya süresi dolmuş. Yeni bir sıfırlama bağlantısı isteyin.",
      );
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return failure(
        "Bağlantı geçersiz veya süresi dolmuş. Yeni bir sıfırlama bağlantısı isteyin.",
      );
    }
  } else {
    return failure("Geçersiz bağlantı: doğrulama kodu bulunamadı.");
  }

  return NextResponse.redirect(`${origin}${next}`);
}
