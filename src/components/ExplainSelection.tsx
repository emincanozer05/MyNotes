"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { CloseIcon } from "@/components/CloseIcon";
import {
  MAX_HEADING_CHARS,
  MAX_PARAGRAPH_CHARS,
  MAX_SELECTION_CHARS,
  normalizeText,
  type ExplainEvent,
  type ExplainMode,
  type ExplainRequest,
} from "@/lib/explain";

/**
 * "Açıkla" — RemNote-style AI Explain for any readable text on the page.
 *
 * Select text (mouse drag, keyboard, or long-press on touch) and a small
 * "Açıkla" button appears next to it. Pressing it sends the selection, its
 * paragraph and the nearest section heading to `endpoint`, and streams the
 * explanation into a popup anchored to the selection. The popup can
 * re-generate the explanation simpler or in more detail from the same context.
 *
 * Self-contained: mount it once (the app layout does) and it works on every
 * page. Selections inside form controls, buttons, menus or any element marked
 * `data-no-explain` are ignored, and the component never cancels or alters
 * page events, so interactive elements keep their normal behaviour.
 *
 * Results are cached per tab in memory (and per server instance by the
 * route); nothing is written to localStorage/sessionStorage.
 */

// ---- Types -------------------------------------------------------------
type Snapshot = {
  text: string;
  paragraph: string;
  heading: string;
  /** Live copy of the selection range, used to keep the UI anchored on scroll. */
  range: Range;
  /** Touch selection: place the button below (native menus sit above). */
  touch: boolean;
  path: string;
};

type Popup = {
  id: number;
  snap: Snapshot;
  mode: ExplainMode;
  /** Explanation that simpler/detailed rewrites (kept for "Tekrar dene"). */
  previous?: string;
  status: "loading" | "streaming" | "done" | "error";
  text: string;
  error?: string;
};

class ExplainError extends Error {
  constructor(
    message: string,
    /** Keep the text streamed so far (connection cut) or discard it (refusal). */
    readonly keepPartial = false,
  ) {
    super(message);
  }
}

// ---- Constants ---------------------------------------------------------
const GAP = 8;
const EDGE = 8;
const REQUEST_TIMEOUT_MS = 60_000;

/** Selections inside these never show the button. */
const EXCLUDED = [
  "input",
  "textarea",
  "select",
  "option",
  "button",
  "label",
  '[role="button"]',
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="listbox"]',
  '[role="option"]',
  '[role="slider"]',
  '[role="tab"]',
  "[data-no-explain]",
  "[data-explain-ui]",
].join(",");

const MODE_LABEL: Record<ExplainMode, string> = {
  default: "Açıklama",
  simpler: "Daha basit açıklama",
  detailed: "Ayrıntılı açıklama",
};

/** Per-tab cache: request body (JSON) → finished explanation. */
const clientCache = new Map<string, string>();
const CLIENT_CACHE_MAX = 100;

function cacheResult(key: string, text: string) {
  clientCache.delete(key);
  clientCache.set(key, text);
  while (clientCache.size > CLIENT_CACHE_MAX) {
    const oldest = clientCache.keys().next().value;
    if (oldest === undefined) break;
    clientCache.delete(oldest);
  }
}

// ---- Selection → context ----------------------------------------------
function textOf(el: Element): string {
  return normalizeText((el as HTMLElement).innerText ?? el.textContent ?? "");
}

function elementOf(node: Node): Element | null {
  return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
}

/** Nearest block-level ancestor that contains the whole selection. */
function findBlock(start: Element, minLength: number): Element {
  let cur: Element | null = start;
  while (cur && cur !== document.body) {
    const display = getComputedStyle(cur).display;
    const inline = display.startsWith("inline") || display === "contents";
    if (!inline && textOf(cur).length >= minLength) return cur;
    cur = cur.parentElement;
  }
  return start;
}

/** The paragraph around the selection, windowed to MAX_PARAGRAPH_CHARS. */
function paragraphAround(block: Element, text: string): string {
  let full = textOf(block);
  // The user selected (almost) the whole block: widen to the parent so the
  // model sees what the passage sits in.
  if (
    full.length - text.length < 40 &&
    block.parentElement &&
    !block.matches('main, body, [role="dialog"]')
  ) {
    const parent = textOf(block.parentElement);
    if (parent.length > full.length) full = parent;
  }
  if (full.length <= MAX_PARAGRAPH_CHARS) return full;

  const at = full.indexOf(text.slice(0, 60));
  const center = at >= 0 ? at + Math.min(text.length, MAX_PARAGRAPH_CHARS) / 2 : 0;
  let start = Math.max(0, Math.round(center - MAX_PARAGRAPH_CHARS / 2));
  const end = Math.min(full.length, start + MAX_PARAGRAPH_CHARS);
  start = Math.max(0, end - MAX_PARAGRAPH_CHARS);
  return `${start > 0 ? "…" : ""}${full.slice(start, end)}${end < full.length ? "…" : ""}`;
}

/** "Page title › nearest preceding section heading" for the selection. */
function headingFor(block: Element, range: Range): string {
  const scope = block.closest('[role="dialog"], main, article') ?? document.body;
  const start = range.startContainer;
  let title: string | null = null;
  let nearest: string | null = null;
  for (const h of scope.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')) {
    if (h.closest("[data-explain-ui], nav, aside") || h.contains(start)) continue;
    // Headings come in document order; stop at the first one after the selection.
    if (!(h.compareDocumentPosition(start) & Node.DOCUMENT_POSITION_FOLLOWING)) break;
    const t = textOf(h);
    if (!t) continue;
    if (!title && h.tagName === "H1") title = t;
    nearest = t;
  }
  const parts = [title, nearest].filter((p, i, a): p is string => !!p && a.indexOf(p) === i);
  return parts.join(" › ").slice(0, MAX_HEADING_CHARS);
}

function readSelection(touch: boolean, path: string): Snapshot | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;

  // Text fields keep their own selection; never interfere with them.
  const active = document.activeElement;
  if (active?.matches("input, textarea, select")) return null;

  const range = sel.getRangeAt(0);
  const common = elementOf(range.commonAncestorContainer);
  if (!common) return null;
  for (const node of [common, elementOf(range.startContainer), elementOf(range.endContainer)]) {
    if (node?.closest(EXCLUDED)) return null;
  }

  const text = normalizeText(sel.toString());
  if (!text || !/[\p{L}\p{N}]/u.test(text)) return null;
  if (!anchorRects(range)) return null;

  const block = findBlock(common, Math.min(text.length, 200));
  return {
    text,
    paragraph: paragraphAround(block, text),
    heading: headingFor(block, range),
    range: range.cloneRange(),
    touch,
    path,
  };
}

// ---- Positioning (imperative, so scrolling never re-renders) -----------
function anchorRects(range: Range): { first: DOMRect; last: DOMRect } | null {
  const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
  if (rects.length > 0) return { first: rects[0], last: rects[rects.length - 1] };
  const r = range.getBoundingClientRect();
  return r.width > 0 || r.height > 0 ? { first: r, last: r } : null;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(v, max));
}

function placeButton(el: HTMLElement, snap: Snapshot) {
  const a = anchorRects(snap.range);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!a || a.last.bottom < 0 || a.first.top > vh) {
    el.style.visibility = "hidden";
    return;
  }
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  // Desktop: above the first line. Touch: below the last line, clear of the
  // selection handles and the OS's own copy/paste menu.
  const above = a.first.top - h - GAP;
  const below = a.last.bottom + (snap.touch ? GAP + 14 : GAP);
  let top: number;
  let anchor: DOMRect;
  if (!snap.touch && above >= EDGE) {
    top = above;
    anchor = a.first;
  } else if (below + h <= vh - EDGE) {
    top = below;
    anchor = a.last;
  } else {
    top = clamp(above, EDGE, vh - h - EDGE);
    anchor = a.first;
  }
  el.style.top = `${top}px`;
  el.style.left = `${clamp(anchor.left + anchor.width / 2 - w / 2, EDGE, vw - w - EDGE)}px`;
  el.style.visibility = "visible";
}

function placePopup(el: HTMLElement, snap: Snapshot, last: { current: { top: number; left: number } | null }) {
  const a = anchorRects(snap.range);
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  let top: number;
  let left: number;
  if (a) {
    const below = a.last.bottom + GAP;
    const above = a.first.top - GAP - h;
    if (below + h <= vh - EDGE) {
      top = below;
      left = a.last.left + a.last.width / 2 - w / 2;
    } else if (above >= EDGE) {
      top = above;
      left = a.first.left + a.first.width / 2 - w / 2;
    } else {
      top = vh - h - EDGE;
      left = a.last.left + a.last.width / 2 - w / 2;
    }
  } else if (last.current) {
    // The anchored text left the DOM (page re-rendered): stay where we were.
    ({ top, left } = last.current);
  } else {
    top = (vh - h) / 2;
    left = (vw - w) / 2;
  }
  top = clamp(top, EDGE, Math.max(EDGE, vh - h - EDGE));
  left = clamp(left, EDGE, Math.max(EDGE, vw - w - EDGE));
  last.current = { top, left };
  el.style.top = `${top}px`;
  el.style.left = `${left}px`;
  el.style.visibility = "visible";
}

/** The model is asked for plain prose; strip stray Markdown just in case. */
function plain(text: string): string {
  return text.replace(/\*\*|__/g, "").replace(/^#{1,6}\s+/gm, "");
}

function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

// ---- Component ---------------------------------------------------------
export function ExplainSelection({ endpoint = "/api/explain" }: { endpoint?: string }) {
  const mounted = useMounted();
  const pathname = usePathname();
  const [button, setButton] = useState<Snapshot | null>(null);
  const [popup, setPopup] = useState<Popup | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const popupPos = useRef<{ top: number; left: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const reqIdRef = useRef(0);
  const openRef = useRef<Popup | null>(null);
  const pathRef = useRef(pathname);

  useEffect(() => {
    openRef.current = popup;
  }, [popup]);

  // Navigation: drop the in-flight request; stale UI is hidden by the
  // `path` check at render time.
  useEffect(() => {
    pathRef.current = pathname;
    return () => abortRef.current?.abort();
  }, [pathname]);

  const close = useCallback(() => {
    abortRef.current?.abort();
    reqIdRef.current++;
    popupPos.current = null;
    setPopup(null);
  }, []);

  // ---- Selection tracking ----------------------------------------------
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let mouseDown = false;
    let touch = window.matchMedia("(pointer: coarse)").matches;

    function inUi(target: EventTarget | null) {
      return target instanceof Node && !!elementOf(target)?.closest("[data-explain-ui]");
    }

    function evaluate() {
      if (mouseDown) return;
      const snap = readSelection(touch, pathRef.current);
      if (!snap) {
        setButton(null);
        return;
      }
      const open = openRef.current;
      if (open && open.snap.text === snap.text && open.snap.paragraph === snap.paragraph) {
        // Same passage the popup already explains.
        setButton(null);
        return;
      }
      if (open) {
        // A new selection supersedes the current explanation.
        abortRef.current?.abort();
        reqIdRef.current++;
        popupPos.current = null;
        setPopup(null);
      }
      setButton(snap);
    }

    function schedule(ms: number) {
      clearTimeout(timer);
      timer = setTimeout(evaluate, ms);
    }

    function onPointerDown(e: PointerEvent) {
      touch = e.pointerType !== "mouse";
      if (e.pointerType === "mouse" && e.button === 0) mouseDown = true;
      if (inUi(e.target)) return;
      if (openRef.current) {
        abortRef.current?.abort();
        reqIdRef.current++;
        popupPos.current = null;
        setPopup(null);
      }
    }
    function onPointerUp(e: PointerEvent) {
      if (e.pointerType !== "mouse") return;
      mouseDown = false;
      if (!inUi(e.target)) schedule(10);
    }
    function onPointerCancel() {
      mouseDown = false;
    }
    // Long-press / handle drags on touch and keyboard selection only report
    // through selectionchange; wait for it to settle before showing the button.
    function onSelectionChange() {
      schedule(touch ? 450 : 200);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setButton(null);
        if (openRef.current) close();
      }
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", onPointerCancel, true);
    document.addEventListener("selectionchange", onSelectionChange);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", onPointerCancel, true);
      document.removeEventListener("selectionchange", onSelectionChange);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close]);

  // ---- Keep button/popup anchored -----------------------------------------
  const reposition = useCallback(() => {
    if (buttonRef.current && button) placeButton(buttonRef.current, button);
    if (popupRef.current && popup) placePopup(popupRef.current, popup.snap, popupPos);
  }, [button, popup]);

  useLayoutEffect(() => {
    reposition();
  }, [reposition]);

  useEffect(() => {
    if (!button && !popup) return;
    let frame = 0;
    const onMove = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(reposition);
    };
    // Capture: the app scrolls inside <main>, not the window.
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    window.visualViewport?.addEventListener("resize", onMove);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
      window.visualViewport?.removeEventListener("resize", onMove);
    };
  }, [button, popup, reposition]);

  // ---- Requests ------------------------------------------------------------
  const explain = useCallback(
    async (snap: Snapshot, mode: ExplainMode, previous?: string) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      const id = ++reqIdRef.current;
      const update = (patch: Partial<Popup>) =>
        setPopup((p) => (p && p.id === id ? { ...p, ...patch } : p));

      setPopup((p) => {
        // Keep the popup in place while it re-generates for the same passage.
        if (!p || p.snap !== snap) popupPos.current = null;
        return { id, snap, mode, previous, status: "loading", text: "" };
      });

      if (snap.text.length > MAX_SELECTION_CHARS) {
        update({
          status: "error",
          error: `Seçim çok uzun (${snap.text.length} karakter). En fazla ${MAX_SELECTION_CHARS} karakterlik bir bölüm seçin.`,
        });
        return;
      }

      const body: ExplainRequest = {
        text: snap.text,
        paragraph: snap.paragraph,
        heading: snap.heading,
        mode,
        previous,
      };
      const key = JSON.stringify(body);
      const hit = clientCache.get(key);
      if (hit) {
        update({ status: "done", text: hit });
        return;
      }
      if (!navigator.onLine) {
        update({ status: "error", error: "İnternet bağlantısı yok. Bağlantı gelince tekrar deneyin." });
        return;
      }

      const timeout = setTimeout(() => ctrl.abort("timeout"), REQUEST_TIMEOUT_MS);
      let acc = "";
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: key,
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const j = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new ExplainError(j?.error ?? `Açıklama alınamadı (${res.status}).`);
        }

        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buf = "";
        let finished = false;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += value;
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const raw = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!raw) continue;
            const ev = JSON.parse(raw) as ExplainEvent;
            if (ev.t === "delta") {
              acc += ev.v;
              update({ status: "streaming", text: acc });
            } else if (ev.t === "error") {
              throw new ExplainError(ev.v);
            } else {
              finished = true;
            }
          }
        }
        if (!finished) {
          throw new ExplainError("Bağlantı kesildi; açıklama tamamlanamadı.", true);
        }
        cacheResult(key, acc);
        update({ status: "done", text: acc });
      } catch (e) {
        if (id !== reqIdRef.current) return; // superseded by a newer request
        const timedOut = ctrl.signal.aborted && ctrl.signal.reason === "timeout";
        if (ctrl.signal.aborted && !timedOut) return; // closed by the user
        let message: string;
        let keep = false;
        if (e instanceof ExplainError) {
          message = e.message;
          keep = e.keepPartial;
        } else if (timedOut) {
          message = "Yanıt zaman aşımına uğradı. Tekrar deneyin.";
          keep = true;
        } else if (!navigator.onLine) {
          message = "İnternet bağlantısı kesildi. Bağlantı gelince tekrar deneyin.";
          keep = true;
        } else {
          message = "Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.";
          keep = true;
        }
        update({ status: "error", error: message, text: keep ? acc : "" });
      } finally {
        clearTimeout(timeout);
      }
    },
    [endpoint],
  );

  if (!mounted) return null;

  const visibleButton = button && button.path === pathname && !popup ? button : null;
  const visiblePopup = popup && popup.snap.path === pathname ? popup : null;
  const busy = visiblePopup?.status === "loading" || visiblePopup?.status === "streaming";
  const canRefine = visiblePopup?.status === "done" && !!visiblePopup.text;

  return createPortal(
    <>
      {visibleButton && (
        <button
          ref={buttonRef}
          type="button"
          data-explain-ui
          // Keep the page selection intact on desktop.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            const snap = visibleButton;
            setButton(null);
            void explain(snap, "default");
          }}
          style={{ position: "fixed", top: 0, left: 0, visibility: "hidden" }}
          className="no-print z-[110] rounded-md bg-[var(--foreground)] px-2.5 py-1 text-xs font-medium text-[var(--surface)] shadow-[var(--shadow-2)] hover:opacity-90"
        >
          Açıkla
        </button>
      )}

      {visiblePopup && (
        <div
          ref={popupRef}
          data-explain-ui
          role="dialog"
          aria-label="Seçili metnin açıklaması"
          // Buttons inside shouldn't collapse the page selection; text in the
          // body stays selectable for copying.
          onMouseDown={(e) => {
            if (!(e.target as Element).closest("[data-explain-body]")) e.preventDefault();
          }}
          style={{ position: "fixed", top: 0, left: 0, visibility: "hidden" }}
          className="no-print z-[110] flex max-h-[min(60vh,26rem)] w-[min(22rem,calc(100vw-16px))] flex-col rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--shadow-2)]"
        >
          <div className="flex items-start gap-2 border-b border-[var(--border)] px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                {MODE_LABEL[visiblePopup.mode]}
              </p>
              <p className="truncate text-xs text-[var(--muted)]" title={visiblePopup.snap.text}>
                “{visiblePopup.snap.text}”
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Kapat"
              className="-mr-1 rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              <CloseIcon size={12} />
            </button>
          </div>

          <div
            data-explain-body
            aria-live="polite"
            aria-busy={busy}
            className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5 text-sm leading-relaxed"
          >
            {visiblePopup.status === "loading" && (
              <p className="flex items-center gap-2 text-xs text-[var(--muted)]">
                <span
                  aria-hidden
                  className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-[var(--border-strong)] border-t-[var(--foreground)]"
                />
                Açıklanıyor…
              </p>
            )}
            {visiblePopup.text && (
              <p className="whitespace-pre-wrap">{plain(visiblePopup.text)}</p>
            )}
            {visiblePopup.status === "error" && (
              <p className={`text-xs text-[var(--muted)] ${visiblePopup.text ? "mt-2" : ""}`}>
                {visiblePopup.error}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--border)] px-3 py-2">
            {visiblePopup.status === "error" ? (
              <RefineButton
                onClick={() => void explain(visiblePopup.snap, visiblePopup.mode, visiblePopup.previous)}
              >
                Tekrar dene
              </RefineButton>
            ) : (
              <>
                <RefineButton
                  disabled={!canRefine}
                  onClick={() => void explain(visiblePopup.snap, "simpler", visiblePopup.text)}
                >
                  Daha Basit Açıkla
                </RefineButton>
                <RefineButton
                  disabled={!canRefine}
                  onClick={() => void explain(visiblePopup.snap, "detailed", visiblePopup.text)}
                >
                  Detaylandır
                </RefineButton>
              </>
            )}
            <span className="ml-auto text-[10px] text-[var(--muted)]">Yapay zekâ açıklaması</span>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}

function RefineButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-md border border-[var(--border-strong)] px-2 py-1 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-2)] disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
