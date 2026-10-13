"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Icon } from "@/components/Icon";
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
  heading,
  description,
  sourceId,
  initialNotes,
  printHref,
  tagCategory,
}: {
  heading: string;
  description?: string;
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
    <section className="space-y-4">
      {/* Panel: heading + print, then the titles as a full-width list */}
      <div className="glass-card rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold">{heading}</h2>
            {description && (
              <p className="mt-1 text-sm leading-relaxed text-stone-500">
                {description}
              </p>
            )}
          </div>
          <Link
            href={printHref}
            className="btn-ghost inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold"
          >
            <Icon name="printer" /> Çıktı al (A4)
          </Link>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
            Başlıklar{notes.length > 0 ? ` · ${notes.length}` : ""}
          </p>
          <button
            type="button"
            onClick={addTitle}
            className="btn-gradient inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-xs font-semibold"
          >
            <Icon name="plus" strokeWidth={2.4} /> Başlık Ekle
          </button>
        </div>

        {/* Title list (drag to reorder), numbered by order; titles wrap in
            full instead of being cut off. */}
        {notes.length > 0 && (
          <ol className="mt-3 grid gap-2">
            {notes.map((n, i) => {
              const isActive = n.id === activeId;
              return (
                <li
                  key={n.id}
                  draggable
                  onDragStart={() => setDragId(n.id)}
                  onDragEnter={() => handleDragEnter(n.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDragEnd={handleDragEnd}
                  title="Sürükleyerek sırala"
                  className={`group flex cursor-grab items-start gap-2.5 rounded-xl border px-2.5 py-2 transition-all active:cursor-grabbing ${
                    dragId === n.id ? "opacity-50" : ""
                  } ${
                    isActive
                      ? "border-amber-500/60 bg-amber-500/10 shadow-sm shadow-amber-500/10"
                      : "border-[var(--border)] hover:border-stone-400/60 hover:bg-stone-500/5 dark:hover:border-stone-500/60"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`mt-0.5 flex h-6 w-6 shrink-0 select-none items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${
                      isActive
                        ? "bg-amber-500 text-stone-950"
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
                    aria-current={isActive ? "true" : undefined}
                    className={`min-w-0 flex-1 py-0.5 text-left text-sm font-semibold leading-snug break-words ${
                      isActive
                        ? "text-amber-800 dark:text-amber-200"
                        : "text-stone-600 dark:text-stone-300"
                    }`}
                  >
                    {n.title}
                  </button>
                  <span className="flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => renameTitle(n.id)}
                      title="Yeniden adlandır"
                      aria-label="Yeniden adlandır"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-stone-400 hover:bg-stone-500/10 hover:text-amber-600"
                    >
                      <Icon name="pencil" className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTitle(n.id)}
                      title="Sil"
                      aria-label="Sil"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-stone-400 hover:bg-rose-500/10 hover:text-rose-500"
                    >
                      <Icon name="trash" className="h-3.5 w-3.5" />
                    </button>
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Active editor */}
      {active ? (
        <div ref={editorRef} className="scroll-mt-20">
          <h3 className="mb-3 flex items-start gap-2.5 px-1 text-base font-bold leading-snug">
            <span
              aria-hidden
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold tabular-nums text-stone-950"
            >
              {notes.findIndex((n) => n.id === active.id) + 1}
            </span>
            <span className="min-w-0 break-words">{active.title}</span>
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
          Henüz başlık yok. <b>Başlık Ekle</b> ile ilk notunu oluştur.
        </p>
      )}
    </section>
  );
}
