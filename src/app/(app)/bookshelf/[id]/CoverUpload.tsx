"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setBookCover } from "../actions";

/**
 * Clickable book cover. Clicking the image (or placeholder) opens a file
 * picker and replaces the cover — no separate "add image" button needed.
 */
export function CoverUpload({
  bookId,
  coverUrl,
  title,
}: {
  bookId: string;
  coverUrl: string | null;
  title: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      startTransition(async () => {
        await setBookCover(bookId, dataUrl);
        router.refresh();
      });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="relative h-40 w-28 shrink-0">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={pending}
        title="Kapağı değiştirmek için tıkla"
        className="group block h-full w-full overflow-hidden rounded-md border border-[var(--border)] shadow-lg"
      >
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl}
            alt={`${title} kapağı`}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-stone-600 to-stone-800 p-3 text-center">
            <span className="text-xs font-semibold text-white">{title}</span>
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
          {pending ? "Yükleniyor…" : "🖼 Kapağı değiştir"}
        </span>
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
