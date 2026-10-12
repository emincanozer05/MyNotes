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
