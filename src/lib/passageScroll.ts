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
 * Tagged `<mark>`s in DOM order, mirroring the filters `extractTaggedPassages`
 * applies to the stored HTML so the indexes line up with the post-it board.
 */
export function taggedMarksIn(container: HTMLElement): HTMLElement[] {
  return [
    ...container.querySelectorAll<HTMLElement>("mark[data-tag-name]"),
  ].filter(
    (m) =>
      (m.dataset.tagName ?? "").trim().replace(/^#/, "") !== "" &&
      (m.textContent ?? "").trim() !== "",
  );
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
      const mark = taggedMarksIn(container)[passageIndex];
      if (mark) {
        clearInterval(timer);
        mark.scrollIntoView({ behavior: "smooth", block: "center" });
        mark.classList.add("tag-mark-flash");
        setTimeout(() => mark.classList.remove("tag-mark-flash"), 2400);
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
