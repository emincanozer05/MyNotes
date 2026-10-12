/**
 * Turns text copied out of a PDF text layer into clean running prose:
 * words split by an end-of-line hyphen are rejoined ("kuvvet-\ngelişimi" →
 * "kuvvetgelişimi"), soft hyphens are dropped, and line/paragraph breaks
 * collapse to single spaces so a sentence stays one sentence.
 */
export function normalizePdfSelection(raw: string): string {
  return raw
    .replace(/\u0000/g, "")
    .replace(/­\s*/g, "")
    // Hyphenated line break inside a word: letter, "-", newline, lowercase letter.
    .replace(/(\p{L})[-‐‑]\s*\n\s*(\p{Ll})/gu, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}
