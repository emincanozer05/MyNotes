"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function saveCalculation(
  calcType: "1rm" | "fv-profile" | "karvonen",
  inputs: Record<string, unknown>,
  results: Record<string, unknown>,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Oturum bulunamadı." };

  const { error } = await supabase.from("calc_history").insert({
    user_id: user.id,
    calc_type: calcType,
    inputs,
    results,
  });

  revalidatePath("/calculators");
  return { error: error?.message ?? null };
}

export async function deleteCalculation(formData: FormData) {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  if (id) await supabase.from("calc_history").delete().eq("id", id);
  revalidatePath("/calculators");
}
