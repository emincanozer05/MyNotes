"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addGlossaryEntry,
  deleteGlossaryEntry,
  updateGlossaryEntry,
} from "./actions";
import type { GlossaryEntry } from "@/lib/glossaryStore";

/** Turkish-aware, case-insensitive key for search and sorting. */
function key(s: string) {
  return s.toLocaleLowerCase("tr");
}

/** "Ne, nedir?" — short definitions of concepts and phrases. */
export function Glossary({
  entries,
  setupError,
}: {
  entries: GlossaryEntry[];
  setupError: string | null;
}) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);

  const { untitled, titled } = useMemo(() => {
    const q = key(query.trim());
    const hit = entries.filter(
      (e) => !q || key(e.term).includes(q) || key(e.definition).includes(q),
    );
    return {
      untitled: hit.filter((e) => !e.term.trim()),
      titled: hit
        .filter((e) => e.term.trim())
        .sort((a, b) => a.term.localeCompare(b.term, "tr")),
    };
  }, [entries, query]);

  // A–Z groups by first letter.
  const groups = useMemo(() => {
    const map = new Map<string, GlossaryEntry[]>();
    for (const e of titled) {
      const letter = e.term.trim().charAt(0).toLocaleUpperCase("tr");
      map.set(letter, [...(map.get(letter) ?? []), e]);
    }
    return [...map.entries()];
  }, [titled]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="gradient-text">Ne, nedir?</span>
          </h1>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
            Kavramların ve ifadelerin kısa tanımları. Not/özet yazarken bir
            metni seçip <b>Sözlüğe Kaydet</b> ile buraya ekleyebilir, başlığını
            sonradan girebilirsin.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:bg-stone-100 dark:text-stone-900"
        >
          + Yeni
        </button>
      </div>

      {setupError && (
        <p className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
          {setupError}
        </p>
      )}

      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Sözlükte ara…"
        className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm outline-none focus:border-[var(--brand-1)]"
      />

      {adding && (
        <EntryCard
          entry={null}
          startEditing
          onDone={() => setAdding(false)}
        />
      )}

      {untitled.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-600">
            Başlık bekleyenler ({untitled.length})
          </h2>
          {untitled.map((e) => (
            <EntryCard key={e.id} entry={e} />
          ))}
        </section>
      )}

      {groups.map(([letter, list]) => (
        <section key={letter} className="space-y-3">
          <h2 className="border-b border-[var(--border)] pb-1 text-lg font-bold text-[var(--brand-1)]">
            {letter}
          </h2>
          {list.map((e) => (
            <EntryCard key={e.id} entry={e} />
          ))}
        </section>
      ))}

      {!setupError && entries.length === 0 && !adding && (
        <p className="rounded-2xl border border-dashed border-stone-300 p-10 text-center text-sm text-stone-500 dark:border-stone-700">
          Sözlük boş. <b>+ Yeni</b> ile bir tanım ekle ya da not editöründe
          metin seçip <b>Sözlüğe Kaydet</b>&apos;e bas.
        </p>
      )}
      {entries.length > 0 && untitled.length + titled.length === 0 && (
        <p className="text-center text-sm text-stone-500">Eşleşen girdi yok.</p>
      )}
    </div>
  );
}

function EntryCard({
  entry,
  startEditing = false,
  onDone,
}: {
  entry: GlossaryEntry | null;
  startEditing?: boolean;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(startEditing);
  const [term, setTerm] = useState(entry?.term ?? "");
  const [definition, setDefinition] = useState(entry?.definition ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const res = entry
        ? await updateGlossaryEntry(entry.id, { term, definition })
        : await addGlossaryEntry({ term, definition });
      if (res.error) {
        setError(res.error);
        return;
      }
      setEditing(false);
      onDone?.();
      router.refresh();
    });
  }

  function cancel() {
    setTerm(entry?.term ?? "");
    setDefinition(entry?.definition ?? "");
    setError(null);
    setEditing(false);
    onDone?.();
  }

  function remove() {
    if (!entry || !window.confirm("Bu sözlük girdisi silinsin mi?")) return;
    startTransition(async () => {
      const res = await deleteGlossaryEntry(entry.id);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  if (editing) {
    return (
      <div className="glass-card space-y-2 rounded-2xl p-4">
        <input
          autoFocus={!entry || !entry.term}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Başlık (ör. Hipertrofi)"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-base font-semibold outline-none focus:border-[var(--brand-1)]"
        />
        <textarea
          autoFocus={!!entry?.term}
          value={definition}
          onChange={(e) => setDefinition(e.target.value)}
          placeholder="Kısa açıklama…"
          rows={Math.min(12, Math.max(3, definition.split("\n").length + 1))}
          className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm leading-relaxed outline-none focus:border-[var(--brand-1)]"
        />
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={cancel}
            disabled={pending}
            className="rounded-full px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-500/10"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending || (!term.trim() && !definition.trim())}
            className="rounded-full bg-stone-900 px-4 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900"
          >
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    );
  }

  if (!entry) return null;
  return (
    <div className="glass-card group rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        {entry.term.trim() ? (
          <h3 className="text-base font-bold">{entry.term}</h3>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full border border-dashed border-amber-500 px-2.5 py-0.5 text-xs font-semibold text-amber-600 hover:bg-amber-500/10"
          >
            + Başlık ekle
          </button>
        )}
        <div className="flex shrink-0 items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Düzenle"
            className="rounded-full px-2 py-0.5 text-xs text-stone-500 hover:bg-stone-500/10"
          >
            ✎
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            title="Sil"
            className="rounded-full px-2 py-0.5 text-xs text-stone-500 hover:bg-rose-500/15 hover:text-rose-600"
          >
            🗑
          </button>
        </div>
      </div>
      {entry.definition && (
        <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-stone-600 dark:text-stone-300">
          {entry.definition}
        </p>
      )}
      {entry.source_path?.startsWith("/") && (
        <Link
          href={entry.source_path}
          className="mt-2 inline-block text-xs font-medium text-[var(--brand-1)] hover:underline"
        >
          Kaynağa git →
        </Link>
      )}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
