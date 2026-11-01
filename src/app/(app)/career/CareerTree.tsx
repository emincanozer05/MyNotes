"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import {
  BRANCH_COLORS,
  STATUS_LABEL,
  computeStats,
  indexTree,
  layoutTree,
  newNode,
  pathTo,
  sampleTree,
  subtreeIds,
  type CareerNode,
} from "@/lib/career";
import { deleteCareerNode, saveCareerNodes } from "./actions";
import { NodePanel, type NodePatch } from "./NodePanel";
import { TreeCanvas, type CanvasHandle } from "./TreeCanvas";

type SaveState = { kind: "idle" | "saving" | "saved" } | { kind: "error"; message: string };

const DEFAULT_TRUNK = "Uluslararası S&C Antrenörü Olmak";
/** Debounce for persisting edits (text fields debounce on their own too). */
const SAVE_DELAY = 250;

/**
 * Kariyer Yol Haritası: the whole tree lives in local state and is written
 * through to Supabase (optimistic: the UI never waits for the network). All
 * writes are chained, so they reach the database in the order they happened.
 */
export function CareerTree({
  initialNodes,
  setupError,
}: {
  initialNodes: CareerNode[];
  setupError: string | null;
}) {
  const [nodes, setNodes] = useState(initialNodes);
  const nodesRef = useRef(initialNodes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string; nonce: number; center: boolean } | null>(null);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [full, setFull] = useState(false);
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [trunkTitle, setTrunkTitle] = useState(DEFAULT_TRUNK);
  const [withSample, setWithSample] = useState(true);

  const canvasRef = useRef<CanvasHandle>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const focusNonce = useRef(0);

  const tree = useMemo(() => indexTree(nodes), [nodes]);
  const stats = useMemo(() => computeStats(tree), [tree]);
  const layout = useMemo(() => layoutTree(tree), [tree]);
  const statsRef = useRef(stats);
  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  const root = tree.root;
  const rootStats = root ? stats.get(root.id) : undefined;
  const selected = selectedId ? (tree.byId.get(selectedId) ?? null) : null;

  // ------------------------------------------------------- completion pulse
  // Detected while rendering (not in an effect): a node that wasn't done
  // before but is now gets a one-off pulse on its ring; its connectors fill
  // via a CSS transition.
  const doneIds = useMemo(
    () => new Set([...stats].filter(([, s]) => s.status === "done").map(([id]) => id)),
    [stats],
  );
  const [prevDone, setPrevDone] = useState(doneIds);
  const [celebrate, setCelebrate] = useState<{ ids: Set<string>; key: number }>({
    ids: new Set(),
    key: 0,
  });
  if (prevDone !== doneIds) {
    setPrevDone(doneIds);
    const fresh = [...doneIds].filter((id) => !prevDone.has(id));
    if (fresh.length > 0) {
      setCelebrate((c) => ({ ids: new Set(fresh), key: c.key + 1 }));
    }
  }
  useEffect(() => {
    if (celebrate.ids.size === 0) return;
    const t = setTimeout(
      () => setCelebrate((c) => (c.key === celebrate.key ? { ...c, ids: new Set() } : c)),
      1500,
    );
    return () => clearTimeout(t);
  }, [celebrate]);

  // ------------------------------------------------------------ persistence
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const queue = useRef<Promise<void>>(Promise.resolve());
  const inflight = useRef(0);
  const failed = useRef(new Set<string>());

  const enqueue = useCallback((ids: string[], task: () => Promise<{ error: string | null }>) => {
    inflight.current += 1;
    setSave({ kind: "saving" });
    queue.current = queue.current.then(async () => {
      let error: string | null = null;
      try {
        error = (await task()).error;
      } catch {
        // Request got no answer (flaky tablet link): retry once before failing.
        try {
          await new Promise((r) => setTimeout(r, 1500));
          error = (await task()).error;
        } catch {
          error = "Bağlantı hatası: değişiklikler kaydedilemedi.";
        }
      }
      inflight.current -= 1;
      if (error) {
        ids.forEach((id) => failed.current.add(id));
        setSave({ kind: "error", message: error });
      } else {
        ids.forEach((id) => failed.current.delete(id));
        if (inflight.current === 0 && failed.current.size === 0) setSave({ kind: "saved" });
      }
    });
  }, []);

  const saveNow = useCallback(
    (ids: string[]) => {
      const byId = new Map(nodesRef.current.map((n) => [n.id, n]));
      const unique = [...new Set(ids)];
      for (const id of unique) {
        const t = timers.current.get(id);
        if (t) clearTimeout(t);
        timers.current.delete(id);
      }
      const rows = unique.map((id) => byId.get(id)).filter((n): n is CareerNode => Boolean(n));
      if (rows.length === 0) return;
      enqueue(
        rows.map((r) => r.id),
        () => saveCareerNodes(rows),
      );
    },
    [enqueue],
  );

  const saveSoon = useCallback(
    (id: string) => {
      const prev = timers.current.get(id);
      if (prev) clearTimeout(prev);
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          saveNow([id]);
        }, SAVE_DELAY),
      );
      setSave({ kind: "saving" });
    },
    [saveNow],
  );

  // Don't lose a pending edit when the tab is hidden / closed / navigated away.
  useEffect(() => {
    const flush = () => {
      if (timers.current.size > 0) saveNow([...timers.current.keys()]);
    };
    const onHide = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [saveNow]);

  function retrySave() {
    saveNow([...failed.current]);
  }

  const commit = useCallback((next: CareerNode[]) => {
    nodesRef.current = next;
    setNodes(next);
  }, []);

  // ------------------------------------------------------------- operations
  const requestFocus = useCallback((id: string, center: boolean) => {
    focusNonce.current += 1;
    setFocus({ id, nonce: focusNonce.current, center });
  }, []);

  const update = useCallback(
    (id: string, patch: NodePatch) => {
      const list = nodesRef.current;
      const cur = list.find((n) => n.id === id);
      if (!cur) return;
      const p = typeof patch === "function" ? patch(cur) : patch;
      if (p.title !== undefined && !p.title.trim()) return;
      // Locked goals can't be started or finished.
      if (p.status && p.status !== "not_started" && statsRef.current.get(id)?.locked) return;
      const merged: CareerNode = { ...cur, ...p };
      if (p.status && p.status !== cur.status) {
        merged.completed_at = p.status === "done" ? new Date().toISOString() : null;
      }
      commit(list.map((n) => (n.id === id ? merged : n)));
      saveSoon(id);
    },
    [commit, saveSoon],
  );

  const addChild = useCallback(
    (parentId: string, title: string, opts: { select: boolean } = { select: false }) => {
      const list = nodesRef.current;
      const parent = list.find((n) => n.id === parentId);
      if (!parent) return;
      const siblings = list.filter((n) => n.parent_id === parentId);
      const order = siblings.reduce((m, s) => Math.max(m, s.sort_order), -1) + 1;
      const isMain = parent.parent_id === null;
      const node = newNode(parentId, title, order, {
        color: isMain ? BRANCH_COLORS[siblings.length % BRANCH_COLORS.length].key : null,
      });
      const touched = [node.id];
      const next = list.map((n) => {
        if (n.id === parentId && n.collapsed) {
          touched.push(n.id);
          return { ...n, collapsed: false };
        }
        return n;
      });
      next.push(node);
      commit(next);
      saveNow(touched);
      requestFocus(node.id, false);
      if (opts.select) {
        setSelectedId(node.id);
        setCreated(node.id);
      }
    },
    [commit, saveNow, requestFocus],
  );

  const addFromCanvas = useCallback(
    (parentId: string) => {
      const isRoot = nodesRef.current.find((n) => n.id === parentId)?.parent_id === null;
      addChild(parentId, isRoot ? "Yeni ana dal" : "Yeni hedef", { select: true });
    },
    [addChild],
  );

  const toggle = useCallback(
    (id: string) => {
      const list = nodesRef.current;
      const cur = list.find((n) => n.id === id);
      if (!cur) return;
      const collapsing = !cur.collapsed;
      commit(list.map((n) => (n.id === id ? { ...n, collapsed: collapsing } : n)));
      saveNow([id]);
      // Never leave the open panel on a goal that just disappeared.
      if (collapsing) {
        setSelectedId((sel) => {
          if (!sel || sel === id) return sel;
          const t = indexTree(nodesRef.current);
          return subtreeIds(t, id).includes(sel) ? id : sel;
        });
      }
    },
    [commit, saveNow],
  );

  const move = useCallback(
    (id: string, parentId: string) => {
      const list = nodesRef.current;
      const cur = list.find((n) => n.id === id);
      const target = list.find((n) => n.id === parentId);
      if (!cur || !target || cur.parent_id === null || cur.parent_id === parentId) return;
      if (subtreeIds(indexTree(list), id).includes(parentId)) return;
      const siblings = list.filter((n) => n.parent_id === parentId);
      const order = siblings.reduce((m, s) => Math.max(m, s.sort_order), -1) + 1;
      const touched = [id];
      const next = list.map((n) => {
        if (n.id === id) {
          return {
            ...n,
            parent_id: parentId,
            sort_order: order,
            // A goal promoted to a main branch needs a colour of its own.
            color:
              target.parent_id === null && !n.color
                ? BRANCH_COLORS[siblings.length % BRANCH_COLORS.length].key
                : n.color,
            side: null,
          };
        }
        if (n.id === parentId && n.collapsed) {
          touched.push(n.id);
          return { ...n, collapsed: false };
        }
        return n;
      });
      commit(next);
      saveNow(touched);
      requestFocus(id, false);
    },
    [commit, saveNow, requestFocus],
  );

  const reorder = useCallback(
    (id: string, delta: -1 | 1) => {
      const list = nodesRef.current;
      const cur = list.find((n) => n.id === id);
      if (!cur?.parent_id) return;
      const t = indexTree(list);
      const sibs = (t.children.get(cur.parent_id) ?? []).map((s) => s.id);
      const i = sibs.indexOf(id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= sibs.length) return;
      [sibs[i], sibs[j]] = [sibs[j], sibs[i]];
      const order = new Map(sibs.map((sid, idx) => [sid, idx]));
      commit(list.map((n) => (order.has(n.id) ? { ...n, sort_order: order.get(n.id)! } : n)));
      saveNow(sibs);
    },
    [commit, saveNow],
  );

  const remove = useCallback(
    (id: string) => {
      const list = nodesRef.current;
      const t = indexTree(list);
      const cur = t.byId.get(id);
      if (!cur || cur.parent_id === null) return;
      const doomed = new Set(subtreeIds(t, id));
      const msg =
        doomed.size > 1
          ? `“${cur.title}” ve altındaki ${doomed.size - 1} hedef silinsin mi?`
          : `“${cur.title}” silinsin mi?`;
      if (!window.confirm(msg)) return;
      const touched: string[] = [];
      const next = list
        .filter((n) => !doomed.has(n.id))
        .map((n) => {
          if (n.prerequisites.some((p) => doomed.has(p))) {
            touched.push(n.id);
            return { ...n, prerequisites: n.prerequisites.filter((p) => !doomed.has(p)) };
          }
          return n;
        });
      for (const d of doomed) {
        const tm = timers.current.get(d);
        if (tm) clearTimeout(tm);
        timers.current.delete(d);
        failed.current.delete(d);
      }
      commit(next);
      setSelectedId(cur.parent_id);
      enqueue([id], () => deleteCareerNode(id));
      if (touched.length) saveNow(touched);
    },
    [commit, enqueue, saveNow],
  );

  const select = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      setCreated(null);
      // Keep the chosen goal clear of the detail panel that opens beside it.
      if (id) requestFocus(id, false);
    },
    [requestFocus],
  );

  const mainBranchesOpen = useMemo(
    () =>
      root
        ? (tree.children.get(root.id) ?? []).some(
            (m) => !m.collapsed && (tree.children.get(m.id)?.length ?? 0) > 0,
          )
        : false,
    [tree, root],
  );

  function toggleAll() {
    if (!root) return;
    const list = nodesRef.current;
    const collapse = mainBranchesOpen;
    const touched: string[] = [];
    const next = list.map((n) => {
      const hasKids = (tree.children.get(n.id)?.length ?? 0) > 0;
      if (!hasKids || n.id === root.id) return n;
      const want = collapse ? n.parent_id === root.id : false;
      if (n.collapsed === want) return n;
      touched.push(n.id);
      return { ...n, collapsed: want };
    });
    if (touched.length === 0) return;
    commit(next);
    saveNow(touched);
    if (collapse) setSelectedId((sel) => (sel && tree.byId.get(sel)?.parent_id !== null && pathTo(tree, sel).length > 2 ? null : sel));
    setTimeout(() => canvasRef.current?.fit(), 60);
  }

  function createTrunk() {
    const title = trunkTitle.trim() || DEFAULT_TRUNK;
    const list = withSample ? sampleTree(title) : [newNode(null, title, 0)];
    commit(list);
    saveNow(list.map((n) => n.id));
  }

  // ----------------------------------------------------------------- search
  const q = query.trim().toLocaleLowerCase("tr");
  const matches = useMemo(() => {
    if (!q) return [];
    return nodes.filter((n) =>
      [
        n.title,
        n.description,
        n.notes,
        ...n.subtasks.map((s) => s.text),
        ...n.resources.map((r) => r.title),
      ]
        .join(" \n ")
        .toLocaleLowerCase("tr")
        .includes(q),
    );
  }, [nodes, q]);
  const matchIds = useMemo(
    () => (q ? new Set(matches.map((m) => m.id)) : null),
    [q, matches],
  );

  function reveal(id: string) {
    const list = nodesRef.current;
    const t = indexTree(list);
    const hidden = pathTo(t, id).slice(0, -1).filter((n) => n.collapsed);
    if (hidden.length) {
      const ids = new Set(hidden.map((h) => h.id));
      commit(list.map((n) => (ids.has(n.id) ? { ...n, collapsed: false } : n)));
      saveNow([...ids]);
    }
    setSelectedId(id);
    setCreated(null);
    requestFocus(id, true);
  }

  function pickMatch(id: string) {
    reveal(id);
    setQuery("");
    setSearchOpen(false);
  }

  // ------------------------------------------------------------- fullscreen
  function toggleFull() {
    const next = !full;
    setFull(next);
    const el = wrapRef.current;
    if (next) el?.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    setTimeout(() => canvasRef.current?.fit(), 120);
  }
  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) setFull((f) => (f ? false : f));
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  useEffect(() => {
    if (!full) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) setFull(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);

  // ----------------------------------------------------------------- render
  const overallPct = Math.round((rootStats?.progress ?? 0) * 100);
  const total = rootStats?.leaves ?? 0;

  return (
    <div
      ref={wrapRef}
      className={
        full
          ? "fixed inset-0 z-[70] flex flex-col gap-3 bg-[var(--background)] p-3"
          : "flex h-[calc(100dvh-7.5rem)] min-h-[480px] flex-col gap-3"
      }
    >
      <div className="no-print flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">Kariyer Yol Haritası</h1>
          {root && (
            <p className="truncate text-xs text-[var(--muted)]">
              %{overallPct} tamamlandı · {rootStats?.leavesDone ?? 0}/{total} hedef
              <SaveBadge save={save} onRetry={retrySave} />
            </p>
          )}
        </div>

        {root && (
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none">
              <Icon
                name="search"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 120)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && matches[0]) pickMatch(matches[0].id);
                  if (e.key === "Escape") setQuery("");
                }}
                placeholder="Hedef ara…"
                aria-label="Ağaçta hedef ara"
                className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-4 text-sm outline-none transition-colors focus:border-[var(--brand-1)]"
              />
              {searchOpen && q && (
                <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 shadow-[var(--shadow-2)]">
                  {matches.length === 0 && (
                    <li className="px-3 py-2 text-sm text-[var(--muted)]">Sonuç yok.</li>
                  )}
                  {matches.slice(0, 8).map((m) => {
                    const trail = pathTo(tree, m.id)
                      .slice(1, -1)
                      .map((p) => p.title)
                      .join(" › ");
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pickMatch(m.id)}
                          className="block w-full px-3 py-2 text-left transition-colors hover:bg-[var(--surface-2)]"
                        >
                          <span className="block truncate text-sm font-semibold">{m.title}</span>
                          <span className="block truncate text-xs text-[var(--muted)]">
                            {trail || "Ana hedef"} · {STATUS_LABEL[stats.get(m.id)?.status ?? "not_started"]}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <button
              type="button"
              onClick={() => addFromCanvas(root.id)}
              className="btn-gradient flex shrink-0 items-center gap-1 rounded-full px-3.5 py-2 text-sm font-semibold"
            >
              <Icon name="plus" className="h-4 w-4" /> Ana dal
            </button>
          </div>
        )}
      </div>

      {setupError && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          {setupError}
        </p>
      )}

      <div className="relative flex min-h-0 flex-1 gap-3">
        <div className="relative min-w-0 flex-1 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          {/* Faint dot grid, same as the network map */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-60"
            style={{
              backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />

          {root ? (
            <>
              <TreeCanvas
                ref={canvasRef}
                layout={layout}
                tree={tree}
                stats={stats}
                selectedId={selected?.id ?? null}
                matchIds={matchIds}
                celebrate={celebrate}
                focus={focus}
                onSelect={select}
                onToggle={toggle}
                onAdd={addFromCanvas}
                onMove={move}
              />

              <div className="no-print absolute right-3 top-3 flex flex-col gap-1.5">
                <ToolButton label="Yakınlaştır" onClick={() => canvasRef.current?.zoomBy(1.3)}>
                  <Icon name="plus" className="h-4 w-4" />
                </ToolButton>
                <ToolButton label="Uzaklaştır" onClick={() => canvasRef.current?.zoomBy(1 / 1.3)}>
                  <Icon name="minus" className="h-4 w-4" />
                </ToolButton>
                <ToolButton label="Ağacın tamamını sığdır" onClick={() => canvasRef.current?.fit()}>
                  <Icon name="tree" className="h-4 w-4" />
                </ToolButton>
                <ToolButton
                  label={mainBranchesOpen ? "Ana dalları kapat" : "Tüm dalları aç"}
                  onClick={toggleAll}
                >
                  <Icon name={mainBranchesOpen ? "chevron-up" : "chevron-down"} className="h-4 w-4" />
                </ToolButton>
                <ToolButton
                  label={full ? "Tam ekrandan çık" : "Tam ekran"}
                  onClick={toggleFull}
                  active={full}
                >
                  <Icon name={full ? "x" : "maximize"} className="h-4 w-4" />
                </ToolButton>
              </div>

              <Legend />
            </>
          ) : (
            <div className="relative flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--brand-1)]">
                <Icon name="tree" className="h-7 w-7" />
              </span>
              <div>
                <h2 className="text-xl font-bold">Kariyer ağacını dik</h2>
                <p className="mx-auto mt-1 max-w-md text-sm text-[var(--muted)]">
                  Ana hedefin ağacın gövdesi olur; gelişim alanların dallara, hedefler ve
                  görevler dalların üzerindeki düğümlere dönüşür.
                </p>
              </div>
              <label className="w-full max-w-sm text-left">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Ana kariyer hedefi
                </span>
                <input
                  value={trunkTitle}
                  onChange={(e) => setTrunkTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !setupError && createTrunk()}
                  maxLength={200}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--brand-1)]"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={withSample}
                  onChange={(e) => setWithSample(e.target.checked)}
                  className="h-4 w-4 accent-[var(--brand-1)]"
                />
                Örnek dallarla başla (Akademik, Mesleki, Dil, Deneyim, Kişisel)
              </label>
              <button
                type="button"
                onClick={createTrunk}
                disabled={Boolean(setupError)}
                className="btn-gradient rounded-full px-5 py-2 text-sm font-semibold disabled:opacity-50"
              >
                Ağacı oluştur
              </button>
            </div>
          )}
        </div>

        {selected && (
          <div className="absolute inset-x-1 bottom-1 z-20 h-[62%] lg:static lg:inset-auto lg:z-auto lg:h-auto lg:w-[360px] lg:shrink-0">
            <NodePanel
              key={selected.id}
              node={selected}
              tree={tree}
              stats={stats}
              titleFocus={created === selected.id}
              onUpdate={update}
              onAddChild={(pid, title) => addChild(pid, title)}
              onMove={move}
              onReorder={reorder}
              onDelete={remove}
              onSelect={select}
              onClose={() => select(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SaveBadge({ save, onRetry }: { save: SaveState; onRetry: () => void }) {
  if (save.kind === "idle") return null;
  return (
    <span role="status" className="ml-2">
      {save.kind === "saving" && <span>· Kaydediliyor…</span>}
      {save.kind === "saved" && <span>· Kaydedildi</span>}
      {save.kind === "error" && (
        <span className="text-[var(--brand-2)]">
          · {save.message}{" "}
          <button type="button" onClick={onRetry} className="font-semibold underline">
            Yeniden dene
          </button>
        </span>
      )}
    </span>
  );
}

function ToolButton({
  label,
  onClick,
  children,
  active = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] shadow-[var(--shadow-1)] transition-colors hover:bg-[var(--surface-2)] ${
        active ? "bg-[var(--surface-2)] text-[var(--brand-1)]" : "bg-[var(--surface)] text-[var(--muted)]"
      }`}
    >
      {children}
    </button>
  );
}

/** Colour-independent key: ring fill + centre mark tell the states apart. */
function Legend() {
  const item = (label: string, glyph: React.ReactNode) => (
    <span className="flex items-center gap-1.5">
      <svg width="16" height="16" viewBox="-8 -8 16 16" aria-hidden>
        {glyph}
      </svg>
      {label}
    </span>
  );
  const ring = { fill: "var(--surface)", strokeWidth: 2 };
  return (
    <div className="no-print pointer-events-none absolute bottom-3 left-3 hidden max-w-[calc(100%-5rem)] flex-wrap items-center gap-x-3.5 gap-y-1 rounded-xl bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] px-3 py-1.5 text-[11px] text-[var(--muted)] sm:flex">
      {item(
        "Tamamlandı",
        <>
          <circle r="6" fill="var(--brand-4)" stroke="var(--brand-4)" strokeWidth="2" />
          <path d="M-2.4 0.2L-0.6 2 2.6-1.6" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
        </>,
      )}
      {item(
        "Devam ediyor",
        <>
          <circle r="6" stroke="var(--border-strong)" {...ring} />
          <path d="M0 -6A6 6 0 0 1 0 6" fill="none" stroke="var(--brand-4)" strokeWidth="2" />
          <circle r="1.7" fill="var(--brand-4)" />
        </>,
      )}
      {item("Başlanmadı", <circle r="6" stroke="var(--border-strong)" {...ring} opacity={0.6} />)}
      {item(
        "Kilitli",
        <>
          <circle r="6" stroke="var(--border-strong)" strokeDasharray="2.5 2" {...ring} />
          <rect x="-2" y="-0.5" width="4" height="3.2" rx="0.6" fill="var(--muted)" />
          <path d="M-1.2 -0.5V-1.6a1.2 1.2 0 0 1 2.4 0V-0.5" fill="none" stroke="var(--muted)" strokeWidth="0.9" />
        </>,
      )}
      <span className="hidden lg:inline">· Bir düğümü başka dalın üzerine sürükleyerek taşı</span>
    </div>
  );
}
