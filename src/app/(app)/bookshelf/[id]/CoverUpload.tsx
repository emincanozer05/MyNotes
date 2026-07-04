"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setBookCover } from "../actions";

/** "Görsel ekle" — upload a cover image (stored as a data URL) for a book. */
export function CoverUpload({ bookId }: { bookId: string }) {
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
    <>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={pending}
        className="rounded-full border border-[var(--border)] px-3 py-1 font-medium hover:bg-stone-500/10 disabled:opacity-60"
      >
        {pending ? "Yükleniyor…" : "🖼 Görsel ekle"}
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
    </>
  );
}
