"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function encodeMessage(path: string, key: string, message: string) {
  return `${path}?${key}=${encodeURIComponent(message)}`;
}

export async function login(formData: FormData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (error) {
    redirect(encodeMessage("/login", "error", describeLoginError(error)));
  }

  redirect("/");
}

// Surface the real cause instead of reporting every failure as a wrong password.
function describeLoginError(error: { code?: string; status?: number; message: string }) {
  switch (error.code) {
    case "invalid_credentials":
      return "Giriş başarısız: e-posta veya şifre hatalı.";
    case "email_not_confirmed":
      return "Giriş başarısız: e-posta adresiniz henüz doğrulanmamış. Gelen kutunuzdaki doğrulama bağlantısını onaylayın.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Çok fazla deneme yapıldı. Lütfen birkaç dakika bekleyip tekrar deneyin.";
    case "user_banned":
      return "Bu hesap askıya alınmış.";
  }
  if (error.status === undefined || error.status === 0 || error.status >= 500) {
    return `Giriş başarısız: kimlik doğrulama servisine ulaşılamadı (${error.message}).`;
  }
  return `Giriş başarısız: ${error.message}`;
}

export async function signup(formData: FormData) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (error) {
    redirect(encodeMessage("/login", "error", `Kayıt başarısız: ${error.message}`));
  }

  // With email confirmation enabled Supabase returns a user without a session.
  if (!data.session) {
    redirect(
      encodeMessage(
        "/login",
        "info",
        "Kayıt alındı. E-postanıza gelen doğrulama bağlantısını onaylayıp giriş yapın.",
      ),
    );
  }

  redirect("/");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
