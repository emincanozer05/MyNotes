"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

  // Currently selected image (for resizing) + overlay geometry.
  const selectedImg = useRef<HTMLImageElement | null>(null);
  const [box, setBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

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

  function handleEditorClick(e: React.MouseEvent) {
    const t = e.target as HTMLElement;
    if (t.tagName === "IMG") {
      // Select for resizing; never delete on click.
      e.preventDefault();
      selectImage(t as HTMLImageElement);
    } else {
      selectImage(null);
    }
  }

  function deleteSelectedImage() {
    const img = selectedImg.current;
    if (!img) return;
    img.remove();
    selectImage(null);
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
      <div ref={containerRef} className="relative">
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onInput={handleInput}
          onBlur={() => void doSave()}
          onPaste={handlePaste}
          onClick={handleEditorClick}
          className={`rte mt-3 rounded-lg text-[15px] focus:outline-none focus:ring-2 ${ringCls}`}
        />

        {box && (
          <>
            {/* selection frame */}
            <div
              className={`pointer-events-none absolute rounded ring-2 ${ringCls}`}
              style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
            />
            {/* toolbar above image: preset widths + delete */}
            <div
              className="absolute z-10 flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 shadow-md"
              style={{ left: box.left, top: Math.max(0, box.top - 34) }}
              onMouseDown={(e) => e.preventDefault()}
            >
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
          </>
        )}
      </div>

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
          Görsele tıkla → köşeden sürükle veya %25–100 · 🗑 sil
        </span>
      </div>
    </div>
  );
}
