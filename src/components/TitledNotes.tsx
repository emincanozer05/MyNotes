"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RichTextEditor } from "@/components/RichTextEditor";
import { saveSourceNotes, type TitledNote } from "@/app/(app)/sourceNotesActions";
import { parseNoteHash, scrollToPassage } from "@/lib/passageScroll";

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
  tagCategory,
}: {
  sourceId: string;
  initialNotes: TitledNote[];
  printHref: string;
  /** Inline highlight tags inherit this category (the source's category). */
  tagCategory?: string;
}) {
  const [notes, setNotes] = useState<TitledNote[]>(initialNotes);
  const [activeId, setActiveId] = useState<string | null>(
    initialNotes[0]?.id ?? null,
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const active = notes.find((n) => n.id === activeId) ?? null;

  // When arriving with a `#note-<id>~<passage>` fragment (a post-it's "Kaynağa
  // git"), open that title and scroll straight to the highlighted passage.
  useEffect(() => {
    const target = parseNoteHash(window.location.hash);
    if (!target || !initialNotes.some((n) => n.id === target.noteId)) return;
    const t = setTimeout(() => setActiveId(target.noteId), 0);
    const stopScroll = scrollToPassage(() => editorRef.current, target.passageIndex);
    return () => {
      clearTimeout(t);
      stopScroll();
    };
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

      {/* Title chips (drag to reorder), numbered by their order */}
      {notes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {notes.map((n, i) => {
            const isActive = n.id === activeId;
            return (
              <span
                key={n.id}
                draggable
                onDragStart={() => setDragId(n.id)}
                onDragEnter={() => handleDragEnter(n.id)}
                onDragOver={(e) => e.preventDefault()}
                onDragEnd={handleDragEnd}
                title="Sürükleyerek sırala"
                className={`group inline-flex cursor-grab items-center gap-1.5 rounded-xl border py-1 pl-1.5 pr-1 text-xs font-semibold shadow-sm transition-all active:cursor-grabbing ${
                  dragId === n.id ? "opacity-50" : ""
                } ${
                  isActive
                    ? "border-amber-500/70 bg-gradient-to-b from-amber-400/20 to-amber-500/10 text-amber-700 shadow-amber-500/20 dark:text-amber-300"
                    : "border-[var(--border)] text-stone-500 hover:border-stone-400/60 hover:text-stone-400 dark:hover:border-stone-500/60"
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-5 w-5 shrink-0 select-none items-center justify-center rounded-full text-[10px] font-bold tabular-nums ${
                    isActive
                      ? "bg-amber-500 text-stone-950 shadow-sm shadow-amber-500/40"
                      : "bg-stone-500/15 text-stone-500 group-hover:bg-stone-500/25"
                  }`}
                >
                  {i + 1}
                </span>
                <button
                  type="button"
                  onClick={() => setActiveId(n.id)}
                  onDoubleClick={() => renameTitle(n.id)}
                  title="Seç (çift tıkla: yeniden adlandır)"
                  className="max-w-56 truncate py-0.5 tracking-wide"
                >
                  {n.title}
                </button>
                <span className="flex items-center gap-0.5 opacity-40 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => renameTitle(n.id)}
                    title="Yeniden adlandır"
                    className="rounded-md px-1 py-0.5 text-stone-400 hover:bg-stone-500/10 hover:text-amber-600"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTitle(n.id)}
                    title="Sil"
                    className="rounded-md px-1 py-0.5 text-stone-400 hover:bg-rose-500/10 hover:text-rose-500"
                  >
                    ×
                  </button>
                </span>
              </span>
            );
          })}
        </div>
      )}

      {/* Active editor */}
      {active ? (
        <div ref={editorRef} className="scroll-mt-20">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
            <span
              aria-hidden
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold tabular-nums text-stone-950"
            >
              {notes.findIndex((n) => n.id === active.id) + 1}
            </span>
            {active.title}
          </h3>
          <RichTextEditor
            key={active.id}
            initialHtml={active.html}
            accent="amber"
            placeholder="Bu başlık altındaki notunu buraya yaz…"
            onSave={saveActiveHtml}
            tagCategory={tagCategory}
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
