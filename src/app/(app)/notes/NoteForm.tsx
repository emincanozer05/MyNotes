"use client";

import { useState } from "react";
import { saveNote } from "./actions";

interface SourceOption {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
}

interface NoteValues {
  id?: string;
  title?: string;
  content?: string;
  source_id?: string | null;
  source_title?: string;
  source_author?: string;
  source_year?: number | null;
  source_page?: string | null;
  tags?: string;
}

const inputCls =
  "w-full rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500";

export function NoteForm({
  sources,
  note,
  error,
}: {
  sources: SourceOption[];
  note?: NoteValues;
  error?: string;
}) {
  const [sourceId, setSourceId] = useState(note?.source_id ?? "");
  const [sourceTitle, setSourceTitle] = useState(note?.source_title ?? "");
  const [sourceAuthor, setSourceAuthor] = useState(note?.source_author ?? "");
  const [sourceYear, setSourceYear] = useState(
    note?.source_year ? String(note.source_year) : "",
  );

  function handleSourceSelect(id: string) {
    setSourceId(id);
    const s = sources.find((x) => x.id === id);
    if (s) {
      setSourceTitle(s.title);
      setSourceAuthor(s.authors.join(", "));
      setSourceYear(s.year ? String(s.year) : "");
    }
  }

  return (
    <form action={saveNote} className="space-y-5">
      {note?.id && <input type="hidden" name="id" value={note.id} />}

      {error && (
        <p className="rounded-md bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="space-y-1">
        <label htmlFor="title" className="text-sm font-medium">
          Not başlığı *
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={note?.title}
          placeholder="Örn: ACWR — Akut:Kronik İş Yükü Oranı"
          className={inputCls}
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="content" className="text-sm font-medium">
          İçerik
        </label>
        <textarea
          id="content"
          name="content"
          rows={12}
          defaultValue={note?.content}
          placeholder={
            "Notunuzu yazın…\n\nBaşka bir nota bağlamak için [[Not Başlığı]], etiketlemek için #kuvvet #vbt yazın."
          }
          className={`${inputCls} font-mono text-[13px] leading-relaxed`}
        />
        <p className="text-xs text-stone-500">
          <code>[[Not Başlığı]]</code> → notlar arası bağlantı (Zettelkasten) ·{" "}
          <code>#etiket</code> → akıllı etiket
        </p>
      </div>

      <details
        className="rounded-lg border border-stone-200 dark:border-stone-800 p-4"
        open={Boolean(note?.source_title || note?.source_id)}
      >
        <summary className="cursor-pointer text-sm font-semibold text-stone-700 dark:text-stone-300">
          Kaynak referansı{" "}
          <span className="font-normal text-stone-400">(isteğe bağlı)</span>
        </summary>

        <div className="mt-4 space-y-4">
          <div className="space-y-1">
            <label htmlFor="source_id" className="text-sm font-medium">
              Kütüphaneden seç
            </label>
            <select
              id="source_id"
              name="source_id"
              value={sourceId}
              onChange={(e) => handleSourceSelect(e.target.value)}
              className={inputCls}
            >
              <option value="">— Elle gireceğim / kaynak yok —</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title.slice(0, 80)}
                  {s.year ? ` (${s.year})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="source_title" className="text-sm font-medium">
                Kitap / Makale adı
              </label>
              <input
                id="source_title"
                name="source_title"
                value={sourceTitle}
                onChange={(e) => setSourceTitle(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="source_author" className="text-sm font-medium">
                Yazar
              </label>
              <input
                id="source_author"
                name="source_author"
                value={sourceAuthor}
                onChange={(e) => setSourceAuthor(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="source_year" className="text-sm font-medium">
                Yayın yılı
              </label>
              <input
                id="source_year"
                name="source_year"
                type="number"
                value={sourceYear}
                onChange={(e) => setSourceYear(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="source_page" className="text-sm font-medium">
                Sayfa no
              </label>
              <input
                id="source_page"
                name="source_page"
                defaultValue={note?.source_page ?? ""}
                placeholder="örn. 142-148"
                className={inputCls}
              />
            </div>
          </div>
        </div>
      </details>

      <div className="space-y-1">
        <label htmlFor="tags" className="text-sm font-medium">
          Etiketler
        </label>
        <input
          id="tags"
          name="tags"
          defaultValue={note?.tags}
          placeholder="kuvvet, hız, sakatlık-önleme, vbt, recovery"
          className={inputCls}
        />
        <p className="text-xs text-stone-500">
          Virgülle ayırın; içerikteki #etiketler otomatik eklenir.
        </p>
      </div>

      <button className="btn-gradient rounded-full px-6 py-2.5 text-sm font-semibold">
        {note?.id ? "Güncelle" : "Notu Kaydet"}
      </button>
    </form>
  );
}
