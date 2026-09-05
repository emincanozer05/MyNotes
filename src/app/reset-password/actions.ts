"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const MIN_PASSWORD_LENGTH = 6;

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  const fail = (message: string) =>
    redirect(`/reset-password?error=${encodeURIComponent(message)}`);

  if (password.length < MIN_PASSWORD_LENGTH) {
    fail(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`);
  }
  if (password !== passwordConfirm) {
    fail("Şifreler eşleşmiyor.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    fail(`Şifre güncellenemedi: ${error.message}`);
  }

  // End the recovery session so the new password is actually used to sign in.
  await supabase.auth.signOut();

  redirect(
    `/login?info=${encodeURIComponent("Şifreniz güncellendi. Yeni şifrenizle giriş yapabilirsiniz.")}`,
  );
}
