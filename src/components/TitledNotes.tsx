"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RichTextEditor } from "@/components/RichTextEditor";
import { saveSourceNotes, type TitledNote } from "@/app/(app)/sourceNotesActions";

function newId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Moves the item with id `fromId` to the position of `toId`. */
function reorder(
  list: TitledNote[],
  fromId: string,
  toId: string,
): TitledNote[] {
  const from = list.findIndex((n) => n.id === fromId);
  const to = list.findIndex((n) => n.id === toId);
  if (from < 0 || to < 0 || from === to) return list;
  const copy = [...list];
  const [moved] = copy.splice(from, 1);
  copy.splice(to, 0, moved);
  return copy;
}

/**
 * Multiple titled notes for a single source: a row of title chips + an
 * "Başlık Ekle" button, with each title keeping its own rich-text note.
 * A "Çıktı al" button prints all titles to a vertical A4 page.
 */
export function TitledNotes({
  sourceId,
  initialNotes,
  printHref,
}: {
  sourceId: string;
  initialNotes: TitledNote[];
  printHref: string;
}) {
  const [notes, setNotes] = useState<TitledNote[]>(initialNotes);
  const [activeId, setActiveId] = useState<string | null>(
    initialNotes[0]?.id ?? null,
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const active = notes.find((n) => n.id === activeId) ?? null;

  // When arriving with a `#note-<id>` fragment (e.g. from a post-it's "Kaynağa
  // git"), open that title and scroll straight to the note text.
  useEffect(() => {
    const match = /^#note-(.+)$/.exec(window.location.hash);
    if (!match) return;
    const targetId = decodeURIComponent(match[1]);
    if (!initialNotes.some((n) => n.id === targetId)) return;
    setActiveId(targetId);
    // Wait for the editor to render its content before scrolling to it.
    const t = setTimeout(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => clearTimeout(t);
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDragEnter(id: string) {
    if (dragId && dragId !== id) {
      setNotes((prev) => reorder(prev, dragId, id));
    }
  }

  async function handleDragEnd() {
    const dragged = dragId;
    setDragId(null);
    // Persist the new order.
    if (dragged) await saveSourceNotes(sourceId, notes);
  }

  async function addTitle() {
    const title = window.prompt("Başlık:")?.trim();
    if (!title) return;
    const section: TitledNote = { id: newId(), title, html: "" };
    const next = [...notes, section];
    setNotes(next);
    setActiveId(section.id);
    await saveSourceNotes(sourceId, next);
  }

  async function renameTitle(id: string) {
    const current = notes.find((n) => n.id === id);
    const title = window.prompt("Başlığı düzenle:", current?.title)?.trim();
    if (!title) return;
    const next = notes.map((n) => (n.id === id ? { ...n, title } : n));
    setNotes(next);
    await saveSourceNotes(sourceId, next);
  }

  async function removeTitle(id: string) {
    if (!window.confirm("Bu başlık ve notu silinsin mi?")) return;
    const next = notes.filter((n) => n.id !== id);
    setNotes(next);
    if (activeId === id) setActiveId(next[0]?.id ?? null);
    await saveSourceNotes(sourceId, next);
  }

  async function saveActiveHtml(html: string) {
    if (!activeId) return { error: null };
    const next = notes.map((n) => (n.id === activeId ? { ...n, html } : n));
    setNotes(next);
    return saveSourceNotes(sourceId, next);
  }

  return (
    <div className="space-y-3">
      {/* Header: add-title (left) + print (right) */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={addTitle}
          className="btn-gradient rounded-full px-4 py-1.5 text-xs font-semibold"
        >
          + Başlık Ekle
        </button>
        <Link
          href={printHref}
          className="rounded-full border border-[var(--border)] px-4 py-1.5 text-xs font-semibold transition-colors hover:bg-stone-500/10"
        >
          🖨 Çıktı al (A4)
        </Link>
      </div>

      {/* Title chips (drag to reorder) */}
      {notes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {notes.map((n) => {
            const isActive = n.id === activeId;
            return (
              <span
                key={n.id}
                draggable
                onDragStart={() => setDragId(n.id)}
                onDragEnter={() => handleDragEnter(n.id)}
                onDragOver={(e) => e.preventDefault()}
                onDragEnd={handleDragEnd}
                className={`inline-flex cursor-grab items-center gap-1 rounded-full border px-1 py-0.5 text-xs font-semibold active:cursor-grabbing ${
                  dragId === n.id ? "opacity-50" : ""
                } ${
                  isActive
                    ? "border-amber-500/60 bg-amber-400/10 text-amber-700 dark:text-amber-300"
                    : "border-[var(--border)] text-stone-500"
                }`}
              >
                <span
                  aria-hidden
                  title="Sürükleyerek sırala"
                  className="select-none pl-1 text-stone-400"
                >
                  ⠿
                </span>
                <button
                  type="button"
                  onClick={() => setActiveId(n.id)}
                  onDoubleClick={() => renameTitle(n.id)}
                  title="Seç (çift tıkla: yeniden adlandır)"
                  className="py-0.5 pr-1"
                >
                  {n.title}
                </button>
                <button
                  type="button"
                  onClick={() => renameTitle(n.id)}
                  title="Yeniden adlandır"
                  className="text-stone-400 hover:text-amber-600"
                >
                  ✎
                </button>
                <button
                  type="button"
                  onClick={() => removeTitle(n.id)}
                  title="Sil"
                  className="pr-1 text-stone-400 hover:text-rose-500"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Active editor */}
      {active ? (
        <div ref={editorRef} className="scroll-mt-20">
          <h3 className="mb-2 text-sm font-bold">{active.title}</h3>
          <RichTextEditor
            key={active.id}
            initialHtml={active.html}
            accent="amber"
            saveLabel="Notu Kaydet"
            placeholder="Bu başlık altındaki notunu buraya yaz…"
            onSave={saveActiveHtml}
          />
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500 dark:border-stone-700">
          Henüz başlık yok. <b>+ Başlık Ekle</b> ile ilk notunu oluştur.
        </p>
      )}
    </div>
  );
}
