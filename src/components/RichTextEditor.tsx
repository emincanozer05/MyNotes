"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createOrGetTag,
  deleteTag,
  getUserTags,
  type UserTag,
} from "@/app/(app)/tagsActions";
import { tagHighlightBg, TAG_COLOR_SWATCHES } from "@/lib/color";

const FONTS = [
  { label: "Varsayılan", value: "" },
  { label: "Serif", value: "Georgia, serif" },
  { label: "Sans", value: "'Segoe UI', Arial, sans-serif" },
  { label: "Mono", value: "'Courier New', monospace" },
  { label: "Rounded", value: "'Comic Sans MS', 'Segoe UI', sans-serif" },
];

const SIZES = [
  { label: "XS", value: "1" },
  { label: "S", value: "2" },
  { label: "Normal", value: "3" },
  { label: "L", value: "4" },
  { label: "XL", value: "5" },
  { label: "2XL", value: "6" },
  { label: "3XL", value: "7" },
];

type Accent = "amber" | "lime";

function ToolBtn({
  onClick,
  title,
  accent,
  children,
}: {
  onClick: () => void;
  title: string;
  accent: Accent;
  children: React.ReactNode;
}) {
  const hover = accent === "lime" ? "hover:bg-lime-500/15" : "hover:bg-amber-500/15";
  return (
    <button
      type="button"
      title={title}
      // Prevent the editor from losing its selection on mousedown.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`flex h-8 min-w-8 items-center justify-center rounded-md border border-[var(--border)] px-2 text-sm font-medium transition-colors ${hover}`}
    >
      {children}
    </button>
  );
}

type SaveState = "idle" | "saving" | "saved" | "error";

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
  const fileRef = useRef<HTMLInputElement>(null);

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

  // ---- Content persistence (imperative, mount-only) --------------------
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== initialHtml) {
      ref.current.innerHTML = initialHtml;
    }
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
  function exec(command: string, value?: string) {
    ref.current?.focus();
    try {
      document.execCommand("styleWithCSS", false, "true");
    } catch {
      /* not all browsers support styleWithCSS */
    }
    document.execCommand(command, false, value);
    handleInput();
  }

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
    const after = window.getSelection();
    if (after && after.rangeCount > 0) {
      pendingRangeRef.current = after.getRangeAt(0).cloneRange();
      const rect = after.getRangeAt(0).getBoundingClientRect();
      // Keep the toolbar pinned above the (possibly reflowed) selection.
      if (rect.top || rect.left) {
        setFloating((f) =>
          f && f.kind === "select"
            ? { ...f, top: rect.top - 42, left: rect.left }
            : f,
        );
      }
    }
    handleInput();
  }

  function addLinkToSelection() {
    const url = window.prompt("Bağlantı URL'si (https://…):");
    if (url) execOnSelection("createLink", url);
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

  function insertImageFromDataUrl(dataUrl: string) {
    ref.current?.focus();
    document.execCommand("insertImage", false, dataUrl);
    handleInput();
  }

  function insertImageFromFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => insertImageFromDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  }

  function insertImageFromUrl() {
    const url = window.prompt("Görsel URL'si:");
    if (url) {
      exec("insertImage", url);
    }
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
  function handleSelectionUp() {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? "";
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed || text.length < 2) return;
    const range = sel.getRangeAt(0);
    if (!ref.current?.contains(range.commonAncestorContainer)) return;
    const rect = range.getBoundingClientRect();
    pendingRangeRef.current = range.cloneRange();
    setPickerOpen(false);
    setFloating({ kind: "select", top: rect.top - 42, left: rect.left, text });
  }

  function applyTagToSelection(tag: UserTag) {
    const range = pendingRangeRef.current;
    if (!range) return;

    const mark = document.createElement("mark");
    mark.className = "tag-mark";
    mark.dataset.tagId = tag.id;
    mark.dataset.tagName = tag.name;
    mark.dataset.tagColor = tag.color ?? "#78716c";
    mark.style.backgroundColor = tagHighlightBg(tag.color);
    mark.style.color = "#fff";
    try {
      range.surroundContents(mark);
    } catch {
      const frag = range.extractContents();
      mark.appendChild(frag);
      range.insertNode(mark);
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
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border)] pb-3">
        <select
          title="Yazı tipi"
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => e.target.value && exec("fontName", e.target.value)}
          className="h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm"
        >
          {FONTS.map((f) => (
            <option key={f.label} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        <select
          title="Yazı boyutu"
          defaultValue="3"
          onChange={(e) => exec("fontSize", e.target.value)}
          className="h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm"
        >
          {SIZES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <span className="mx-1 h-5 w-px bg-[var(--border)]" />

        <ToolBtn accent={accent} title="Kalın" onClick={() => exec("bold")}>
          <b>B</b>
        </ToolBtn>
        <ToolBtn accent={accent} title="İtalik" onClick={() => exec("italic")}>
          <i>I</i>
        </ToolBtn>
        <ToolBtn accent={accent} title="Altı çizili" onClick={() => exec("underline")}>
          <u>U</u>
        </ToolBtn>
        <ToolBtn accent={accent} title="Üstü çizili" onClick={() => exec("strikeThrough")}>
          <s>S</s>
        </ToolBtn>

        <span className="mx-1 h-5 w-px bg-[var(--border)]" />

        <ToolBtn accent={accent} title="Başlık" onClick={() => exec("formatBlock", "H2")}>
          H
        </ToolBtn>
        <ToolBtn accent={accent} title="Alıntı" onClick={() => exec("formatBlock", "BLOCKQUOTE")}>
          ❝
        </ToolBtn>
        <ToolBtn accent={accent} title="Madde listesi" onClick={() => exec("insertUnorderedList")}>
          •
        </ToolBtn>
        <ToolBtn accent={accent} title="Numaralı liste" onClick={() => exec("insertOrderedList")}>
          1.
        </ToolBtn>

        <span className="mx-1 h-5 w-px bg-[var(--border)]" />

        <label
          title="Metin rengi"
          className="flex h-8 cursor-pointer items-center rounded-md border border-[var(--border)] px-1.5"
        >
          <span className="text-sm">🎨</span>
          <input
            type="color"
            onChange={(e) => exec("foreColor", e.target.value)}
            className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
          />
        </label>
        <label
          title="Vurgu rengi"
          className="flex h-8 cursor-pointer items-center rounded-md border border-[var(--border)] px-1.5"
        >
          <span className="text-sm">🖍</span>
          <input
            type="color"
            onChange={(e) => exec("hiliteColor", e.target.value)}
            className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
          />
        </label>

        <span className="mx-1 h-5 w-px bg-[var(--border)]" />

        <ToolBtn accent={accent} title="Görsel yükle" onClick={() => fileRef.current?.click()}>
          🖼
        </ToolBtn>
        <ToolBtn accent={accent} title="Görsel URL" onClick={insertImageFromUrl}>
          🔗
        </ToolBtn>
        <ToolBtn accent={accent} title="Biçimi temizle" onClick={() => exec("removeFormat")}>
          ⌫
        </ToolBtn>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) insertImageFromFile(f);
            e.target.value = "";
          }}
        />
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
          className="rte mt-3 rounded-lg text-[15px] focus:outline-none"
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
            <div className="flex items-center gap-0.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-1 py-1 shadow-xl">
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

              <span className="mx-0.5 h-5 w-px bg-[var(--border)]" />

              {(
                [
                  { size: "2", label: "A", cls: "text-[11px]", title: "Küçük" },
                  { size: "3", label: "A", cls: "text-sm", title: "Normal" },
                  { size: "5", label: "A", cls: "text-lg", title: "Büyük" },
                ] as const
              ).map((s) => (
                <button
                  key={s.size}
                  type="button"
                  title={`Boyut: ${s.title}`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => execOnSelection("fontSize", s.size)}
                  className={`flex h-7 min-w-6 items-center justify-center rounded px-1 font-semibold leading-none hover:bg-stone-500/15 ${s.cls}`}
                >
                  {s.label}
                </button>
              ))}

              <button
                type="button"
                title="Başlık"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => execOnSelection("formatBlock", "H2")}
                className="flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-sm font-bold hover:bg-stone-500/15"
              >
                H
              </button>

              <span className="mx-0.5 h-5 w-px bg-[var(--border)]" />

              <label
                title="Yazı rengi"
                className="flex h-7 cursor-pointer items-center gap-0.5 rounded px-1 hover:bg-stone-500/15"
              >
                <span className="text-sm">🎨</span>
                <input
                  type="color"
                  onChange={(e) => execOnSelection("foreColor", e.target.value)}
                  className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
                />
              </label>
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

              <span className="mx-0.5 h-5 w-px bg-[var(--border)]" />

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
