"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Deep link for search results: an `#ara=<kelime>` fragment scrolls the page
 * to the first occurrence of the word and flashes it — same "the eye lands on
 * the text" behaviour as the post-it "Kaynağa git" link, but for free text
 * instead of tagged passages.
 */

const MAX_TRIES = 25;
const INTERVAL_MS = 120;

/** First element under `root` whose text contains `query` (Turkish-aware). */
function findTextTarget(root: HTMLElement, query: string): HTMLElement | null {
  const needle = query.toLocaleLowerCase("tr");

  // Preferred: the exact text node holding the match (deepest possible hit).
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    if ((node.textContent ?? "").toLocaleLowerCase("tr").includes(needle)) {
      const el = node.parentElement;
      if (el) return el;
    }
  }

  // Match split across inline elements: descend to the deepest element whose
  // combined text still contains the query.
  let el: HTMLElement = root;
  descend: for (;;) {
    for (const child of el.children) {
      const c = child as HTMLElement;
      if ((c.textContent ?? "").toLocaleLowerCase("tr").includes(needle)) {
        el = c;
        continue descend;
      }
    }
    break;
  }
  return el === root ? null : el;
}

export function ScrollToSearchText() {
  const pathname = usePathname();

  useEffect(() => {
    const match = /^#ara=(.+)$/.exec(window.location.hash);
    if (!match) return;

    let query = "";
    try {
      query = decodeURIComponent(match[1]).trim();
    } catch {
      return;
    }
    if (!query) return;

    // Retry while the page (rich-text editors, async panels) is still
    // rendering its content, mirroring scrollToPassage's behaviour.
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      const main = document.querySelector("main");
      const target = main ? findTextTarget(main, query) : null;
      if (target) {
        clearInterval(timer);
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.classList.add("tag-mark-flash");
        setTimeout(() => target.classList.remove("tag-mark-flash"), 2400);
      } else if (tries >= MAX_TRIES) {
        clearInterval(timer);
      }
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [pathname]);

  return null;
}
