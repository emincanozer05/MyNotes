"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createOrGetTag,
  deleteTag,
  getUserTags,
  type UserTag,
} from "@/app/(app)/tagsActions";
import { tagHighlightBg, TAG_COLOR_SWATCHES } from "@/lib/color";

type Accent = "amber" | "lime";

/** Fixed text-colour choices (no full palette) for the selection toolbar. */
const TEXT_COLORS = [
  { name: "Siyah", hex: "#111827" },
  { name: "Beyaz", hex: "#ffffff" },
  { name: "Kırmızı", hex: "#dc2626" },
  { name: "Turuncu", hex: "#ea580c" },
  { name: "Sarı", hex: "#ca8a04" },
  { name: "Yeşil", hex: "#16a34a" },
  { name: "Mavi", hex: "#2563eb" },
  { name: "Mor", hex: "#7c3aed" },
];

type SaveState = "idle" | "saving" | "saved" | "error";

/** HTML → plain text with line breaks kept, for the live translation call. */
function htmlToPlainText(html: string): string {
  const withBreaks = html.replace(/<(br|\/p|\/div|\/li|\/h[1-4])[^>]*>/gi, "$&\n");
  const div = document.createElement("div");
  div.innerHTML = withBreaks;
  return (div.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim();
}

/** Shared id for the marks born from one selection (see `data-tag-group`). */
function newTagGroupId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

type FloatingUI =
  | { kind: "select"; top: number; left: number; text: string }
  | { kind: "mark"; top: number; left: number; mark: HTMLElement };

/**
 * Reusable rich-text editor (book / course / article notes).
 *
 * Content is managed imperatively (innerHTML set once on mount) so React
 * re-renders never wipe what the user typed or the images they inserted.
 * Auto-saves (debounced) while typing, on blur, and flushes on unmount.
 * Images can be selected (overlay with resize handle + preset widths +
 * explicit delete) — clicking an image never deletes it.
 */
export function RichTextEditor({
  initialHtml,
  onSave,
  onChange,
  placeholder = "Buraya yazın… Biçimlendirin, görsel ekleyin.",
  accent = "amber",
  saveLabel = "Kaydet",
}: {
  initialHtml: string;
  onSave: (html: string) => Promise<{ error?: string | null }>;
  /** Fires on every content change (live), separate from the debounced save. */
  onChange?: (html: string) => void;
  placeholder?: string;
  accent?: Accent;
  saveLabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-save bookkeeping (refs so handlers always see the latest values).
  const latestHtmlRef = useRef(initialHtml);
  const lastSavedRef = useRef(initialHtml);
  const onSaveRef = useRef(onSave);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onSaveRef.current = onSave;
    onChangeRef.current = onChange;
  }, [onSave, onChange]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Image whose controls are shown (on hover) + overlay geometry.
  const selectedImg = useRef<HTMLImageElement | null>(null);
  const [box, setBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  // Hover bookkeeping: keep controls up while the pointer is over the image or
  // the overlay; hide after a short grace period so crossing the small gap
  // between them doesn't flicker. Suspended while a resize drag is in flight.
  const resizingRef = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Text tagging (select a passage -> tag it with a colour) ---------
  const [tags, setTags] = useState<UserTag[]>([]);
  const [floating, setFloating] = useState<FloatingUI | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLOR_SWATCHES[0]);
  const pendingRangeRef = useRef<Range | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void getUserTags().then(setTags);
  }, []);

  // Close the floating tag UI on outside clicks.
  useEffect(() => {
    if (!floating) return;
    function onDocMouseDown(ev: MouseEvent) {
      if (popoverRef.current?.contains(ev.target as Node)) return;
      setFloating(null);
      setPickerOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [floating]);

  const ringCls = accent === "lime" ? "ring-lime-500" : "ring-amber-500";
  const handleColor = accent === "lime" ? "#84cc16" : "#f59e0b";

  // ---- "Eng" live translation (language practice) -----------------------
  const [engOpen, setEngOpen] = useState(false);
  const [engText, setEngText] = useState("");
  const [engBusy, setEngBusy] = useState(false);
  const [engErr, setEngErr] = useState<string | null>(null);
  const engOpenRef = useRef(false);
  const engTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Monotonic id so a slow response never overwrites a newer translation.
  const engSeq = useRef(0);

  useEffect(() => {
    return () => {
      if (engTimer.current) clearTimeout(engTimer.current);
    };
  }, []);

  const translateNow = useCallback(async () => {
    const text = htmlToPlainText(ref.current?.innerHTML ?? latestHtmlRef.current);
    const seq = ++engSeq.current;
    if (!text) {
      setEngText("");
      setEngBusy(false);
      setEngErr(null);
      return;
    }
    setEngBusy(true);
    setEngErr(null);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, target: "en" }),
      });
      const data = (await res.json()) as { translated?: string; error?: string };
      if (seq !== engSeq.current) return;
      if (!res.ok) setEngErr(data.error ?? "Çeviri alınamadı.");
      else setEngText(data.translated ?? "");
    } catch {
      if (seq === engSeq.current) setEngErr("Çeviri servisine ulaşılamadı.");
    } finally {
      if (seq === engSeq.current) setEngBusy(false);
    }
  }, []);

  /** Debounced translation while typing; only runs when the panel is open. */
  const scheduleTranslate = useCallback(() => {
    if (!engOpenRef.current) return;
    if (engTimer.current) clearTimeout(engTimer.current);
    setEngBusy(true);
    engTimer.current = setTimeout(() => void translateNow(), 700);
  }, [translateNow]);

  function toggleEng() {
    const next = !engOpen;
    setEngOpen(next);
    engOpenRef.current = next;
    if (next) void translateNow();
    else if (engTimer.current) clearTimeout(engTimer.current);
  }

  // ---- Content persistence (imperative, mount-only) --------------------
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== initialHtml) {
      ref.current.innerHTML = initialHtml;
    }
    // Mark images already in the saved content so their layout is preserved;
    // only freshly inserted images get the default text-wrap float.
    ref.current
      ?.querySelectorAll<HTMLImageElement>("img")
      .forEach((img) => (img.dataset.init = "1"));
    latestHtmlRef.current = initialHtml;
    lastSavedRef.current = initialHtml;
    // Only on mount; later prop changes must not wipe user edits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSave = useCallback(async () => {
    const html = ref.current?.innerHTML ?? latestHtmlRef.current;
    latestHtmlRef.current = html;
    if (html === lastSavedRef.current) return;
    setSaveState("saving");
    setError(null);
    const res = await onSaveRef.current(html);
    if (res?.error) {
      setSaveState("error");
      setError(res.error);
    } else {
      lastSavedRef.current = html;
      setSaveState("saved");
      setSavedAt(new Date().toLocaleTimeString("tr-TR"));
    }
  }, []);

  const scheduleSave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void doSave(), 900);
  }, [doSave]);

  function handleInput() {
    const html = ref.current?.innerHTML ?? "";
    latestHtmlRef.current = html;
    onChangeRef.current?.(html);
    setSaveState("saving");
    scheduleSave();
    scheduleTranslate();
  }

  // Flush the pending save when leaving (e.g. switching title tabs).
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (latestHtmlRef.current !== lastSavedRef.current) {
        void onSaveRef.current(latestHtmlRef.current);
      }
    };
  }, []);

  // ---- Formatting ------------------------------------------------------
  /**
   * Formatting from the floating selection toolbar. Restores the captured
   * range first so actions that steal focus (colour pickers, link prompt)
   * still apply to the passage the user highlighted, then re-stores the
   * (possibly new) selection so several tweaks can be chained.
   */
  function execOnSelection(command: string, value?: string) {
    const sel = window.getSelection();
    const range = pendingRangeRef.current;
    if (sel && range) {
      ref.current?.focus();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    try {
      document.execCommand("styleWithCSS", false, "true");
    } catch {
      /* not all browsers support styleWithCSS */
    }
    document.execCommand(command, false, value);
    // The panel is docked in the margin, so it doesn't need to follow the
    // selection; just keep the range current for chained edits.
    const after = window.getSelection();
    if (after && after.rangeCount > 0) {
      pendingRangeRef.current = after.getRangeAt(0).cloneRange();
    }
    handleInput();
  }

  function addLinkToSelection() {
    const url = window.prompt("Bağlantı URL'si (https://…):");
    if (url) execOnSelection("createLink", url);
  }

  // Reset text colour to the default: colour the selection with a sentinel then
  // strip it, so the text inherits the theme's foreground again (instead of a
  // hard-coded colour that wouldn't adapt to light/dark).
  function clearForeColor() {
    const sel = window.getSelection();
    const range = pendingRangeRef.current;
    if (!sel || !range) return;
    ref.current?.focus();
    sel.removeAllRanges();
    sel.addRange(range);
    try {
      document.execCommand("styleWithCSS", false, "true");
    } catch {
      /* not all browsers support styleWithCSS */
    }
    document.execCommand("foreColor", false, "rgb(1, 1, 1)");
    ref.current?.querySelectorAll('[style*="rgb(1, 1, 1)"]').forEach((el) => {
      const e = el as HTMLElement;
      e.style.color = "";
      if (!e.getAttribute("style")) e.replaceWith(...e.childNodes);
    });
    const after = window.getSelection();
    if (after && after.rangeCount > 0) {
      pendingRangeRef.current = after.getRangeAt(0).cloneRange();
    }
    handleInput();
  }

  // execCommand("fontSize") only supports the 1–7 HTML scale, so we mark the
  // selection with size 7 then rewrite those <font> tags to an exact pt size.
  function replaceFontSevenWith(pt: number) {
    ref.current?.querySelectorAll('font[size="7"]').forEach((f) => {
      const span = document.createElement("span");
      span.style.fontSize = `${pt}pt`;
      while (f.firstChild) span.appendChild(f.firstChild);
      f.replaceWith(span);
    });
  }

  function applyPtSizeOnSelection(pt: number) {
    const sel = window.getSelection();
    const range = pendingRangeRef.current;
    if (sel && range) {
      ref.current?.focus();
      sel.removeAllRanges();
      sel.addRange(range);
    }
    try {
      document.execCommand("styleWithCSS", false, "false");
    } catch {
      /* not all browsers support styleWithCSS */
    }
    document.execCommand("fontSize", false, "7");
    replaceFontSevenWith(pt);
    handleInput();
  }

  // ---- Images ----------------------------------------------------------
  const measure = useCallback(() => {
    const img = selectedImg.current;
    const container = containerRef.current;
    if (!img || !container) {
      setBox(null);
      return;
    }
    const ir = img.getBoundingClientRect();
    const cr = container.getBoundingClientRect();
    setBox({
      left: ir.left - cr.left,
      top: ir.top - cr.top,
      width: ir.width,
      height: ir.height,
    });
  }, []);

  function selectImage(img: HTMLImageElement | null) {
    selectedImg.current = img;
    if (img) measure();
    else setBox(null);
  }

  /**
   * New images default to a left float at ~45% width so the user can type
   * right beside them (text wraps) without hunting for an alignment button.
   * Already-saved images (marked data-init on mount) are left as they are.
   */
  function styleNewImages() {
    ref.current
      ?.querySelectorAll<HTMLImageElement>("img:not([data-init])")
      .forEach((img) => {
        img.dataset.init = "1";
        img.style.float = "left";
        img.style.display = "inline";
        img.style.marginRight = "1rem";
        img.style.marginTop = "0.2rem";
        img.style.marginBottom = "0.4rem";
        if (!img.style.width) img.style.width = "45%";
      });
  }

  function insertImageFromDataUrl(dataUrl: string) {
    ref.current?.focus();
    document.execCommand("insertImage", false, dataUrl);
    styleNewImages();
    handleInput();
  }

  function insertImageFromFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => insertImageFromDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  }


  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          insertImageFromFile(file);
          return;
        }
      }
    }
  }

  function cancelHide() {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }

  // ---- Text tagging ------------------------------------------------------
  // Dock the format toolbar in the margin beside the editor (to the right when
  // there's room, otherwise left), vertically near the selection — so it never
  // covers the text or jumps around horizontally as it did over the selection.
  function panelPosition(rect: DOMRect): { top: number; left: number } {
    const PANEL_W = 176;
    const GAP = 10;
    const cont = containerRef.current?.getBoundingClientRect();
    const vw = window.innerWidth;
    let left: number;
    if (cont && vw - cont.right >= PANEL_W + GAP) {
      left = cont.right + GAP;
    } else if (cont && cont.left >= PANEL_W + GAP) {
      left = cont.left - PANEL_W - GAP;
    } else {
      left = Math.max(8, Math.min(rect.left, vw - PANEL_W - 8));
    }
    const top = Math.max(8, Math.min(rect.top, window.innerHeight - 340));
    return { top, left };
  }

  function handleSelectionUp() {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed || text.length < 2) return;
    const range = sel.getRangeAt(0);
    if (!ref.current?.contains(range.commonAncestorContainer)) return;
    const rect = range.getBoundingClientRect();
    pendingRangeRef.current = range.cloneRange();
    setPickerOpen(false);
    setFloating({ kind: "select", ...panelPosition(rect), text });
  }

  function createMarkEl(tag: UserTag, groupId: string): HTMLElement {
    const mark = document.createElement("mark");
    mark.className = "tag-mark";
    mark.dataset.tagId = tag.id;
    mark.dataset.tagName = tag.name;
    mark.dataset.tagColor = tag.color ?? "#78716c";
    // Marks born from the same selection share a group id, so the post-it
    // board can show the whole selection as a single passage.
    mark.dataset.tagGroup = groupId;
    mark.style.backgroundColor = tagHighlightBg(tag.color);
    mark.style.color = "#fff";
    return mark;
  }

  /** Closest block-level ancestor of `node` inside the editor (or the root). */
  function blockAncestor(node: Node, root: HTMLElement): Node {
    const BLOCKS = new Set([
      "P", "DIV", "LI", "UL", "OL",
      "H1", "H2", "H3", "H4",
      "BLOCKQUOTE", "TABLE", "TR", "TD", "TH", "PRE",
    ]);
    let cur: Node | null = node.parentNode;
    while (cur && cur !== root) {
      if (cur.nodeType === Node.ELEMENT_NODE && BLOCKS.has((cur as HTMLElement).tagName)) {
        return cur;
      }
      cur = cur.parentNode;
    }
    return root;
  }

  /**
   * Wraps the selection in tag `<mark>`s without disturbing the document
   * structure. A selection can span several paragraphs / list items (double- or
   * triple-click), and `extractContents` on such a range rips the `<li>`/`<p>`
   * blocks out of place — leaving empty bullets and shifted lines. Instead the
   * covered text is wrapped per block: each paragraph or list item gets its own
   * inline `<mark>`, empty lines are skipped, and text already tagged is left
   * with its existing tag.
   */
  function applyTagToSelection(tag: UserTag) {
    const range = pendingRangeRef.current;
    const root = ref.current;
    if (!range || !root) return;

    // Trim the boundary text nodes so only the selected slice is wrapped.
    if (
      range.endContainer.nodeType === Node.TEXT_NODE &&
      range.endOffset < (range.endContainer as Text).length
    ) {
      (range.endContainer as Text).splitText(range.endOffset);
    }
    if (range.startContainer.nodeType === Node.TEXT_NODE && range.startOffset > 0) {
      const rest = (range.startContainer as Text).splitText(range.startOffset);
      range.setStart(rest, 0);
    }

    // Walk the covered, non-empty text nodes and group the consecutive ones
    // that share a block: one <mark> per paragraph / list item. Text already
    // inside a tag mark keeps its existing tag — and also splits the group, so
    // the new mark is laid around the old one instead of swallowing it.
    const scopeNode = range.commonAncestorContainer;
    const scope =
      scopeNode.nodeType === Node.TEXT_NODE ? scopeNode.parentNode ?? root : scopeNode;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    const groups: Text[][] = [];
    let lastBlock: Node | null = null;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n as Text;
      if (!t.data.trim()) continue;
      const r = document.createRange();
      r.selectNodeContents(t);
      const covered =
        range.compareBoundaryPoints(Range.START_TO_START, r) <= 0 &&
        range.compareBoundaryPoints(Range.END_TO_END, r) >= 0;
      if (!covered) continue;
      if ((t.parentElement as HTMLElement | null)?.closest("mark.tag-mark")) {
        lastBlock = null;
        continue;
      }
      const block = blockAncestor(t, root);
      if (block !== lastBlock) {
        groups.push([]);
        lastBlock = block;
      }
      groups[groups.length - 1].push(t);
    }

    const groupId = newTagGroupId();
    for (const group of groups) {
      const r = document.createRange();
      r.setStartBefore(group[0]);
      r.setEndAfter(group[group.length - 1]);
      const mark = createMarkEl(tag, groupId);
      mark.appendChild(r.extractContents());
      r.insertNode(mark);
    }

    window.getSelection()?.removeAllRanges();
    pendingRangeRef.current = null;
    setFloating(null);
    setPickerOpen(false);
    handleInput();
    // Save right away instead of waiting for the debounce, so the tag (and
    // the post-it colour it drives) is persisted as soon as it's applied.
    void doSave();
  }

  async function handleCreateTag() {
    const name = newTagName.trim();
    if (!name) return;
    const res = await createOrGetTag(name, newTagColor);
    if (res.tag) {
      const created = res.tag;
      setTags((prev) =>
        prev.some((t) => t.id === created.id)
          ? prev
          : [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "tr")),
      );
      setNewTagName("");
      applyTagToSelection(created);
    }
  }

  async function handleDeleteTag(tagId: string) {
    if (!window.confirm("Bu etiket tamamen silinsin mi? Tüm notlardan kaldırılır.")) return;
    await deleteTag(tagId);
    setTags((prev) => prev.filter((t) => t.id !== tagId));
  }

  function removeMark(mark: HTMLElement) {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    setFloating(null);
    handleInput();
    void doSave();
  }

  function scheduleHide() {
    cancelHide();
    hideTimer.current = setTimeout(() => selectImage(null), 160);
  }

  // Show the resize/align controls when the pointer is over an image (or over
  // the controls themselves); hide them otherwise. Replaces click-to-select.
  function handleEditorHover(e: React.MouseEvent) {
    if (resizingRef.current) return;
    const t = e.target as HTMLElement;
    if (t.tagName === "IMG") {
      cancelHide();
      if (selectedImg.current !== (t as HTMLImageElement)) {
        selectImage(t as HTMLImageElement);
      }
      return;
    }
    if (t.closest?.("[data-img-overlay]")) {
      cancelHide();
      return;
    }
    if (selectedImg.current) scheduleHide();
  }

  function deleteSelectedImage() {
    const img = selectedImg.current;
    if (!img) return;
    img.remove();
    selectImage(null);
    handleInput();
  }

  // Left/right float so surrounding text wraps beside the image; center is a
  // plain centred block (no wrapping).
  function setImageAlign(align: "left" | "center" | "right") {
    const img = selectedImg.current;
    if (!img) return;
    if (align === "center") {
      img.style.float = "none";
      img.style.display = "block";
      img.style.marginLeft = "auto";
      img.style.marginRight = "auto";
      img.style.marginTop = "0.5rem";
      img.style.marginBottom = "0.5rem";
    } else {
      img.style.float = align;
      img.style.display = "inline";
      img.style.marginLeft = align === "right" ? "1rem" : "0";
      img.style.marginRight = align === "left" ? "1rem" : "0";
      img.style.marginTop = "0.2rem";
      img.style.marginBottom = "0.4rem";
    }
    measure();
    handleInput();
  }

  // Drag an edge/corner handle to resize the selected image (Notion-style).
  // `anchor` is the fixed side: dragging the right/corner handle grows the
  // width with the cursor; the left handle grows it the opposite way.
  function startResize(e: React.PointerEvent, anchor: "left" | "right") {
    e.preventDefault();
    e.stopPropagation();
    const img = selectedImg.current;
    const container = containerRef.current;
    if (!img || !container) return;
    const startX = e.clientX;
    const startWidth = img.getBoundingClientRect().width;
    const maxWidth = ref.current?.clientWidth ?? container.clientWidth;
    const dir = anchor === "left" ? -1 : 1;
    resizingRef.current = true;
    cancelHide();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    function onMove(ev: PointerEvent) {
      const delta = (ev.clientX - startX) * dir;
      const next = Math.max(48, Math.min(maxWidth, startWidth + delta));
      img!.style.width = `${Math.round(next)}px`;
      img!.style.height = "auto";
      measure();
    }
    function onUp() {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      resizingRef.current = false;
      handleInput();
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function setImageWidthPct(pct: number) {
    const img = selectedImg.current;
    if (!img) return;
    img.style.width = `${pct}%`;
    img.style.height = "auto";
    measure();
    handleInput();
  }

  // Keep the overlay aligned while the editor scrolls or the window resizes.
  useEffect(() => {
    if (!box) return;
    const onScrollResize = () => measure();
    window.addEventListener("resize", onScrollResize);
    const main = document.querySelector("main");
    main?.addEventListener("scroll", onScrollResize, { passive: true });
    return () => {
      window.removeEventListener("resize", onScrollResize);
      main?.removeEventListener("scroll", onScrollResize);
    };
  }, [box, measure]);

  const statusEl =
    saveState === "saving" ? (
      <span className="text-xs text-stone-400">Kaydediliyor…</span>
    ) : saveState === "error" ? (
      <span className="text-xs text-rose-600 dark:text-rose-400">
        {error ?? "Kaydedilemedi"}
      </span>
    ) : saveState === "saved" && savedAt ? (
      <span className="text-xs text-emerald-600 dark:text-emerald-400">
        ✓ Otomatik kaydedildi · {savedAt}
      </span>
    ) : (
      <span className="text-xs text-stone-400">Değişiklikler otomatik kaydedilir</span>
    );

  return (
    <div className="glass-card rounded-2xl p-4">
      {/* Top-right: live English translation toggle (language practice) */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={toggleEng}
          title="Yazdığın metni anlık olarak İngilizceye çevir (dil pratiği)"
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
            engOpen
              ? "border-sky-500/50 bg-sky-500/10 text-sky-700 dark:text-sky-300"
              : "border-[var(--border)] text-stone-500 hover:bg-stone-500/10"
          }`}
        >
          🇬🇧 Eng {engOpen ? "▴" : "▾"}
        </button>
      </div>

      {/* Editable area + resize overlay */}
      <div
        ref={containerRef}
        className="relative"
        onMouseMove={handleEditorHover}
        onMouseUp={handleSelectionUp}
        onMouseLeave={() => {
          if (!resizingRef.current) scheduleHide();
        }}
      >
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={handleInput}
          onBlur={() => void doSave()}
          onPaste={handlePaste}
          onClick={(e) => {
            // Click never deletes; it just keeps controls up for the image.
            const t = e.target as HTMLElement;
            if (t.tagName === "IMG") {
              e.preventDefault();
              cancelHide();
              selectImage(t as HTMLImageElement);
              return;
            }
            const mark = t.closest?.(".tag-mark") as HTMLElement | null;
            if (mark) {
              e.preventDefault();
              const rect = mark.getBoundingClientRect();
              setPickerOpen(false);
              setFloating({ kind: "mark", top: rect.top - 42, left: rect.left, mark });
            }
          }}
          className="rte mt-3 rounded-lg text-[11pt] focus:outline-none"
        />

        {box && (
          <div data-img-overlay>
            {/* selection frame */}
            <div
              className={`pointer-events-none absolute rounded ring-2 ${ringCls}`}
              style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
            />
            {/* toolbar above image: align + preset widths + delete */}
            <div
              className="absolute z-10 flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 shadow-md"
              style={{ left: box.left, top: Math.max(0, box.top - 34) }}
              onMouseDown={(e) => e.preventDefault()}
            >
              {(
                [
                  { a: "left", icon: "⇤", title: "Sola yasla — metin sağdan sarar" },
                  { a: "center", icon: "↔", title: "Ortala (metin sarmaz)" },
                  { a: "right", icon: "⇥", title: "Sağa yasla — metin soldan sarar" },
                ] as const
              ).map(({ a, icon, title }) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setImageAlign(a)}
                  title={title}
                  className="rounded px-1 text-xs text-stone-500 hover:bg-stone-500/15"
                >
                  {icon}
                </button>
              ))}
              <span className="mx-0.5 h-3 w-px bg-[var(--border)]" />
              {[25, 50, 75, 100].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setImageWidthPct(p)}
                  className="rounded px-1.5 text-[10px] font-bold text-stone-500 hover:bg-stone-500/15"
                >
                  {p}%
                </button>
              ))}
              <span className="mx-0.5 h-3 w-px bg-[var(--border)]" />
              <button
                type="button"
                onClick={deleteSelectedImage}
                title="Görseli sil"
                className="rounded px-1 text-[11px] text-stone-500 hover:bg-rose-500/15 hover:text-rose-600"
              >
                🗑
              </button>
            </div>
            {/* left edge handle */}
            <div
              onPointerDown={(e) => startResize(e, "left")}
              title="Kenardan sürükleyerek boyutlandır"
              className="absolute z-10 flex h-9 w-3 cursor-ew-resize items-center justify-center"
              style={{ left: box.left - 6, top: box.top + box.height / 2 - 18 }}
            >
              <span
                className="h-8 w-1.5 rounded-full border border-white shadow"
                style={{ background: handleColor }}
              />
            </div>
            {/* right edge handle */}
            <div
              onPointerDown={(e) => startResize(e, "right")}
              title="Kenardan sürükleyerek boyutlandır"
              className="absolute z-10 flex h-9 w-3 cursor-ew-resize items-center justify-center"
              style={{ left: box.left + box.width - 6, top: box.top + box.height / 2 - 18 }}
            >
              <span
                className="h-8 w-1.5 rounded-full border border-white shadow"
                style={{ background: handleColor }}
              />
            </div>
            {/* corner handle (bottom-right, diagonal) */}
            <div
              onPointerDown={(e) => startResize(e, "right")}
              className="absolute z-10 h-3.5 w-3.5 cursor-nwse-resize rounded-full border-2 border-white shadow"
              style={{
                left: box.left + box.width - 7,
                top: box.top + box.height - 7,
                background: handleColor,
              }}
            />
          </div>
        )}
      </div>

      {floating && (
        <div
          ref={popoverRef}
          style={{ position: "fixed", top: floating.top, left: floating.left, zIndex: 50 }}
        >
          {floating.kind === "mark" ? (
            <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1 shadow-lg">
              <span
                className="rounded-full px-2 py-0.5 text-xs font-semibold text-white"
                style={{ background: floating.mark.dataset.tagColor || "#78716c" }}
              >
                🏷 {floating.mark.dataset.tagName}
              </span>
              <button
                type="button"
                onClick={() => removeMark(floating.mark)}
                title="Etiketi kaldır"
                className="rounded-full px-1.5 text-xs text-stone-500 hover:bg-rose-500/15 hover:text-rose-600"
              >
                🗑 Kaldır
              </button>
            </div>
          ) : !pickerOpen ? (
            <div className="flex w-44 flex-wrap items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-xl">
              {(
                [
                  { cmd: "bold", label: <b>B</b>, title: "Kalın" },
                  { cmd: "italic", label: <i>I</i>, title: "İtalik" },
                  { cmd: "underline", label: <u>U</u>, title: "Altı çizili" },
                  { cmd: "strikeThrough", label: <s>S</s>, title: "Üstü çizili" },
                ] as const
              ).map((b) => (
                <button
                  key={b.cmd}
                  type="button"
                  title={b.title}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => execOnSelection(b.cmd)}
                  className="flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-sm hover:bg-stone-500/15"
                >
                  {b.label}
                </button>
              ))}

              <span className="my-0.5 h-px w-full bg-[var(--border)]" />

              {(
                [
                  { pt: 8, cls: "text-[10px]" },
                  { pt: 11, cls: "text-xs" },
                  { pt: 14, cls: "text-sm" },
                  { pt: 16, cls: "text-base" },
                  { pt: 18, cls: "text-lg" },
                ] as const
              ).map((s) => (
                <button
                  key={s.pt}
                  type="button"
                  title={`Boyut: ${s.pt}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => applyPtSizeOnSelection(s.pt)}
                  className={`flex h-7 min-w-6 items-center justify-center rounded px-1 font-semibold leading-none hover:bg-stone-500/15 ${s.cls}`}
                >
                  {s.pt}
                </button>
              ))}

              <span className="my-0.5 h-px w-full bg-[var(--border)]" />

              {(
                [
                  { cmd: "formatBlock", arg: "BLOCKQUOTE", label: "❝", title: "Alıntı" },
                  { cmd: "insertUnorderedList", label: "•", title: "Madde listesi" },
                  { cmd: "insertOrderedList", label: "1.", title: "Numaralı liste" },
                ] as const
              ).map((b) => (
                <button
                  key={b.label}
                  type="button"
                  title={b.title}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => execOnSelection(b.cmd, "arg" in b ? b.arg : undefined)}
                  className="flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-sm hover:bg-stone-500/15"
                >
                  {b.label}
                </button>
              ))}

              <span className="my-0.5 h-px w-full bg-[var(--border)]" />

              {(
                [
                  { cmd: "justifyLeft", label: "⇤", title: "Sola yasla" },
                  { cmd: "justifyRight", label: "⇥", title: "Sağa yasla" },
                  { cmd: "justifyFull", label: "☰", title: "İki yana yasla" },
                ] as const
              ).map((a) => (
                <button
                  key={a.cmd}
                  type="button"
                  title={a.title}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => execOnSelection(a.cmd)}
                  className="flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-sm hover:bg-stone-500/15"
                >
                  {a.label}
                </button>
              ))}

              <span className="my-0.5 h-px w-full bg-[var(--border)]" />

              {TEXT_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  title={`Yazı rengi: ${c.name}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => execOnSelection("foreColor", c.hex)}
                  className="h-5 w-5 shrink-0 rounded-full border border-black/20"
                  style={{ background: c.hex }}
                />
              ))}
              <button
                type="button"
                title="Rengi kaldır (varsayılan)"
                onMouseDown={(e) => e.preventDefault()}
                onClick={clearForeColor}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-black/20 text-[11px] leading-none text-stone-500 hover:bg-stone-500/15"
              >
                ⦸
              </button>

              <label
                title="Vurgu (fon) rengi"
                className="flex h-7 cursor-pointer items-center gap-0.5 rounded px-1 hover:bg-stone-500/15"
              >
                <span className="text-sm">🖍</span>
                <input
                  type="color"
                  onChange={(e) => execOnSelection("hiliteColor", e.target.value)}
                  className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
                />
              </label>

              <span className="my-0.5 h-px w-full bg-[var(--border)]" />

              <button
                type="button"
                title="Bağlantı ekle"
                onMouseDown={(e) => e.preventDefault()}
                onClick={addLinkToSelection}
                className="flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-sm hover:bg-stone-500/15"
              >
                🔗
              </button>
              <button
                type="button"
                title="Etiket ekle"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setPickerOpen(true)}
                className="flex h-7 items-center justify-center gap-1 rounded bg-stone-900 px-2 text-xs font-semibold text-white hover:opacity-90 dark:bg-stone-100 dark:text-stone-900"
              >
                🏷
              </button>
            </div>
          ) : (
            <div className="w-64 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xl">
              {tags.length > 0 && (
                <div className="mb-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto pt-1.5 pr-1.5">
                  {tags.map((t) => (
                    <span key={t.id} className="relative inline-flex">
                      <button
                        type="button"
                        onClick={() => applyTagToSelection(t)}
                        className="rounded-full px-2 py-0.5 text-xs font-medium text-white shadow-sm"
                        style={{ background: t.color ?? "#78716c" }}
                      >
                        {t.name}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleDeleteTag(t.id)}
                        title="Etiketi sil"
                        aria-label={`${t.name} etiketini sil`}
                        className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full border border-[var(--surface)] bg-stone-500 text-[9px] leading-none text-white hover:bg-rose-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="mb-1.5 flex flex-wrap gap-1 border-t border-[var(--border)] pt-2">
                {TAG_COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => setNewTagColor(c)}
                    className={`h-5 w-5 rounded-full ${newTagColor === c ? "ring-2 ring-offset-1 ring-stone-500" : ""}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={newTagColor}
                  onChange={(e) => setNewTagColor(e.target.value)}
                  className="h-7 w-7 shrink-0 cursor-pointer border-0 bg-transparent p-0"
                  title="Özel renk"
                />
                <input
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleCreateTag();
                    }
                  }}
                  placeholder="Yeni etiket adı…"
                  className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-transparent px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={() => void handleCreateTag()}
                  className="shrink-0 rounded-md bg-stone-900 dark:bg-stone-100 px-2 py-1 text-xs font-semibold text-white dark:text-stone-900"
                >
                  Ekle
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {engOpen && (
        <div className="animate-in mt-3 rounded-xl border border-sky-500/30 bg-sky-400/5 p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">
              English · anlık çeviri
            </p>
            {engBusy && (
              <span className="text-[11px] text-stone-400">Çevriliyor…</span>
            )}
          </div>
          {engErr ? (
            <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">
              {engErr}
            </p>
          ) : (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-700 dark:text-stone-300">
              {engText || "Yazmaya başla — çeviri burada görünecek."}
            </p>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-3 border-t border-[var(--border)] pt-3">
        <button
          type="button"
          onClick={() => void doSave()}
          className="rounded-full border border-[var(--border)] px-4 py-1.5 text-sm font-semibold transition-colors hover:bg-stone-500/10"
        >
          {saveLabel}
        </button>
        {statusEl}
        <span className="ml-auto hidden text-[11px] text-stone-400 sm:block">
          Görselin üzerine gel → hizala (⇤ ↔ ⇥) · kenardan sürükle veya %25–100 · 🗑 sil
        </span>
      </div>
    </div>
  );
}
