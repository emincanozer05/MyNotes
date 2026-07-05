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

/** Mixes a `#rrggbb` color with white for a soft, post-it-friendly pastel tone. */
export function pastelize(hex: string | null | undefined, mixWithWhite = 0.55): string {
  const color = hex && /^#[0-9a-fA-F]{6}$/.test(hex) ? hex : DEFAULT_TAG_COLOR;
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * mixWithWhite);
  const toHex = (c: number) => c.toString(16).padStart(2, "0");
  return `#${toHex(mix(r))}${toHex(mix(g))}${toHex(mix(b))}`;
}

/** First tag id referenced by a `<mark data-tag-id="…">` in stored HTML content. */
export function firstTagIdInHtml(html: string | null | undefined): string | null {
  return html?.match(/data-tag-id="([^"]+)"/)?.[1] ?? null;
}
