"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSiteOrigin } from "@/lib/site-url";

const SENT_MESSAGE =
  "Şifre sıfırlama bağlantısı e-posta adresinize gönderildi. Bağlantı 1 saat geçerlidir; gelen kutunuzda göremezseniz spam klasörünü kontrol edin.";

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    redirect(
      `/forgot-password?error=${encodeURIComponent("E-posta adresi gerekli.")}`,
    );
  }

  const supabase = await createClient();
  const origin = await getSiteOrigin();

  // Supabase sends the user to this callback with a recovery token; the
  // callback turns it into a session and forwards to the new-password form.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
  });

  if (error) {
    redirect(
      `/forgot-password?error=${encodeURIComponent(`Bağlantı gönderilemedi: ${error.message}`)}`,
    );
  }

  redirect(`/forgot-password?info=${encodeURIComponent(SENT_MESSAGE)}`);
}
