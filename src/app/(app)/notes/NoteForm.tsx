"use client";

import { useRef, useState } from "react";
import { RichTextEditor } from "@/components/RichTextEditor";
import { CATEGORIES, normalizeCategory } from "@/lib/categories";
import { upsertNote } from "./actions";

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
  category?: string;
  source_id?: string | null;
  source_title?: string;
  source_author?: string;
  source_year?: number | null;
  source_page?: string | null;
  tags?: string;
}

const inputCls =
  "w-full rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500";

function looksLikeHtml(s: string) {
  return /<[a-z][\s\S]*>/i.test(s);
}

/** Legacy notes are stored as plain text; wrap them so the editor renders them. */
function toEditorHtml(content: string): string {
  if (!content) return "";
  if (looksLikeHtml(content)) return content;
  const escaped = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/\n/g, "<br>");
}

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
  const [category, setCategory] = useState(normalizeCategory(note?.category));

  // Live values are mirrored into a ref so debounced/serialized saves never
  // read a stale closure.
  const meta = useRef({
    id: note?.id ?? "",
    title: note?.title ?? "",
    category: normalizeCategory(note?.category),
    source_id: note?.source_id ?? "",
    source_title: note?.source_title ?? "",
    source_author: note?.source_author ?? "",
    source_year: note?.source_year ? String(note.source_year) : "",
    source_page: note?.source_page ?? "",
    tags: note?.tags ?? "",
  });
  const contentRef = useRef(note?.content ?? "");
  const lastSigRef = useRef<string | null>(null);
  const metaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Serialize saves so the first insert finishes (and yields an id) before a
  // second concurrent save runs — otherwise a new note is created twice.
  const chainRef = useRef<Promise<{ error?: string | null }>>(
    Promise.resolve({ error: null }),
  );

  const [needTitle, setNeedTitle] = useState(false);

  function signature() {
    const m = meta.current;
    return [
      m.title,
      contentRef.current,
      m.category,
      m.source_id,
      m.source_title,
      m.source_author,
      m.source_year,
      m.source_page,
      m.tags,
    ].join("\u0000");
  }

  async function doPersist(): Promise<{ error?: string | null }> {
    const m = meta.current;
    if (!m.title.trim()) {
      setNeedTitle(true);
      return { error: "Kaydetmek için başlık gerekli." };
    }
    setNeedTitle(false);

    const sig = signature();
    if (sig === lastSigRef.current) return { error: null };

    const res = await upsertNote({
      id: m.id || null,
      title: m.title,
      content: contentRef.current,
      category: m.category,
      source_id: m.source_id || null,
      source_title: m.source_title,
      source_author: m.source_author,
      source_year: m.source_year ? Number(m.source_year) : null,
      source_page: m.source_page || null,
      tags: m.tags,
    });

    if (res.error) return { error: res.error };
    lastSigRef.current = sig;
    if (res.id && !m.id) {
      m.id = res.id;
      // Reflect the new id in the URL without remounting the editor.
      window.history.replaceState(null, "", `/notes/${res.id}/edit`);
    }
    return { error: null };
  }

  /** Serialized save; both the editor and the metadata fields call this. */
  function persist(html?: string): Promise<{ error?: string | null }> {
    if (typeof html === "string") contentRef.current = html;
    const run = chainRef.current.then(() => doPersist());
    chainRef.current = run.catch(() => ({ error: null }));
    return run;
  }

  function scheduleMetaSave() {
    if (metaTimer.current) clearTimeout(metaTimer.current);
    metaTimer.current = setTimeout(() => void persist(), 900);
  }

  function handleSourceSelect(id: string) {
    setSourceId(id);
    meta.current.source_id = id;
    const s = sources.find((x) => x.id === id);
    if (s) {
      setSourceTitle(s.title);
      setSourceAuthor(s.authors.join(", "));
      setSourceYear(s.year ? String(s.year) : "");
      meta.current.source_title = s.title;
      meta.current.source_author = s.authors.join(", ");
      meta.current.source_year = s.year ? String(s.year) : "";
    }
    scheduleMetaSave();
  }

  return (
    <div className="space-y-5">
      {error && (
        <p className="rounded-md bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="space-y-1">
        <label htmlFor="category" className="text-sm font-medium">
          Kategori *
        </label>
        <select
          id="category"
          value={category}
          onChange={(e) => {
            const value = normalizeCategory(e.target.value);
            setCategory(value);
            meta.current.category = value;
            scheduleMetaSave();
          }}
          className={inputCls}
        >
          {CATEGORIES.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-stone-500">
          Her kategorinin kendi post-it&apos;leri ve etiketleri vardır; birbirine
          karışmaz.
        </p>
      </div>

      <div className="space-y-1">
        <label htmlFor="title" className="text-sm font-medium">
          Not başlığı *
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={note?.title}
          onChange={(e) => {
            meta.current.title = e.target.value;
            if (e.target.value.trim()) setNeedTitle(false);
            scheduleMetaSave();
          }}
          placeholder="Örn: ACWR — Akut:Kronik İş Yükü Oranı"
          className={inputCls}
        />
        {needTitle && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Otomatik kayıt için önce bir başlık yazın.
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium">İçerik</label>
        <RichTextEditor
          initialHtml={toEditorHtml(note?.content ?? "")}
          accent="amber"
          placeholder={
            "Notunuzu yazın… Biçimlendirin, görsel ekleyin (köşe/kenardan boyutlandırın).\n\n[[Not Başlığı]] → bağlantı · #etiket → akıllı etiket"
          }
          onChange={(html) => {
            contentRef.current = html;
          }}
          onSave={(html) => persist(html)}
          tagCategory={category}
        />
        <p className="text-xs text-stone-500">
          <code>[[Not Başlığı]]</code> → notlar arası bağlantı (Zettelkasten) ·{" "}
          <code>#etiket</code> → akıllı etiket · yazdıklarınız otomatik kaydedilir
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
                value={sourceTitle}
                onChange={(e) => {
                  setSourceTitle(e.target.value);
                  meta.current.source_title = e.target.value;
                  scheduleMetaSave();
                }}
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="source_author" className="text-sm font-medium">
                Yazar
              </label>
              <input
                id="source_author"
                value={sourceAuthor}
                onChange={(e) => {
                  setSourceAuthor(e.target.value);
                  meta.current.source_author = e.target.value;
                  scheduleMetaSave();
                }}
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="source_year" className="text-sm font-medium">
                Yayın yılı
              </label>
              <input
                id="source_year"
                type="number"
                value={sourceYear}
                onChange={(e) => {
                  setSourceYear(e.target.value);
                  meta.current.source_year = e.target.value;
                  scheduleMetaSave();
                }}
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="source_page" className="text-sm font-medium">
                Sayfa no
              </label>
              <input
                id="source_page"
                defaultValue={note?.source_page ?? ""}
                onChange={(e) => {
                  meta.current.source_page = e.target.value;
                  scheduleMetaSave();
                }}
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
          defaultValue={note?.tags}
          onChange={(e) => {
            meta.current.tags = e.target.value;
            scheduleMetaSave();
          }}
          placeholder="kuvvet, hız, sakatlık-önleme, vbt, recovery"
          className={inputCls}
        />
        <p className="text-xs text-stone-500">
          Virgülle ayırın; içerikteki #etiketler otomatik eklenir.
        </p>
      </div>
    </div>
  );
}
