"use client";

import { Icon } from "@/components/Icon";
import { PageHeader } from "@/components/PageHeader";
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
    <div className="mx-auto max-w-4xl space-y-5">
      <PageHeader
        title="Ne, nedir?"
        description={
          <>
            Kavramların ve ifadelerin kısa tanımları. Not/özet yazarken bir
            metni seçip <b>Sözlüğe Kaydet</b> ile buraya ekleyebilir, başlığını
            sonradan girebilirsin.
          </>
        }
        actions={
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="btn-gradient px-3.5 py-1.5 text-sm font-semibold"
          >
            + Yeni
          </button>
        }
      />

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
        className="w-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--brand-1)]"
      />

      {adding && (
        <div className="item-table">
          <EntryCard
          entry={null}
            startEditing
            onDone={() => setAdding(false)}
          />
        </div>
      )}

      {untitled.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--accent-text)]">
            Başlık bekleyenler ({untitled.length})
          </h2>
          <div className="item-table">
            {untitled.map((e) => (
              <EntryCard key={e.id} entry={e} />
            ))}
          </div>
        </section>
      )}

      {groups.map(([letter, list]) => (
        <section key={letter} className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            {letter}
          </h2>
          <div className="item-table">
            {list.map((e) => (
              <EntryCard key={e.id} entry={e} />
            ))}
          </div>
        </section>
      ))}

      {!setupError && entries.length === 0 && !adding && (
        <p className="rounded-lg border border-dashed border-[var(--border-strong)] p-10 text-center text-sm text-[var(--muted)]">
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
      <div className="item-row space-y-2 bg-[var(--surface)] p-4">
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
            className="btn-gradient px-4 py-1.5 text-sm font-semibold disabled:opacity-50"
          >
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    );
  }

  if (!entry) return null;
  return (
    <div className="item-row group px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        {entry.term.trim() ? (
          <h3 className="text-sm font-semibold">{entry.term}</h3>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-md border border-dashed border-amber-500 px-2 py-0.5 text-xs font-semibold text-amber-600 hover:bg-amber-500/10"
          >
            + Başlık ekle
          </button>
        )}
        <div className="touch-show flex shrink-0 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Düzenle"
            className="rounded-full px-2 py-0.5 text-xs text-stone-500 hover:bg-stone-500/10"
          >
            <Icon name="pencil" className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            title="Sil"
            className="rounded-full px-2 py-0.5 text-xs text-stone-500 hover:bg-rose-500/15 hover:text-rose-600"
          >
            <Icon name="trash" className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {entry.definition && (
        <p className="mt-1 whitespace-pre-line text-[13px] leading-relaxed text-[var(--muted)]">
          {entry.definition}
        </p>
      )}
      {entry.source_path?.startsWith("/") && (
        <Link
          href={entry.source_path}
          className="mt-2 inline-block text-xs font-medium text-[var(--brand-1)] hover:underline"
        >
          Kaynağa git <Icon name="arrow-right" />
        </Link>
      )}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
