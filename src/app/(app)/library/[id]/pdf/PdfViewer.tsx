"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import "pdfjs-dist/web/pdf_viewer.css";
import {
  PDF_HIGHLIGHT_COLORS,
  type PdfHighlight,
  type PdfRect,
} from "@/lib/articlePdf";
import { addPdfHighlight, deletePdfHighlight, getArticlePdfUrl } from "../../actions";
import { getPdfPostitTags, retagPdfPostit, savePdfPostit } from "../../../notes/actions";
import type { UserTag } from "../../../tagsActions";
import { normalizePdfSelection } from "@/lib/pdfText";
import { TagPicker } from "./TagPicker";

type PdfJs = typeof import("pdfjs-dist");

interface Pending {
  page: number;
  text: string;
  rects: PdfRect[];
  /** Viewport position of the floating toolbar. */
  top: number;
  left: number;
}

let pdfjsPromise: Promise<PdfJs> | null = null;
function loadPdfJs(): Promise<PdfJs> {
  pdfjsPromise ??= import("pdfjs-dist").then((m) => {
    m.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    return m;
  });
  return pdfjsPromise;
}

/** In-app PDF reader: text selection → highlight / post-it, stored in Supabase. */
export function PdfViewer({
  articleId,
  title,
  initialHighlights,
  tagCategory,
  initialTags,
  initialPage,
  initialHighlightId,
}: {
  articleId: string;
  title: string;
  initialHighlights: PdfHighlight[];
  tagCategory: string;
  initialTags: UserTag[];
  /** Deep link from a post-it's "Kaynağa git": page (and highlight) to land on. */
  initialPage: number | null;
  initialHighlightId: string | null;
}) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pdfjs, setPdfjs] = useState<PdfJs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(0);
  const [highlights, setHighlights] = useState<PdfHighlight[]>(initialHighlights);
  const [pending, setPending] = useState<Pending | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [tagging, setTagging] = useState(false);
  // Turkish translation of the pending selection; `source` ties it to the
  // selected text so a new selection never shows a stale translation.
  const [tr, setTr] = useState<{
    source: string;
    busy: boolean;
    text: string;
    err: string | null;
    accepted: boolean;
  } | null>(null);
  const [tags, setTags] = useState<UserTag[]>(initialTags);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [menu, setMenu] = useState<{
    id: string;
    top: number;
    left: number;
    mode: "main" | "tag";
  } | null>(null);
  const [menuTags, setMenuTags] = useState<string[] | null>(null);
  const [flashId, setFlashId] = useState<string | null>(initialHighlightId);
  const [pageSize, setPageSize] = useState({ w: 612, h: 792 });
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  // Load the document through a short-lived signed URL.
  useEffect(() => {
    let cancelled = false;
    let task: { destroy: () => Promise<void> } | null = null;
    (async () => {
      try {
        const [lib, res] = await Promise.all([loadPdfJs(), getArticlePdfUrl(articleId)]);
        if (!res.url) throw new Error(res.error ?? "PDF açılamadı.");
        const loading = lib.getDocument({ url: res.url });
        task = loading;
        const pdf = await loading.promise;
        if (cancelled) return;
        const first = await pdf.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        const w = vp.width;
        setPageSize({ w: vp.width, h: vp.height });
        const avail = (containerRef.current?.clientWidth ?? 800) - 8;
        setScale(Math.max(0.5, Math.min(2, avail / w)));
        setDownloadUrl(res.url);
        setPdfjs(lib);
        setDoc(pdf);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "PDF açılamadı.");
      }
    })();
    return () => {
      cancelled = true;
      void task?.destroy();
    };
  }, [articleId]);

  // Turn a finished text selection into a pending action (floating toolbar).
  useEffect(() => {
    function onSelectionEnd() {
      // Typing a tag in the toolbar must not discard the pending selection.
      if (toolbarRef.current?.contains(document.activeElement)) return;
      if (menuRef.current?.contains(document.activeElement)) return;
      const sel = window.getSelection();
      const root = containerRef.current;
      if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !root) {
        setPending(null);
        return;
      }
      const range = sel.getRangeAt(0);
      const startEl =
        range.startContainer instanceof Element
          ? range.startContainer
          : range.startContainer.parentElement;
      const pageEl = startEl?.closest<HTMLElement>("[data-pdf-page]");
      if (!pageEl || !root.contains(pageEl)) {
        setPending(null);
        return;
      }
      const text = normalizePdfSelection(sel.toString());
      if (!text) {
        setPending(null);
        return;
      }
      const box = pageEl.getBoundingClientRect();
      const rects: PdfRect[] = [];
      for (const r of Array.from(range.getClientRects())) {
        if (r.width < 1 || r.height < 1) continue;
        const x1 = Math.max(r.left, box.left);
        const x2 = Math.min(r.right, box.right);
        const y1 = Math.max(r.top, box.top);
        const y2 = Math.min(r.bottom, box.bottom);
        if (x2 - x1 < 1 || y2 - y1 < 1) continue;
        rects.push({
          x: (x1 - box.left) / box.width,
          y: (y1 - box.top) / box.height,
          w: (x2 - x1) / box.width,
          h: (y2 - y1) / box.height,
        });
      }
      if (rects.length === 0) {
        setPending(null);
        return;
      }
      const bounds = range.getBoundingClientRect();
      const touch = window.matchMedia("(pointer: coarse)").matches;
      // The global "Açıkla" button sits above the selection on desktop and
      // below it on touch, so this toolbar takes the opposite side.
      const top = touch ? Math.max(8, bounds.top - 52) : bounds.bottom + 10;
      const left = Math.min(Math.max(8, bounds.left), window.innerWidth - 340);
      setPending({ page: Number(pageEl.dataset.pdfPage), text, rects, top, left });
    }
    function onUp(e: Event) {
      if (toolbarRef.current?.contains(e.target as Node)) return;
      if (menuRef.current?.contains(e.target as Node)) return;
      // Let the browser finalise the selection first.
      setTimeout(onSelectionEnd, 10);
    }
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchend", onUp);
    document.addEventListener("keyup", onUp);
    return () => {
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchend", onUp);
      document.removeEventListener("keyup", onUp);
    };
  }, []);

  const trView = tr && pending && tr.source === pending.text ? tr : null;

  // Panel post-it: asks for the tag(s) first.
  function askTagFor(h: PdfHighlight) {
    const tags = window.prompt("Post-it etiketi (boşlukla ayır):");
    if (tags?.trim()) void postit(h.text, h.page, tags, h.id);
  }

  function clearSelection() {
    window.getSelection()?.removeAllRanges();
    setPending(null);
    setTagging(false);
    setTr(null);
  }

  /** Translates the selected passage to Turkish for a preview (nothing is saved yet). */
  async function translatePending() {
    if (!pending) return;
    const source = pending.text;
    setTr({ source, busy: true, text: "", err: null, accepted: false });
    // A late answer only lands if the user is still waiting on this very text.
    const settle = (next: { text: string; err: string | null }) =>
      setTr((cur) =>
        cur && cur.source === source && cur.busy ? { ...cur, busy: false, ...next } : cur,
      );
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: source, target: "tr" }),
      });
      const data = (await res.json()) as { translated?: string; error?: string };
      if (!res.ok || !data.translated) {
        settle({ text: "", err: data.error ?? "Çeviri alınamadı." });
        return;
      }
      settle({ text: data.translated, err: null });
    } catch {
      settle({ text: "", err: "Çeviri servisine ulaşılamadı." });
    }
  }

  async function highlight(color: string) {
    if (!pending) return;
    const h: PdfHighlight = {
      id: crypto.randomUUID(),
      page: pending.page,
      text: pending.text,
      color,
      rects: pending.rects,
    };
    clearSelection();
    setHighlights((prev) => [...prev, h]);
    const res = await addPdfHighlight(articleId, h);
    if (res.error) {
      setHighlights((prev) => prev.filter((x) => x.id !== h.id));
      flash(`Vurgu kaydedilemedi: ${res.error}`);
    }
  }

  /** Saves a post-it under the given tag(s); `highlightId` links it to a highlight. */
  async function postit(text: string, page: number, tags: string, highlightId?: string) {
    flash("Post-it kaydediliyor…");
    const res = await savePdfPostit({ articleId, text, page, tags, highlightId });
    flash(res.error ? `Kaydedilemedi: ${res.error}` : "Post-it panosuna kaydedildi 📌");
  }

  /** Highlights the pending selection and files it as a tagged post-it. */
  async function saveTaggedPostit(tagName: string) {
    if (!pending || !tagName.trim()) return;
    const p = pending;
    const tags = tagName;
    // The post-it holds the approved Turkish text; the highlight keeps the original.
    const noteText = trView?.accepted && trView.text.trim() ? trView.text : p.text;
    const h: PdfHighlight = {
      id: crypto.randomUUID(),
      page: p.page,
      text: p.text,
      color: PDF_HIGHLIGHT_COLORS[0],
      rects: p.rects,
    };
    clearSelection();
    setHighlights((prev) => [...prev, h]);
    const saved = await addPdfHighlight(articleId, h);
    if (saved.error) {
      setHighlights((prev) => prev.filter((x) => x.id !== h.id));
      await postit(noteText, p.page, tags);
      return;
    }
    await postit(noteText, p.page, tags, h.id);
  }

  async function removeHighlight(id: string) {
    const prev = highlights;
    setHighlights((cur) => cur.filter((h) => h.id !== id));
    const res = await deletePdfHighlight(articleId, id);
    if (res.error) {
      setHighlights(prev);
      flash(`Silinemedi: ${res.error}`);
    }
  }

  function openMenu(id: string, x: number, y: number) {
    setMenu({
      id,
      top: Math.max(8, Math.min(y + 8, window.innerHeight - 200)),
      left: Math.max(8, Math.min(x, window.innerWidth - 300)),
      mode: "main",
    });
    setMenuTags(null);
    const h = highlights.find((x) => x.id === id);
    if (h) void getPdfPostitTags(articleId, id).then((r) => setMenuTags(r.tags));
  }

  // Close the highlight menu on Escape, outside press or scroll.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    function onDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  async function recolor(id: string, color: string) {
    const h = highlights.find((x) => x.id === id);
    if (!h || h.color === color) return;
    setHighlights((cur) => cur.map((x) => (x.id === id ? { ...x, color } : x)));
    const res = await addPdfHighlight(articleId, { ...h, color });
    if (res.error) {
      setHighlights((cur) => cur.map((x) => (x.id === id ? h : x)));
      flash(`Renk değiştirilemedi: ${res.error}`);
    }
  }

  async function retag(id: string, tagName: string) {
    const h = highlights.find((x) => x.id === id);
    setMenu(null);
    if (!h) return;
    flash("Etiket değiştiriliyor…");
    const res = await retagPdfPostit({
      articleId,
      highlightId: id,
      text: h.text,
      page: h.page,
      tags: tagName,
    });
    flash(res.error ? `Değiştirilemedi: ${res.error}` : `Etiket: ${tagName} 🏷`);
  }

  const scrollToSpot = useCallback((page: number, y: number) => {
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-pdf-page="${page}"]`);
    if (!el) return;
    const box = el.getBoundingClientRect();
    el.closest("main")?.scrollBy({ top: box.top - 120 + y * box.height });
  }, []);

  function goToHighlight(h: PdfHighlight) {
    scrollToSpot(h.page, h.rects[0]?.y ?? 0);
  }

  // Deep link: land on the page/highlight. Pages above may still be sizing
  // themselves as they render, so re-aim a few times until layout settles.
  useEffect(() => {
    if (!doc || scale <= 0 || !initialPage) return;
    const target = initialHighlightId
      ? initialHighlights.find((h) => h.id === initialHighlightId)
      : undefined;
    const page = target?.page ?? Math.min(initialPage, doc.numPages);
    const y = target?.rects[0]?.y ?? 0;
    let tries = 0;
    const timer = setInterval(() => {
      scrollToSpot(page, y);
      if (++tries >= 8) clearInterval(timer);
    }, 250);
    const clear = setTimeout(() => setFlashId(null), 4500);
    return () => {
      clearInterval(timer);
      clearTimeout(clear);
    };
    // Run once per loaded document, not on every highlight change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, scale > 0]);

  const sorted = [...highlights].sort(
    (a, b) => a.page - b.page || (a.rects[0]?.y ?? 0) - (b.rects[0]?.y ?? 0),
  );

  return (
    <div>
      <div className="glass-card sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2 text-xs">
        <span className="min-w-0 flex-1 truncate font-semibold" title={title}>
          {title}
        </span>
        {doc && (
          <>
            <span className="text-stone-500">{doc.numPages} sayfa</span>
            <button
              type="button"
              onClick={() => setScale((s) => Math.max(0.5, +(s - 0.15).toFixed(2)))}
              className="btn-ghost rounded-full px-2.5 py-1 font-bold"
              aria-label="Uzaklaştır"
            >
              −
            </button>
            <span className="w-10 text-center tabular-nums">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setScale((s) => Math.min(3, +(s + 0.15).toFixed(2)))}
              className="btn-ghost rounded-full px-2.5 py-1 font-bold"
              aria-label="Yakınlaştır"
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setPanelOpen((o) => !o)}
              className="btn-ghost rounded-full px-3 py-1 font-semibold"
            >
              🖍 Vurgular ({highlights.length})
            </button>
            {downloadUrl && (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost rounded-full px-3 py-1 font-semibold"
              >
                ↗ Yeni sekmede
              </a>
            )}
          </>
        )}
      </div>

      {!doc && !error && (
        <p className="py-16 text-center text-sm text-stone-500">PDF yükleniyor…</p>
      )}
      {error && <p className="py-16 text-center text-sm text-rose-600">{error}</p>}
      {doc && !error && (
        <p className="mt-2 text-center text-[11px] text-stone-500">
          Metni seç → renk ile fosforla veya Post-it&apos;e kaydet.
        </p>
      )}

      <div className="mt-3 flex items-start gap-4">
        <div
          ref={containerRef}
          className="flex min-w-0 flex-1 flex-col items-center gap-4 overflow-x-auto"
        >
          {doc &&
            pdfjs &&
            scale > 0 &&
            Array.from({ length: doc.numPages }, (_, i) => (
              <PdfPage
                key={i + 1}
                doc={doc}
                pdfjs={pdfjs}
                pageNumber={i + 1}
                scale={scale}
                size={pageSize}
                flashId={flashId}
                hoverId={hoverId}
                onHover={setHoverId}
                onPickHighlight={openMenu}
                highlights={highlights.filter((h) => h.page === i + 1)}
              />
            ))}
        </div>

        {panelOpen && (
          <aside
            data-no-explain
            className="glass-card sticky top-16 hidden max-h-[75vh] w-72 shrink-0 overflow-y-auto rounded-2xl p-3 md:block"
          >
            <h2 className="mb-2 text-sm font-bold">Vurgular</h2>
            {sorted.length === 0 && (
              <p className="text-xs text-stone-500">Henüz vurgu yok.</p>
            )}
            <ul className="space-y-2">
              {sorted.map((h) => (
                <li
                  key={h.id}
                  className="rounded-lg border border-[var(--border)] p-2 text-xs"
                >
                  <button
                    type="button"
                    onClick={() => goToHighlight(h)}
                    className="block w-full text-left"
                  >
                    <span
                      className="rounded px-1 text-stone-900"
                      style={{ background: h.color }}
                    >
                      s. {h.page}
                    </span>
                    <span className="mt-1 line-clamp-4 block">{h.text}</span>
                  </button>
                  <div className="mt-1.5 flex gap-3 text-[11px] font-semibold">
                    <button type="button" onClick={() => askTagFor(h)}>
                      📌 Post-it
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("Bu vurgu silinsin mi?")) removeHighlight(h.id);
                      }}
                      className="text-rose-600"
                    >
                      Sil
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>

      {panelOpen && (
        <div className="mt-4 space-y-2 md:hidden" data-no-explain>
          <h2 className="text-sm font-bold">Vurgular</h2>
          {sorted.map((h) => (
            <div key={h.id} className="rounded-lg border border-[var(--border)] p-2 text-xs">
              <button type="button" onClick={() => goToHighlight(h)} className="block text-left">
                <span className="rounded px-1 text-stone-900" style={{ background: h.color }}>
                  s. {h.page}
                </span>{" "}
                {h.text}
              </button>
              <div className="mt-1.5 flex gap-3 font-semibold">
                <button type="button" onClick={() => askTagFor(h)}>
                  📌 Post-it
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Bu vurgu silinsin mi?")) removeHighlight(h.id);
                  }}
                  className="text-rose-600"
                >
                  Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pending && (
        <div
          ref={toolbarRef}
          data-no-explain
          // Keep the text selected while buttons are pressed (inputs stay usable).
          onMouseDown={(e) => {
            if (!(e.target as Element).closest("input")) e.preventDefault();
          }}
          className="glass-card fixed z-40 flex max-w-[calc(100vw-1rem)] flex-wrap items-center gap-1.5 rounded-2xl px-2.5 py-1.5 shadow-lg"
          style={{
            // The tag panel is tall; keep it fully on screen.
            top: tagging ? Math.max(8, Math.min(pending.top, window.innerHeight - 380)) : pending.top,
            left: pending.left,
          }}
        >
          {!tagging ? (
            <>
              {PDF_HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  title="Fosforla"
                  aria-label="Fosforla"
                  onClick={() => highlight(c)}
                  className="h-6 w-6 rounded-full border border-black/20 transition-transform hover:scale-110"
                  style={{ background: c }}
                />
              ))}
              <span className="mx-1 h-5 w-px bg-stone-400/40" />
              <button
                type="button"
                onClick={() => setTagging(true)}
                className="rounded-full px-2.5 py-1 text-xs font-semibold hover:bg-stone-500/10"
              >
                📌 Post-it
              </button>
              <button
                type="button"
                onClick={() => void translatePending()}
                title="Seçili İngilizce metni Türkçeye çevir, önizle ve Türkçe post-it olarak kaydet"
                className="rounded-full px-2.5 py-1 text-xs font-semibold hover:bg-stone-500/10"
              >
                🇹🇷 Türkçe
              </button>
              {trView && (
                <div className="basis-full space-y-1.5 border-t border-stone-400/30 pt-1.5 text-xs">
                  {trView.busy ? (
                    <p className="text-stone-500">Çevriliyor…</p>
                  ) : trView.err ? (
                    <p className="text-rose-600">{trView.err}</p>
                  ) : (
                    <>
                      <p className="max-h-40 w-72 max-w-full overflow-y-auto whitespace-pre-wrap">
                        {trView.text}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setTr({ ...trView, accepted: true });
                            setTagging(true);
                          }}
                          className="rounded-full bg-emerald-600 px-2.5 py-1 font-semibold text-white hover:bg-emerald-700"
                        >
                          📌 Türkçe Post-it
                        </button>
                        <button
                          type="button"
                          onClick={() => setTr(null)}
                          className="rounded-full px-2.5 py-1 font-semibold text-stone-500 hover:bg-stone-500/10"
                        >
                          Vazgeç
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <TagPicker
              tags={tags}
              setTags={setTags}
              category={tagCategory}
              onPick={saveTaggedPostit}
              onBack={() => setTagging(false)}
            />
          )}
        </div>
      )}

      {menu &&
        (() => {
          const h = highlights.find((x) => x.id === menu.id);
          if (!h) return null;
          return (
            <div
              ref={menuRef}
              data-no-explain
              className="glass-card fixed z-40 rounded-2xl p-2 shadow-xl"
              style={{ top: menu.top, left: menu.left }}
            >
              {menu.mode === "tag" ? (
                <TagPicker
                  tags={tags}
                  setTags={setTags}
                  category={tagCategory}
                  onPick={(name) => retag(h.id, name)}
                  onBack={() => setMenu({ ...menu, mode: "main" })}
                />
              ) : (
                <div className="w-64 space-y-2 p-1 text-xs">
                  <p className="line-clamp-2 italic text-stone-500">
                    s. {h.page} · “{h.text}”
                  </p>
                  <div className="flex items-center gap-1.5">
                    {PDF_HIGHLIGHT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        title="Fosfor rengini değiştir"
                        aria-label="Fosfor rengini değiştir"
                        onClick={() => void recolor(h.id, c)}
                        className={`h-5 w-5 rounded-full border border-black/20 ${h.color === c ? "ring-2 ring-stone-500 ring-offset-1" : ""}`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                  <p className="text-[11px] text-stone-500">
                    Etiket:{" "}
                    {menuTags === null ? "…" : menuTags.length ? menuTags.map((t) => `#${t}`).join(" ") : "yok"}
                  </p>
                  <div className="flex gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setMenu({ ...menu, mode: "tag" })}
                      className="flex-1 rounded-md bg-stone-900 px-2 py-1.5 font-semibold text-white dark:bg-stone-100 dark:text-stone-900"
                    >
                      🏷 Etiketi değiştir
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenu(null);
                        if (window.confirm("Bu vurgu silinsin mi?")) void removeHighlight(h.id);
                      }}
                      className="rounded-md border border-rose-400/60 px-3 py-1.5 font-semibold text-rose-600 hover:bg-rose-500/10"
                    >
                      Sil
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-stone-900 px-4 py-2 text-xs font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

/** One lazily-rendered page: canvas + selectable text layer + highlight overlay. */
function PdfPage({
  doc,
  pdfjs,
  pageNumber,
  scale,
  size: base,
  flashId,
  hoverId,
  onHover,
  onPickHighlight,
  highlights,
}: {
  doc: PDFDocumentProxy;
  pdfjs: PdfJs;
  pageNumber: number;
  scale: number;
  size: { w: number; h: number };
  flashId: string | null;
  hoverId: string | null;
  onHover: (id: string | null) => void;
  onPickHighlight: (id: string, x: number, y: number) => void;
  highlights: PdfHighlight[];
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [size, setSize] = useState({ w: base.w * scale, h: base.h * scale });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let renderTask: { cancel: () => void; promise: Promise<unknown> } | null = null;
    let textLayer: { cancel: () => void } | null = null;
    const listeners = new AbortController();
    (async () => {
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      setSize({ w: viewport.width, h: viewport.height });

      const canvas = canvasRef.current;
      const textDiv = textRef.current;
      if (!canvas || !textDiv) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      renderTask = page.render({ canvas, canvasContext: ctx, viewport });
      textDiv.replaceChildren();
      textDiv.style.setProperty("--total-scale-factor", String(scale));
      textDiv.style.setProperty("--scale-factor", String(scale));
      const tl = new pdfjs.TextLayer({
        textContentSource: page.streamTextContent(),
        container: textDiv,
        viewport,
      });
      textLayer = tl;
      try {
        await Promise.all([renderTask.promise, tl.render()]);
      } catch {
        /* cancelled by a newer render */
      }
      if (cancelled) return;

      // Selection guard (what pdf.js's own viewer adds): while a selection is
      // active, a block covers the whole text layer so dragging across the gaps
      // between lines and paragraphs never drops the selection.
      const end = document.createElement("div");
      end.className = "endOfContent";
      textDiv.append(end);
      const reset = () => {
        textDiv.append(end);
        textDiv.classList.remove("selecting");
      };
      const { signal } = listeners;
      textDiv.addEventListener("mousedown", () => textDiv.classList.add("selecting"), { signal });
      document.addEventListener("pointerup", reset, { signal });
      window.addEventListener("blur", reset, { signal });
      document.addEventListener(
        "selectionchange",
        () => {
          const sel = document.getSelection();
          let hit = false;
          for (let i = 0; sel && i < sel.rangeCount; i++) {
            if (sel.getRangeAt(i).intersectsNode(textDiv)) hit = true;
          }
          if (hit) textDiv.classList.add("selecting");
          else reset();
        },
        { signal },
      );
    })();
    return () => {
      cancelled = true;
      listeners.abort();
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [visible, doc, pdfjs, pageNumber, scale]);

  /** Topmost highlight under the pointer (the overlay itself ignores events). */
  function hitAt(e: React.MouseEvent): PdfHighlight | null {
    const box = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - box.left) / box.width;
    const fy = (e.clientY - box.top) / box.height;
    for (let i = highlights.length - 1; i >= 0; i--) {
      if (highlights[i].rects.some((r) => fx >= r.x && fx <= r.x + r.w && fy >= r.y && fy <= r.y + r.h)) {
        return highlights[i];
      }
    }
    return null;
  }

  return (
    <div
      ref={wrapRef}
      onMouseMove={(e) => {
        if (e.buttons) return; // dragging a selection
        const id = hitAt(e)?.id ?? null;
        if (id !== hoverId) onHover(id);
      }}
      onMouseLeave={() => hoverId && onHover(null)}
      onClick={(e) => {
        const h = hitAt(e);
        if (h && window.getSelection()?.isCollapsed) onPickHighlight(h.id, e.clientX, e.clientY);
      }}
      data-pdf-page={pageNumber}
      className="relative shrink-0 bg-white shadow-md"
      style={{ width: size.w, height: size.h }}
    >
      <canvas ref={canvasRef} className="absolute left-0 top-0" />
      {/* Highlights sit between the canvas and the (transparent) text layer. */}
      <div className="pointer-events-none absolute inset-0">
        {highlights.flatMap((h) =>
          h.rects.map((r, i) => (
            <span
              key={`${h.id}-${i}`}
              data-hl-id={h.id}
              className={`absolute ${flashId === h.id ? "tag-mark-flash" : ""}`}
              style={{
                left: `${r.x * 100}%`,
                top: `${r.y * 100}%`,
                width: `${r.w * 100}%`,
                height: `${r.h * 100}%`,
                background: h.color,
                mixBlendMode: "multiply",
                opacity: hoverId === h.id ? 1 : 0.7,
                outline: hoverId === h.id ? "2px solid rgba(217,119,6,0.9)" : "none",
                transition: "opacity 120ms",
              }}
            />
          )),
        )}
      </div>
      <div
        ref={textRef}
        className={`textLayer absolute inset-0 ${hoverId && highlights.some((h) => h.id === hoverId) ? "[&_span]:!cursor-pointer" : ""}`}
      />
      <span className="pointer-events-none absolute bottom-1 right-2 text-[10px] text-stone-400">
        {pageNumber}
      </span>
    </div>
  );
}
