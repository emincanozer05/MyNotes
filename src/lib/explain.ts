/**
 * Shared contract between the "Açıkla" selection popup
 * (`src/components/ExplainSelection.tsx`) and its route handler
 * (`src/app/api/explain/route.ts`). Safe to import from client and server.
 */

/** default = first explanation; simpler/detailed rewrite the previous one. */
export type ExplainMode = "default" | "simpler" | "detailed";

export const EXPLAIN_MODES: readonly ExplainMode[] = ["default", "simpler", "detailed"];

export type ExplainRequest = {
  /** The text the user selected. */
  text: string;
  /** The surrounding paragraph/block (may equal `text`). */
  paragraph: string;
  /** Page title and nearest section heading, joined with " › ". */
  heading: string;
  mode: ExplainMode;
  /** The explanation being simplified/expanded (simpler/detailed only). */
  previous?: string;
};

/**
 * Newline-delimited JSON events streamed by POST /api/explain:
 *   {"t":"delta","v":"…"}  — next chunk of explanation text
 *   {"t":"error","v":"…"}  — user-facing (Turkish) error; discard partial text
 *   {"t":"done"}           — explanation complete
 */
export type ExplainEvent =
  | { t: "delta"; v: string }
  | { t: "error"; v: string }
  | { t: "done" };

// Limits are enforced on both sides: the client refuses before sending, the
// server re-validates since the endpoint is reachable directly.
export const MAX_SELECTION_CHARS = 3000;
export const MAX_PARAGRAPH_CHARS = 2400;
export const MAX_HEADING_CHARS = 300;
export const MAX_PREVIOUS_CHARS = 4000;

/** Collapse runs of whitespace (incl. newlines from innerText) to one space. */
export function normalizeText(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
