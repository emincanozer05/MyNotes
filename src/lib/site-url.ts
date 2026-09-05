import { headers } from "next/headers";

/**
 * Absolute origin of the running site, used to build auth redirect links.
 *
 * Prefers NEXT_PUBLIC_SITE_URL so production e-mails always point at the
 * canonical domain; falls back to the forwarded/host headers of the current
 * request (correct behind a proxy and in local development).
 */
export async function getSiteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  const headerList = await headers();
  const host =
    headerList.get("x-forwarded-host") ??
    headerList.get("host") ??
    "localhost:3000";
  const protocol =
    headerList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1")
      ? "http"
      : "https");

  return `${protocol}://${host}`;
}

/**
 * Only allow same-site relative paths as a post-login destination, so a
 * crafted `next` parameter cannot bounce the user to another domain.
 */
export function sanitizeNextPath(next: string | null, fallback: string) {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
