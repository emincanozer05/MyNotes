"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";

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

function ToolBtn({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      // Prevent the editor from losing its selection on mousedown.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex h-8 min-w-8 items-center justify-center rounded-md border border-[var(--border)] px-2 text-sm font-medium transition-colors hover:bg-amber-500/15"
    >
      {children}
    </button>
  );
}

/**
 * Rich-text (contentEditable) editor with formatting toolbar, image upload /
 * paste, and Notion-style drag-to-resize handles on images. Shared by the
 * book and article summary editors.
 */
export function RichTextEditor({
  initialHtml,
  onSave,
  accent = "amber",
  placeholder = "Buraya yazın… Biçimlendirin, görsel ekleyin.",
}: {
  initialHtml: string;
  onSave: (html: string) => Promise<{ error: string | null }>;
  accent?: "amber" | "lime";
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Currently selected image (held in a ref so we can mutate its style) plus a
  // boolean to drive rendering and the live handle position (wrapper coords).
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [selected, setSelected] = useState(false);
  const [handle, setHandle] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ startX: number; startWidth: number } | null>(null);

  const positionHandle = useCallback(() => {
    const img = imgRef.current;
    const wrap = wrapRef.current;
    if (!img || !wrap) {
      setHandle(null);
      return;
    }
    const ir = img.getBoundingClientRect();
    const wr = wrap.getBoundingClientRect();
    setHandle({ x: ir.right - wr.left, y: ir.bottom - wr.top });
  }, []);

  // Keep the handle glued to the image on scroll / resize.
  useLayoutEffect(() => {
    if (selected) positionHandle();
  }, [selected, positionHandle]);

  useEffect(() => {
    if (!selected) return;
    const update = () => positionHandle();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [selected, positionHandle]);

  function exec(command: string, value?: string) {
    ref.current?.focus();
    try {
      document.execCommand("styleWithCSS", false, "true");
    } catch {
      /* not all browsers support styleWithCSS */
    }
    document.execCommand(command, false, value);
  }

  function insertImageDataUrl(dataUrl: string) {
    ref.current?.focus();
    document.execCommand("insertImage", false, dataUrl);
  }

  function insertImageFromFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => insertImageDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  }

  function insertImageFromUrl() {
    const url = window.prompt("Görsel URL'si:");
    if (url) exec("insertImage", url);
  }

  // Paste of an image from the clipboard -> embed it inline as a data URL.
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

  // Select the clicked image (or clear when clicking elsewhere).
  function handleEditorClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.tagName === "IMG") {
      imgRef.current = target as HTMLImageElement;
      setSelected(true);
    } else {
      imgRef.current = null;
      setSelected(false);
    }
    positionHandle();
  }

  function startResize(e: React.PointerEvent) {
    const img = imgRef.current;
    if (!img) return;
    e.preventDefault();
    drag.current = {
      startX: e.clientX,
      startWidth: img.getBoundingClientRect().width,
    };

    const move = (ev: PointerEvent) => {
      if (!drag.current || !imgRef.current) return;
      const maxW = ref.current?.clientWidth ?? 800;
      const next = Math.max(
        48,
        Math.min(maxW, drag.current.startWidth + (ev.clientX - drag.current.startX)),
      );
      imgRef.current.style.width = `${Math.round(next)}px`;
      imgRef.current.style.height = "auto";
      positionHandle();
    };
    const up = () => {
      drag.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function setImageWidth(pct: number) {
    const img = imgRef.current;
    if (!img) return;
    img.style.width = `${pct}%`;
    img.style.height = "auto";
    positionHandle();
  }

  function handleSave() {
    setError(null);
    const html = ref.current?.innerHTML ?? "";
    startTransition(async () => {
      const res = await onSave(html);
      if (res.error) setError(res.error);
      else setSavedAt(new Date().toLocaleTimeString("tr-TR"));
    });
  }

  const ring = accent === "lime" ? "focus:ring-lime-500" : "focus:ring-amber-500";

  return (
    <div className="glass-card rounded-2xl p-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border)] pb-3">
        <select
          title="Yazı tipi"
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => e.target.value && exec("fontName", e.target.value)}
          className={`h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm outline-none focus:ring-2 ${ring}`}
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
          className={`h-8 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 text-sm outline-none focus:ring-2 ${ring}`}
        >
          {SIZES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>

        <span className="mx-1 h-5 w-px bg-[var(--border)]" />

        <ToolBtn title="Kalın" onClick={() => exec("bold")}>
          <b>B</b>
        </ToolBtn>
        <ToolBtn title="İtalik" onClick={() => exec("italic")}>
          <i>I</i>
        </ToolBtn>
        <ToolBtn title="Altı çizili" onClick={() => exec("underline")}>
          <u>U</u>
        </ToolBtn>
        <ToolBtn title="Üstü çizili" onClick={() => exec("strikeThrough")}>
          <s>S</s>
        </ToolBtn>

        <span className="mx-1 h-5 w-px bg-[var(--border)]" />

        <ToolBtn title="Başlık" onClick={() => exec("formatBlock", "H2")}>
          H
        </ToolBtn>
        <ToolBtn title="Alıntı" onClick={() => exec("formatBlock", "BLOCKQUOTE")}>
          ❝
        </ToolBtn>
        <ToolBtn title="Madde listesi" onClick={() => exec("insertUnorderedList")}>
          •
        </ToolBtn>
        <ToolBtn title="Numaralı liste" onClick={() => exec("insertOrderedList")}>
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

        <ToolBtn title="Görsel yükle" onClick={() => fileRef.current?.click()}>
          🖼
        </ToolBtn>
        <ToolBtn title="Görsel URL" onClick={insertImageFromUrl}>
          🔗
        </ToolBtn>
        <ToolBtn title="Biçimi temizle" onClick={() => exec("removeFormat")}>
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

      {/* Selected-image size controls (Notion-like presets + drag handle below) */}
      {selected && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
          <span className="font-semibold">🖼 Görsel boyutu:</span>
          {[25, 50, 75, 100].map((p) => (
            <button
              key={p}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setImageWidth(p)}
              className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 font-medium transition-colors hover:bg-amber-500/20"
            >
              %{p}
            </button>
          ))}
          <span className="text-stone-500">
            veya köşedeki tutamağı sürükleyin
          </span>
        </div>
      )}

      {/* Editable area (wrapper is positioned so the resize handle can overlay) */}
      <div ref={wrapRef} className="relative">
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder}
          onClick={handleEditorClick}
          onPaste={handlePaste}
          className="rte mt-3 text-[15px]"
          dangerouslySetInnerHTML={{ __html: initialHtml }}
        />
        {selected && handle && (
          <div
            onPointerDown={startResize}
            title="Sürükleyerek yeniden boyutlandır"
            style={{ left: handle.x, top: handle.y }}
            className="absolute z-10 -ml-2 -mt-2 h-4 w-4 cursor-nwse-resize rounded-full border-2 border-white bg-amber-500 shadow-md"
          />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="btn-gradient rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60"
        >
          {pending ? "Kaydediliyor…" : "Özeti Kaydet"}
        </button>
        {savedAt && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">
            ✓ {savedAt}&apos;de kaydedildi
          </span>
        )}
        {error && (
          <span className="text-xs text-rose-600 dark:text-rose-400">{error}</span>
        )}
      </div>
    </div>
  );
}
