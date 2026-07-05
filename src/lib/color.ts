/** Helpers for rendering tag colors as a light ("hafif vurgulu") highlight. */

const DEFAULT_TAG_COLOR = "#f59e0b";

/** Appends an alpha channel to a `#rrggbb` hex color for a light-tint background. */
export function tagHighlightBg(hex: string | null | undefined, alphaHex = "40"): string {
  const color = hex && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : DEFAULT_TAG_COLOR;
  return `${color}${alphaHex}`;
}

/** Suggested starting swatches for the tag color picker. */
export const TAG_COLOR_SWATCHES = [
  "#f59e0b", // amber
  "#ef4444", // red
  "#ec4899", // pink
  "#a855f7", // purple
  "#6366f1", // indigo
  "#3b82f6", // blue
  "#06b6d4", // cyan
  "#10b981", // emerald
  "#84cc16", // lime
  "#78716c", // stone
];
