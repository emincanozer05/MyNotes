/** Which provider answered a /api/translate call, as a short Turkish label. */

export type TranslateProvider = "gemini" | "google" | "mymemory" | "anthropic" | "mixed" | "none";

const NAMES: Record<string, string> = {
  gemini: "Gemini",
  google: "Google Çeviri",
  mymemory: "MyMemory",
  anthropic: "Claude",
  mixed: "birden fazla servis",
};

export function translateInfoLabel(provider?: string, fallbackReason?: string | null): string {
  if (!provider) return "";
  if (provider === "none") return "Çeviri yapılamadı";
  const name = NAMES[provider] ?? provider;
  if (provider === "gemini") return "Gemini ile çevrildi";
  return fallbackReason
    ? `${name} ile çevrildi · Gemini kullanılamadı: ${fallbackReason}`
    : `${name} ile çevrildi`;
}
