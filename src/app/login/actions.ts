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
    redirect(encodeMessage("/login", "error", "Giriş başarısız: e-posta veya şifre hatalı."));
  }

  redirect("/");
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
