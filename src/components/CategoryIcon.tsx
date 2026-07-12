/**
 * Flat, single-colour (currentColor) 2D icons for the content categories —
 * used in the category tab pills instead of emoji so they adopt the tab's text
 * colour in both themes. The four built-in categories have bespoke icons; any
 * user-added category falls back to a generic tag icon.
 */
export function CategoryIcon({
  slug,
  className = "h-4 w-4",
}: {
  slug: string;
  className?: string;
}) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };

  switch (slug) {
    case "tarih": // classical temple
      return (
        <svg {...common}>
          <path d="M3 21h18M5 18h14M6 9v9M10 9v9M14 9v9M18 9v9M4 9h16M12 3 4 8.5h16L12 3Z" />
        </svg>
      );
    case "bilim": // erlenmeyer flask
      return (
        <svg {...common}>
          <path d="M9.5 3h5M10 3v5.8L4.6 17.6A2 2 0 0 0 6.3 20.6h11.4a2 2 0 0 0 1.7-3L14 8.8V3M7.5 15h9" />
        </svg>
      );
    case "felsefe": // idea bulb
      return (
        <svg {...common}>
          <path d="M9.5 18h5M10.5 21h3M12 3a6 6 0 0 0-3.4 10.9c.9.7 1.4 1.6 1.4 2.6v.5h4v-.5c0-1 .5-1.9 1.4-2.6A6 6 0 0 0 12 3Z" />
        </svg>
      );
    case "spor": // barbell
      return (
        <svg {...common}>
          <path d="M2 10v4M5.5 7v10M18.5 7v10M22 10v4M5.5 12h13" />
        </svg>
      );
    default: // user-added category — generic tag
      return (
        <svg {...common}>
          <path d="M3 5.6A2.6 2.6 0 0 1 5.6 3H11a2 2 0 0 1 1.4.6l8 8a2 2 0 0 1 0 2.8l-5.6 5.6a2 2 0 0 1-2.8 0l-8-8A2 2 0 0 1 3 10.6V5.6Z" />
          <circle cx="7.5" cy="7.5" r="1.05" />
        </svg>
      );
  }
}
