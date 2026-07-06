/**
 * Client helpers for the post-it "Kaynağa git" deep link.
 *
 * Links carry a `#note-<noteId>~<passageIndex>` fragment: the note (titled
 * section) the tagged passage lives in, plus the passage's index among the
 * tagged `<mark>`s of that note — so the source page can scroll straight to
 * the highlighted text instead of just the top of the page.
 */

export interface NoteHashTarget {
  noteId: string;
  /** Index of the tagged passage inside the note, or null for the note itself. */
  passageIndex: number | null;
}

/** Parses `#note-<id>` and `#note-<id>~<passageIndex>` fragments. */
export function parseNoteHash(hash: string): NoteHashTarget | null {
  const match = /^#note-([^~]+)(?:~(\d+))?$/.exec(hash);
  if (!match) return null;
  return {
    noteId: decodeURIComponent(match[1]),
    passageIndex: match[2] != null ? Number(match[2]) : null,
  };
}

/**
 * Tagged `<mark>`s in DOM order, bundled the same way `extractTaggedPassages`
 * bundles the stored HTML — consecutive marks born from one selection share a
 * `data-tag-group` and count as ONE passage — so indexes line up with the
 * post-it board.
 */
export function taggedMarkGroupsIn(container: HTMLElement): HTMLElement[][] {
  const marks = [
    ...container.querySelectorAll<HTMLElement>("mark[data-tag-name]"),
  ].filter(
    (m) =>
      (m.dataset.tagName ?? "").trim().replace(/^#/, "") !== "" &&
      (m.textContent ?? "").trim() !== "",
  );
  const groups: HTMLElement[][] = [];
  let lastGroup: string | null = null;
  for (const m of marks) {
    const g = m.dataset.tagGroup || null;
    if (g && g === lastGroup) groups[groups.length - 1].push(m);
    else groups.push([m]);
    lastGroup = g;
  }
  return groups;
}

/**
 * Scrolls the tagged passage at `passageIndex` into view and flashes it so the
 * eye lands on the exact text. Retries while the rich-text editor is still
 * rendering its content; falls back to the container itself when the link has
 * no passage index (or the passage no longer exists). Returns a cleanup.
 */
export function scrollToPassage(
  getContainer: () => HTMLElement | null,
  passageIndex: number | null,
): () => void {
  const MAX_TRIES = 25;
  const INTERVAL_MS = 120;
  let tries = 0;
  const timer = setInterval(() => {
    tries += 1;
    const container = getContainer();
    if (container) {
      if (passageIndex == null) {
        clearInterval(timer);
        container.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
      const group = taggedMarkGroupsIn(container)[passageIndex];
      if (group) {
        clearInterval(timer);
        group[0].scrollIntoView({ behavior: "smooth", block: "center" });
        for (const mark of group) mark.classList.add("tag-mark-flash");
        setTimeout(() => {
          for (const mark of group) mark.classList.remove("tag-mark-flash");
        }, 2400);
        return;
      }
    }
    if (tries >= MAX_TRIES) {
      clearInterval(timer);
      getContainer()?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, INTERVAL_MS);
  return () => clearInterval(timer);
}
