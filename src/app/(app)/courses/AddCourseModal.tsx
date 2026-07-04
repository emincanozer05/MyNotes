"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { addCourse } from "./actions";
import { COURSE_STATUSES, STATUS_META } from "./status";

const inputCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500";

export function AddCourseModal() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [cover, setCover] = useState("");
  const [pending, startTransition] = useTransition();

  function reset() {
    setCover("");
    formRef.current?.reset();
  }

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setCover(String(reader.result));
    reader.readAsDataURL(file);
  }

  function handleSubmit(fd: FormData) {
    if (cover) fd.set("cover_url", cover);
    startTransition(async () => {
      await addCourse(fd);
      reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-gradient shrink-0 rounded-full px-4 py-2 text-sm font-semibold"
      >
        + Ekle
      </button>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy="add-course-title">
        <div className="mb-4 flex items-start justify-between">
          <h2 id="add-course-title" className="text-lg font-bold">
            Kurs / Eğitim ekle
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Kapat"
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-stone-400 transition-colors hover:bg-stone-500/10 hover:text-stone-600"
          >
            ×
          </button>
        </div>

        <form ref={formRef} action={handleSubmit} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="cr-title" className="text-sm font-medium">
              Ad *
            </label>
            <input id="cr-title" name="title" required className={inputCls} />
          </div>
          <div className="space-y-1">
            <label htmlFor="cr-authors" className="text-sm font-medium">
              Eğitmen / Kurum
            </label>
            <input id="cr-authors" name="authors" className={inputCls} />
          </div>
          <div className="space-y-1">
            <label htmlFor="cr-year" className="text-sm font-medium">
              Yıl
            </label>
            <input id="cr-year" name="year" type="number" className={inputCls} />
          </div>
          <div className="space-y-1">
            <label htmlFor="cr-url" className="text-sm font-medium">
              Kurs linki
            </label>
            <input
              id="cr-url"
              name="url"
              type="url"
              placeholder="https://…"
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="cr-status" className="text-sm font-medium">
              Durum
            </label>
            <select id="cr-status" name="status" defaultValue="reading" className={inputCls}>
              {COURSE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="cr-cover" className="text-sm font-medium">
              Kapak URL{" "}
              <span className="font-normal text-stone-400">(veya görsel yükle)</span>
            </label>
            <input
              id="cr-cover"
              name="cover_url"
              type="url"
              placeholder="https://…"
              value={cover.startsWith("data:") ? "" : cover}
              onChange={(e) => setCover(e.target.value)}
              className={inputCls}
            />
          </div>

          <div className="flex items-center gap-3 sm:col-span-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-full border border-[var(--border)] px-4 py-2 text-sm font-semibold transition-colors hover:bg-stone-500/10"
            >
              🖼 Görsel ekle
            </button>
            {cover.startsWith("data:") && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover}
                alt="Kapak önizleme"
                className="h-14 w-24 rounded border border-[var(--border)] object-cover"
              />
            )}
            {cover.startsWith("data:") && (
              <button
                type="button"
                onClick={() => setCover("")}
                className="text-xs text-stone-400 hover:text-rose-500"
              >
                Kaldır
              </button>
            )}
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

          <div className="flex gap-2 sm:col-span-2">
            <button
              disabled={pending}
              className="btn-gradient rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {pending ? "Ekleniyor…" : "Ekle"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full border border-[var(--border)] px-5 py-2 text-sm font-semibold transition-colors hover:bg-stone-500/10"
            >
              Vazgeç
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
