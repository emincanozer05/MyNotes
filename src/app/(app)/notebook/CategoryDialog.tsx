"use client";

import { useState, useTransition } from "react";
import { Icon, type IconName } from "@/components/Icon";
import { Modal } from "@/components/Modal";
import { NOTEBOOK_ICONS, type NotebookCategory } from "@/lib/notebook";
import {
  addNotebookCategory,
  deleteNotebookCategory,
  updateNotebookCategory,
} from "./actions";

/**
 * Add / edit dialog for a notebook category: a name plus an icon picked from
 * a fixed grid of line icons. In edit mode the category can also be deleted
 * (the server refuses while it still holds pages).
 */
export function CategoryDialog({
  open,
  onClose,
  editing,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  onClose: () => void;
  /** The category being edited; null = add a new one. */
  editing: NotebookCategory | null;
  onSaved: (category: NotebookCategory) => void;
  onDeleted: (slug: string) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} labelledBy="nb-category-title" maxWidth="max-w-md">
      {/* Keyed so the form resets each time it opens for another category. */}
      {open && (
        <CategoryForm
          key={editing?.slug ?? "new"}
          editing={editing}
          onClose={onClose}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      )}
    </Modal>
  );
}

function CategoryForm({
  editing,
  onClose,
  onSaved,
  onDeleted,
}: {
  editing: NotebookCategory | null;
  onClose: () => void;
  onSaved: (category: NotebookCategory) => void;
  onDeleted: (slug: string) => void;
}) {
  const [label, setLabel] = useState(editing?.label ?? "");
  const [icon, setIcon] = useState<IconName>(editing?.icon ?? "tag");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    const value = label.trim();
    if (!value) {
      setError("Kategori adı boş olamaz.");
      return;
    }
    setError(null);
    startTransition(async () => {
      if (editing) {
        const res = await updateNotebookCategory(editing.slug, { label: value, icon });
        if (res.error) return setError(res.error);
        onSaved({ ...editing, label: value, icon });
      } else {
        const res = await addNotebookCategory(value, icon);
        if (res.error || !res.category) {
          return setError(res.error ?? "Kategori eklenemedi.");
        }
        onSaved(res.category);
      }
      onClose();
    });
  }

  function remove() {
    if (!editing) return;
    if (!window.confirm(`"${editing.label}" kategorisi silinsin mi?`)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteNotebookCategory(editing.slug);
      if (res.error) return setError(res.error);
      onDeleted(editing.slug);
      onClose();
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-4"
    >
      <div className="flex items-start justify-between">
        <h2 id="nb-category-title" className="text-lg font-bold">
          {editing ? "Kategoriyi düzenle" : "Yeni kategori"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-2)]"
        >
          <Icon name="x" />
        </button>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-[var(--muted)]">Ad</span>
        <input
          autoFocus
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={40}
          placeholder="Örn. Psikoloji"
          disabled={pending}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--border-strong)]"
        />
      </label>

      <fieldset>
        <legend className="mb-1.5 text-xs font-semibold text-[var(--muted)]">Simge</legend>
        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
          {NOTEBOOK_ICONS.map((name) => {
            const selected = name === icon;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setIcon(name)}
                aria-label={name}
                aria-pressed={selected}
                className={`flex aspect-square items-center justify-center rounded-lg border transition-colors ${
                  selected
                    ? "border-[var(--foreground)] bg-[var(--surface-2)] text-[var(--foreground)]"
                    : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
                }`}
              >
                <Icon name={name} className="h-[18px] w-[18px]" />
              </button>
            );
          })}
        </div>
      </fieldset>

      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      <div className="flex items-center justify-between gap-2 pt-1">
        {editing ? (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-500/10 disabled:opacity-60 dark:text-rose-400"
          >
            <Icon name="trash" /> Sil
          </button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost rounded-full px-4 py-2 text-sm font-semibold"
          >
            Vazgeç
          </button>
          <button
            type="submit"
            disabled={pending}
            className="btn-gradient rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {pending ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    </form>
  );
}
