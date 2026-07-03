"use client";

import { useRef, useState, useTransition } from "react";
import { saveBookSummary } from "../actions";

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

export function BookEditor({
  bookId,
  initialHtml,
}: {
  bookId: string;
  initialHtml: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);

  function exec(command: string, value?: string) {
    ref.current?.focus();
    try {
      document.execCommand("styleWithCSS", false, "true");
    } catch {
      /* not all browsers support styleWithCSS */
    }
    document.execCommand(command, false, value);
  }

  function insertImageFromFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      ref.current?.focus();
      document.execCommand("insertImage", false, String(reader.result));
    };
    reader.readAsDataURL(file);
  }

  function insertImageFromUrl() {
    const url = window.prompt("Görsel URL'si:");
    if (url) exec("insertImage", url);
  }

  function handleSave() {
    const html = ref.current?.innerHTML ?? "";
    startTransition(async () => {
      const res = await saveBookSummary(bookId, html);
      if (!res.error) {
        setSavedAt(new Date().toLocaleTimeString("tr-TR"));
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

      {/* Editable area */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder="Kitaptan aldığınız bilgileri buraya özetleyin… Biçimlendirin, görsel ekleyin."
        className="rte mt-3 text-[15px]"
        dangerouslySetInnerHTML={{ __html: initialHtml }}
      />

      <div className="mt-3 flex items-center gap-3 border-t border-[var(--border)] pt-3">
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
      </div>
    </div>
  );
}
