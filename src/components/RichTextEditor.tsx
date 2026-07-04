"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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

/**
 * Reusable rich-text editor (book + article summaries).
 * Supports formatting, image upload/URL, image paste, and Notion-style
 * click-and-drag image resizing.
 */
export function RichTextEditor({
  initialHtml,
  onSave,
  placeholder = "Buraya yazın… Biçimlendirin, görsel ekleyin.",
  accent = "amber",
  saveLabel = "Kaydet",
}: {
  initialHtml: string;
  onSave: (html: string) => Promise<{ error?: string | null }>;
  placeholder?: string;
  accent?: Accent;
  saveLabel?: string;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Currently selected image (for resizing) + overlay geometry.
  const selectedImg = useRef<HTMLImageElement | null>(null);
  const [box, setBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const ringCls = accent === "lime" ? "ring-lime-500" : "ring-amber-500";
  const btnCls = accent === "lime" ? "bg-lime-400 text-stone-900 hover:bg-lime-300" : "btn-gradient text-white";

  function exec(command: string, value?: string) {
    ref.current?.focus();
    try {
      document.execCommand("styleWithCSS", false, "true");
    } catch {
      /* not all browsers support styleWithCSS */
    }
    document.execCommand(command, false, value);
  }

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
  }

  function insertImageFromFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => insertImageFromDataUrl(String(reader.result));
    reader.readAsDataURL(file);
  }

  function insertImageFromUrl() {
    const url = window.prompt("Görsel URL'si:");
    if (url) exec("insertImage", url);
  }

  // Paste handler: grab image files off the clipboard (screenshots, copied
  // images) and inline them as data URLs, like Notion.
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
      selectImage(t as HTMLImageElement);
    } else {
      selectImage(null);
    }
  }

  // Drag the bottom-right handle to resize the selected image.
  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    const img = selectedImg.current;
    const container = containerRef.current;
    if (!img || !container) return;
    const startX = e.clientX;
    const startWidth = img.getBoundingClientRect().width;
    const maxWidth = ref.current?.clientWidth ?? container.clientWidth;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    function onMove(ev: PointerEvent) {
      const next = Math.max(48, Math.min(maxWidth, startWidth + (ev.clientX - startX)));
      img!.style.width = `${Math.round(next)}px`;
      img!.style.height = "auto";
      measure();
    }
    function onUp(ev: PointerEvent) {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      void ev;
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

  function handleSave() {
    setError(null);
    const html = ref.current?.innerHTML ?? "";
    startTransition(async () => {
      const res = await onSave(html);
      if (res?.error) {
        setError(res.error);
      } else {
        setSavedAt(new Date().toLocaleTimeString("tr-TR"));
        // Refresh so server-rendered views of the summary (e.g. "Özeti oku")
        // reflect what was just saved.
        router.refresh();
      }
    });
  }

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
          onPaste={handlePaste}
          onClick={handleEditorClick}
          className={`rte mt-3 text-[15px] focus:outline-none focus:ring-2 ${ringCls} rounded-lg`}
          dangerouslySetInnerHTML={{ __html: initialHtml }}
        />

        {box && (
          <>
            {/* selection frame */}
            <div
              className={`pointer-events-none absolute rounded ring-2 ${ringCls}`}
              style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
            />
            {/* preset size chips */}
            <div
              className="absolute z-10 flex gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 shadow-md"
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
            </div>
            {/* drag handle (bottom-right) */}
            <div
              onPointerDown={startResize}
              className={`absolute z-10 h-3.5 w-3.5 cursor-nwse-resize rounded-full border-2 border-white bg-${accent}-500 shadow`}
              style={{
                left: box.left + box.width - 7,
                top: box.top + box.height - 7,
                background: accent === "lime" ? "#84cc16" : "#f59e0b",
              }}
            />
          </>
        )}
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-[var(--border)] pt-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className={`rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60 ${btnCls}`}
        >
          {pending ? "Kaydediliyor…" : saveLabel}
        </button>
        {savedAt && !error && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">
            ✓ {savedAt}&apos;de kaydedildi
          </span>
        )}
        {error && (
          <span className="text-xs text-rose-600 dark:text-rose-400">{error}</span>
        )}
        <span className="ml-auto hidden text-[11px] text-stone-400 sm:block">
          Görsele tıkla → köşeden sürükleyerek boyutlandır
        </span>
      </div>
    </div>
  );
}
