/** Shared Google Gemini settings for the API routes (server-side only). */

export const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

export function geminiKey(): string | undefined {
  // Pasted values often carry stray whitespace or wrapping quotes.
  const raw = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
  return raw.trim().replace(/^["']|["']$/g, "") || undefined;
}

export function geminiModel(): string {
  return process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;
}

/** Translation default: a light model with a roomier free quota. Quotas are per
 *  model, so this also keeps translations from eating Açıkla's allowance. */
export const GEMINI_TRANSLATE_DEFAULT_MODEL = "gemini-2.5-flash-lite";

export function geminiTranslateModel(): string {
  return process.env.GEMINI_TRANSLATE_MODEL || GEMINI_TRANSLATE_DEFAULT_MODEL;
}
