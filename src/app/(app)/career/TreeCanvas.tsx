"use client";

import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from "react";
import { PinchTracker, type PinchView } from "@/lib/pinchZoom";
import {
  LINE_H,
  STATUS_LABEL,
  branchPath,
  branchWidth,
  subtreeIds,
  type Layout,
  type LayoutNode,
  type NodeStats,
  type TreeIndex,
} from "@/lib/career";

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;
/** Smallest zoom at which labels stay readable on the first view. */
const READABLE_ZOOM = 0.55;
/** Pointer travel (px) before a press on a node turns into a drag. */
const DRAG_THRESHOLD = 7;

export interface CanvasHandle {
  fit: () => void;
  zoomBy: (factor: number) => void;
}

type NodeState = "done" | "progress" | "idle" | "locked";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ----------------------------------------------------------------- edges

const BranchEdge = memo(function BranchEdge({
  d,
  width,
  color,
  progress,
  dashed,
  glow,
}: {
  d: string;
  width: number;
  color: string;
  progress: number;
  dashed: boolean;
  glow: boolean;
}) {
  // `d` is also set as a CSS property so browsers that support it ease the
  // branch into its new shape when the layout changes.
  const style = { d: `path("${d}")` } as CSSProperties;
  return (
    <g className={progress <= 0 ? "career-edge-idle" : undefined}>
      <path
        d={d}
        style={style}
        className="career-edge"
        fill="none"
        stroke="var(--border-strong)"
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={dashed ? `${width * 1.6} ${width * 2.6}` : undefined}
      />
      {progress > 0 && (
        <path
          d={d}
          style={
            {
              ...style,
              filter: glow
                ? `drop-shadow(0 0 5px color-mix(in srgb, ${color} 55%, transparent))`
                : undefined,
            } as CSSProperties
          }
          className="career-edge career-edge-fill"
          fill="none"
          stroke={color}
          strokeWidth={width}
          pathLength={1}
          strokeDasharray={`${Math.min(progress, 1)} 1.01`}
        />
      )}
    </g>
  );
});

// ----------------------------------------------------------------- nodes

interface NodeViewProps {
  id: string;
  x: number;
  y: number;
  r: number;
  depth: number;
  dir: -1 | 0 | 1;
  color: string;
  lines: string[];
  labelWidth: number;
  sub: string;
  aria: string;
  progress: number;
  state: NodeState;
  selected: boolean;
  match: "hit" | "miss" | null;
  dragging: boolean;
  target: boolean;
  collapsed: boolean;
  hiddenCount: number;
  hasChildren: boolean;
  pulse: number;
  onToggle: (id: string) => void;
  onAdd: (id: string) => void;
  onActivate: (id: string) => void;
}

const RING = [4.5, 3.6, 3, 2.6];

const NodeView = memo(function NodeView(p: NodeViewProps) {
  const { r, depth, dir, color, state } = p;
  const ring = RING[Math.min(depth, RING.length - 1)];
  const accent = state === "idle" || state === "locked" ? "var(--muted)" : color;
  const isRoot = depth === 0;
  const tx = dir === 0 ? 0 : dir * (r + 9);
  const anchor = dir === 0 ? "middle" : dir > 0 ? "start" : "end";
  const fontSize = isRoot ? 15 : depth === 1 ? 13.5 : 12;

  return (
    <g
      className="career-node"
      data-node-id={p.id}
      data-state={p.state}
      data-selected={p.selected ? "" : undefined}
      data-match={p.match ?? undefined}
      data-dragging={p.dragging ? "" : undefined}
      style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
      tabIndex={0}
      role="button"
      aria-label={p.aria}
      aria-pressed={p.selected}
      onKeyDown={(e: ReactKeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          p.onActivate(p.id);
        }
      }}
    >
      <g className="career-enter">
        {/* Generous invisible hit area, so thin leaf nodes are easy to grab */}
        <circle r={r + 7} fill="transparent" />

        {p.selected && (
          <circle
            r={r + ring + 4}
            fill="none"
            stroke="var(--brand-1)"
            strokeWidth={2}
            opacity={0.85}
          />
        )}
        {p.match === "hit" && !p.selected && (
          <circle r={r + ring + 4} fill="none" stroke="var(--brand-4)" strokeWidth={2} />
        )}
        {p.target && (
          <circle
            r={r + 11}
            fill="color-mix(in srgb, var(--brand-1) 12%, transparent)"
            stroke="var(--brand-1)"
            strokeWidth={2}
            strokeDasharray="5 4"
          />
        )}
        {p.collapsed && (
          <circle
            r={r + ring + 5}
            fill="none"
            stroke={accent}
            strokeWidth={1.4}
            strokeDasharray="2 3.5"
            opacity={0.9}
          />
        )}

        {/* Track + progress ring */}
        <circle
          r={r}
          fill="var(--surface)"
          stroke="var(--border-strong)"
          strokeWidth={ring}
          strokeDasharray={p.state === "locked" ? `${ring * 1.3} ${ring * 1.5}` : undefined}
        />
        {p.progress > 0 && (
          <circle
            className="career-ring"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={ring}
            pathLength={1}
            strokeDasharray={`${Math.min(p.progress, 1)} 1.01`}
            transform="rotate(-90)"
          />
        )}

        {/* Centre mark */}
        {state === "done" && (
          <>
            <circle r={Math.max(r - ring - 1.5, 3)} fill={color} className="career-fill" />
            {!isRoot && (
              <path
                d={`M${-r * 0.32} ${r * 0.02}L${-r * 0.08} ${r * 0.28}L${r * 0.36} ${-r * 0.2}`}
                fill="none"
                stroke="#fff"
                strokeWidth={Math.max(1.6, r * 0.16)}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </>
        )}
        {state === "progress" && !isRoot && (
          <circle r={Math.max(r * 0.28, 2.2)} fill={color} />
        )}
        {state === "locked" && (
          <g
            fill="none"
            stroke="var(--muted)"
            strokeWidth={Math.max(1.3, r * 0.12)}
            strokeLinecap="round"
          >
            <rect
              x={-r * 0.34}
              y={-r * 0.04}
              width={r * 0.68}
              height={r * 0.5}
              rx={r * 0.08}
              fill="var(--muted)"
              stroke="none"
            />
            <path d={`M${-r * 0.2} ${-r * 0.04}V${-r * 0.22}a${r * 0.2} ${r * 0.2} 0 0 1 ${r * 0.4} 0V${-r * 0.04}`} />
          </g>
        )}
        {isRoot && (
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={13}
            fontWeight={700}
            fill="var(--foreground)"
            className="career-pct"
          >
            {Math.round(p.progress * 100)}%
          </text>
        )}

        {p.pulse > 0 && (
          <circle
            key={p.pulse}
            className="career-pulse"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={3}
          />
        )}

        {/* Label: name above the branch line, progress below it */}
        {isRoot ? (
          <text
            y={r + ring + 18}
            textAnchor="middle"
            fontSize={fontSize}
            fontWeight={700}
            className="career-label"
          >
            {p.lines.map((line, i) => (
              <tspan key={i} x={0} dy={i === 0 ? 0 : 18}>
                {line}
              </tspan>
            ))}
          </text>
        ) : (
          <g>
            {/* Invisible plate: the whole label is a click / drag target */}
            <rect
              x={p.dir > 0 ? tx - 4 : tx - p.labelWidth - 4}
              y={-6 - p.lines.length * LINE_H - 2}
              width={p.labelWidth + 8}
              height={p.lines.length * LINE_H + 44}
              fill="transparent"
            />
            <text
              x={tx}
              y={-6 - (p.lines.length - 1) * LINE_H}
              textAnchor={anchor}
              fontSize={fontSize}
              fontWeight={depth <= 1 ? 700 : 600}
              className="career-label"
            >
              {p.lines.map((line, i) => (
                <tspan key={i} x={tx} dy={i === 0 ? 0 : LINE_H}>
                  {line}
                </tspan>
              ))}
            </text>
            <text
              x={tx}
              y={16}
              textAnchor={anchor}
              fontSize={10.5}
              className="career-label career-sub"
            >
              {p.sub}
            </text>
          </g>
        )}

        {/* Quick actions: add a sub-goal / fold the branch */}
        <g className="career-actions">
          <rect x={-26} y={-(r + 30)} width={52} height={r + 26} fill="transparent" />
          <g
            data-action="add"
            transform={`translate(${p.hasChildren ? -12 : 0} ${-(r + 17)})`}
            onClick={(e) => {
              e.stopPropagation();
              p.onAdd(p.id);
            }}
            className="career-btn"
          >
            <title>Alt hedef ekle</title>
            <circle r={9} />
            <path d="M-4 0H4M0 -4V4" />
          </g>
          {p.hasChildren && !p.collapsed && (
            <g
              data-action="toggle"
              transform={`translate(12 ${-(r + 17)})`}
              onClick={(e) => {
                e.stopPropagation();
                p.onToggle(p.id);
              }}
              className="career-btn"
            >
              <title>Dalı kapat</title>
              <circle r={9} />
              <path d="M-4 0H4" />
            </g>
          )}
        </g>
        {p.hasChildren && p.collapsed && (
          <g
            data-action="toggle"
            transform={`translate(${p.selected ? 12 : 0} ${-(r + 17)})`}
            onClick={(e) => {
              e.stopPropagation();
              p.onToggle(p.id);
            }}
            className="career-btn career-pill"
          >
            <title>Dalı aç</title>
            <rect x={-15} y={-9} width={30} height={18} rx={9} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={10.5} fontWeight={700}>
              +{p.hiddenCount}
            </text>
          </g>
        )}
      </g>
    </g>
  );
});

// ----------------------------------------------------------------- canvas

interface Props {
  ref?: Ref<CanvasHandle>;
  layout: Layout;
  tree: TreeIndex;
  stats: Map<string, NodeStats>;
  selectedId: string | null;
  matchIds: Set<string> | null;
  celebrate: { ids: Set<string>; key: number } | null;
  focus: { id: string; nonce: number; center: boolean } | null;
  onSelect: (id: string | null) => void;
  onToggle: (id: string) => void;
  onAdd: (id: string) => void;
  onMove: (id: string, targetId: string) => void;
}

type Gesture =
  | { kind: "pan"; sx: number; sy: number; vx: number; vy: number; moved: boolean }
  | { kind: "node"; id: string; sx: number; sy: number; dragging: boolean };

export function TreeCanvas(props: Props) {
  const { ref, layout, tree, stats, selectedId, matchIds, celebrate } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef<SVGGElement>(null);
  const ghostRef = useRef<SVGGElement>(null);
  const zoomLabelRef = useRef<HTMLSpanElement>(null);

  const viewRef = useRef<PinchView>({ x: 0, y: 0, k: 1 });
  const sizeRef = useRef({ w: 0, h: 0 });
  const layoutRef = useRef(layout);
  const treeRef = useRef(tree);
  const propsRef = useRef(props);
  const fittedRef = useRef(false);
  const animRef = useRef(0);
  const gesture = useRef<Gesture | null>(null);
  const pinch = useRef(new PinchTracker(MIN_ZOOM, MAX_ZOOM));
  const excludedRef = useRef<Set<string>>(new Set());

  const [drag, setDrag] = useState<{ id: string; gx: number; gy: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const dropRef = useRef<string | null>(null);
  const pendingClick = useRef<string | null>(null);

  // Latest props for the stable callbacks below.
  useEffect(() => {
    layoutRef.current = layout;
    treeRef.current = tree;
    propsRef.current = props;
  });

  // ------------------------------------------------------------- view maths
  const applyView = useCallback(() => {
    const v = viewRef.current;
    viewportRef.current?.setAttribute(
      "transform",
      `translate(${v.x.toFixed(2)} ${v.y.toFixed(2)}) scale(${v.k.toFixed(4)})`,
    );
    if (zoomLabelRef.current) zoomLabelRef.current.textContent = `${Math.round(v.k * 100)}%`;
  }, []);

  const cancelAnim = useCallback(() => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    animRef.current = 0;
  }, []);

  const animateTo = useCallback(
    (target: PinchView, ms = 320) => {
      cancelAnim();
      const from = { ...viewRef.current };
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduce || ms <= 0) {
        viewRef.current = target;
        applyView();
        return;
      }
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / ms);
        const e = 1 - Math.pow(1 - t, 3);
        viewRef.current = {
          x: from.x + (target.x - from.x) * e,
          y: from.y + (target.y - from.y) * e,
          k: from.k + (target.k - from.k) * e,
        };
        applyView();
        animRef.current = t < 1 ? requestAnimationFrame(step) : 0;
      };
      animRef.current = requestAnimationFrame(step);
    },
    [applyView, cancelAnim],
  );

  const fit = useCallback(
    (animate = true, readable = false) => {
      const { w, h } = sizeRef.current;
      const b = layoutRef.current.bounds;
      if (!w || !h || layoutRef.current.nodes.length === 0) return;
      const pad = 36;
      const bw = Math.max(b.maxX - b.minX, 1);
      const bh = Math.max(b.maxY - b.minY, 1);
      const fitK = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh);
      // Opening on a phone: a legible zoom around the trunk beats a thumbnail
      // of the whole tree ("sığdır" still shows everything).
      if (readable && fitK < READABLE_ZOOM) {
        animateTo({ k: READABLE_ZOOM, x: w / 2, y: h / 2 }, 0);
        return;
      }
      const k = clamp(fitK, MIN_ZOOM, 1.3);
      animateTo(
        {
          k,
          x: w / 2 - (b.minX + bw / 2) * k,
          y: h / 2 - (b.minY + bh / 2) * k,
        },
        animate ? 380 : 0,
      );
    },
    [animateTo],
  );

  const zoomAt = useCallback(
    (cx: number, cy: number, factor: number) => {
      const v = viewRef.current;
      const k = clamp(v.k * factor, MIN_ZOOM, MAX_ZOOM);
      const r = k / v.k;
      viewRef.current = { k, x: cx - (cx - v.x) * r, y: cy - (cy - v.y) * r };
      applyView();
    },
    [applyView],
  );

  useImperativeHandle(
    ref,
    () => ({
      fit: () => fit(true),
      zoomBy: (factor: number) => {
        cancelAnim();
        const { w, h } = sizeRef.current;
        const v = viewRef.current;
        const k = clamp(v.k * factor, MIN_ZOOM, MAX_ZOOM);
        const r = k / v.k;
        animateTo({ k, x: w / 2 - (w / 2 - v.x) * r, y: h / 2 - (h / 2 - v.y) * r }, 200);
      },
    }),
    [fit, cancelAnim, animateTo],
  );

  // First fit as soon as there's both a size and a tree.
  const hasNodes = layout.nodes.length > 0;
  useEffect(() => {
    if (!fittedRef.current && hasNodes && sizeRef.current.w > 0) {
      fittedRef.current = true;
      fit(false, true);
    }
  }, [hasNodes, fit]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      sizeRef.current = { w: el.clientWidth, h: el.clientHeight };
      if (!fittedRef.current && layoutRef.current.nodes.length > 0 && el.clientWidth > 0) {
        fittedRef.current = true;
        fit(false, true);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  // Wheel / trackpad-pinch zoom around the cursor (needs a non-passive listener).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelAnim();
      const rect = svg.getBoundingClientRect();
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-dy * (e.ctrlKey ? 0.012 : 0.0016)));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [zoomAt, cancelAnim]);

  // Bring a node into view (new goal, search hit, …).
  const focus = props.focus;
  useEffect(() => {
    if (!focus) return;
    const n = layoutRef.current.byId.get(focus.id);
    // Live size: the detail panel may have just narrowed the canvas, and the
    // ResizeObserver hasn't reported that yet.
    const box = containerRef.current;
    if (box) sizeRef.current = { w: box.clientWidth, h: box.clientHeight };
    const { w, h } = sizeRef.current;
    if (!n || !w) return;
    const v = viewRef.current;
    const sx = n.x * v.k + v.x;
    const sy = n.y * v.k + v.y;
    const compact = window.innerWidth < 1024 && propsRef.current.selectedId !== null;
    if (focus.center) {
      animateTo(
        { k: v.k, x: w / 2 - n.x * v.k, y: (compact ? h * 0.2 : h / 2) - n.y * v.k },
        340,
      );
    } else {
      // Nudge the view just enough to bring the node (and its label) into the
      // clear area; leave it alone when it's already visible.
      const left = 70;
      const right = w - 190;
      const top = 70;
      const bottom = compact ? h * 0.36 : h - 70;
      const dx = sx < left ? left - sx : sx > right ? right - sx : 0;
      const dy = sy < top ? top - sy : sy > bottom ? bottom - sy : 0;
      if (dx || dy) animateTo({ k: v.k, x: v.x + dx, y: v.y + dy }, 300);
    }
    // Only a new request (nonce) should move the view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);

  useEffect(() => {
    applyView();
  }, [applyView]);

  // --------------------------------------------------------------- gestures
  const origin = () => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: r.left, y: r.top };
  };

  function onPointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if ((e.target as Element).closest("[data-action]")) return;
    cancelAnim();
    const o = origin();
    if (pinch.current.down(e, o, viewRef.current)) {
      gesture.current = null;
      endDrag();
      svgRef.current?.setPointerCapture(e.pointerId);
      return;
    }
    const nodeEl = (e.target as Element).closest("[data-node-id]");
    const id = nodeEl?.getAttribute("data-node-id") ?? null;
    svgRef.current?.setPointerCapture(e.pointerId);
    const isRoot = id !== null && id === treeRef.current.root?.id;
    if (id && !isRoot) {
      gesture.current = { kind: "node", id, sx: e.clientX, sy: e.clientY, dragging: false };
    } else {
      // The trunk and empty space both pan the canvas; a still click selects.
      gesture.current = {
        kind: "pan",
        sx: e.clientX,
        sy: e.clientY,
        vx: viewRef.current.x,
        vy: viewRef.current.y,
        moved: false,
      };
      if (id) pendingClick.current = id;
    }
  }
  function endDrag() {
    setDrag(null);
    dropRef.current = null;
    setDropTarget(null);
  }

  function onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    const o = origin();
    const pv = pinch.current.move(e, o);
    if (pv) {
      viewRef.current = pv;
      applyView();
      return;
    }
    if (pinch.current.active) return;
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pan") {
      const dx = e.clientX - g.sx;
      const dy = e.clientY - g.sy;
      if (!g.moved && Math.hypot(dx, dy) > 3) {
        g.moved = true;
        pendingClick.current = null;
      }
      if (g.moved) {
        viewRef.current = { ...viewRef.current, x: g.vx + dx, y: g.vy + dy };
        applyView();
      }
      return;
    }
    // Dragging a goal onto another node to re-parent it.
    const v = viewRef.current;
    const gx = (e.clientX - o.x - v.x) / v.k;
    const gy = (e.clientY - o.y - v.y) / v.k;
    if (!g.dragging) {
      if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < DRAG_THRESHOLD) return;
      g.dragging = true;
      excludedRef.current = new Set(subtreeIds(treeRef.current, g.id));
      setDrag({ id: g.id, gx, gy });
    }
    ghostRef.current?.setAttribute("transform", `translate(${gx.toFixed(1)} ${gy.toFixed(1)})`);
    let best: string | null = null;
    let bestD = Infinity;
    for (const n of layoutRef.current.nodes) {
      if (excludedRef.current.has(n.id)) continue;
      const d = Math.hypot(n.x - gx, n.y - gy);
      if (d < n.r + 18 && d < bestD) {
        best = n.id;
        bestD = d;
      }
    }
    if (best !== dropRef.current) {
      dropRef.current = best;
      setDropTarget(best);
    }
  }

  function onPointerUp(e: ReactPointerEvent<SVGSVGElement>) {
    pinch.current.up(e);
    const g = gesture.current;
    gesture.current = null;
    if (svgRef.current?.hasPointerCapture(e.pointerId)) {
      svgRef.current.releasePointerCapture(e.pointerId);
    }
    if (!g) return;
    if (g.kind === "node") {
      if (g.dragging) {
        const target = dropRef.current;
        endDrag();
        if (target) props.onMove(g.id, target);
      } else {
        props.onSelect(g.id);
      }
      return;
    }
    if (!g.moved) {
      const id = pendingClick.current;
      pendingClick.current = null;
      props.onSelect(id);
    }
  }

  function onPointerCancel(e: ReactPointerEvent<SVGSVGElement>) {
    pinch.current.up(e);
    gesture.current = null;
    pendingClick.current = null;
    endDrag();
  }

  // Stable per-node callbacks (read the newest handlers from the ref).
  const onToggle = useCallback((id: string) => propsRef.current.onToggle(id), []);
  const onAdd = useCallback((id: string) => propsRef.current.onAdd(id), []);
  const onActivate = useCallback((id: string) => propsRef.current.onSelect(id), []);

  // ----------------------------------------------------------------- render
  const lookup = layout.byId;
  const dragId = drag?.id ?? null;
  const dragged = dragId ? lookup.get(dragId) : null;
  const draggedNode = dragId ? tree.byId.get(dragId) : null;

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <svg
        ref={svgRef}
        role="group"
        aria-label="Kariyer ağacı"
        className="h-full w-full touch-none select-none"
        style={{ cursor: drag ? "grabbing" : "grab" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <g ref={viewportRef}>
          <g>
            {layout.nodes.map((n) => {
              if (!n.parentId) return null;
              const parent = lookup.get(n.parentId);
              if (!parent) return null;
              const st = stats.get(n.id);
              return (
                <BranchEdge
                  key={n.id}
                  d={branchPath(parent, n)}
                  width={branchWidth(n.depth)}
                  color={n.color}
                  progress={st?.progress ?? 0}
                  dashed={st?.locked ?? false}
                  glow={n.depth === 1 && (st?.status ?? "") === "done"}
                />
              );
            })}
          </g>
          <g>
            {layout.nodes.map((n) => (
              <NodeItem
                key={n.id}
                n={n}
                tree={tree}
                stats={stats}
                selectedId={selectedId}
                matchIds={matchIds}
                celebrate={celebrate}
                dragId={dragId}
                dropTarget={dropTarget}
                onToggle={onToggle}
                onAdd={onAdd}
                onActivate={onActivate}
              />
            ))}
          </g>
          {drag && dragged && draggedNode && (
            <g
              ref={ghostRef}
              transform={`translate(${drag.gx} ${drag.gy})`}
              pointerEvents="none"
              opacity={0.9}
            >
              <circle
                r={dragged.r}
                fill="var(--surface)"
                stroke={dragged.color}
                strokeWidth={3}
              />
              <text
                x={dragged.r + 8}
                y={4}
                fontSize={12}
                fontWeight={700}
                className="career-label"
              >
                {draggedNode.title}
              </text>
            </g>
          )}
        </g>
      </svg>

      <div className="no-print pointer-events-none absolute bottom-3 right-3 flex flex-col items-end gap-2">
        <span
          ref={zoomLabelRef}
          className="rounded-full bg-[var(--surface)]/85 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--muted)]"
        >
          100%
        </span>
      </div>
      {drag && (
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
          <span className="rounded-full bg-[var(--foreground)] px-3 py-1 text-xs font-semibold text-[var(--background)]">
            {dropTarget
              ? `“${tree.byId.get(dropTarget)?.title ?? ""}” altına taşı`
              : "Taşımak için bir dalın üzerine bırak"}
          </span>
        </div>
      )}
    </div>
  );
}

/** Derives the primitive props of one node (keeps NodeView memoisable). */
function NodeItem({
  n,
  tree,
  stats,
  selectedId,
  matchIds,
  celebrate,
  dragId,
  dropTarget,
  onToggle,
  onAdd,
  onActivate,
}: {
  n: LayoutNode;
  tree: TreeIndex;
  stats: Map<string, NodeStats>;
  selectedId: string | null;
  matchIds: Set<string> | null;
  celebrate: { ids: Set<string>; key: number } | null;
  dragId: string | null;
  dropTarget: string | null;
  onToggle: (id: string) => void;
  onAdd: (id: string) => void;
  onActivate: (id: string) => void;
}) {
  const node = tree.byId.get(n.id);
  const st = stats.get(n.id);
  if (!node || !st) return null;
  const hasChildren = (tree.children.get(n.id)?.length ?? 0) > 0;
  const state: NodeState =
    st.status === "done" ? "done" : st.locked ? "locked" : st.status === "in_progress" ? "progress" : "idle";
  const pct = Math.round(st.progress * 100);
  const sub =
    state === "locked"
      ? "Kilitli"
      : !st.isLeaf
        ? `%${pct} · ${st.leavesDone}/${st.leaves}`
        : STATUS_LABEL[st.status];
  return (
    <NodeView
      id={n.id}
      x={n.x}
      y={n.y}
      r={n.r}
      depth={n.depth}
      dir={n.dir}
      color={n.color}
      lines={n.lines}
      labelWidth={n.labelWidth}
      sub={sub}
      aria={`${node.title}, ${sub}`}
      progress={st.progress}
      state={state}
      selected={selectedId === n.id}
      match={matchIds ? (matchIds.has(n.id) ? "hit" : "miss") : null}
      dragging={dragId === n.id}
      target={dropTarget === n.id}
      collapsed={node.collapsed && hasChildren}
      hiddenCount={st.descendants}
      hasChildren={hasChildren}
      pulse={celebrate?.ids.has(n.id) ? celebrate.key : 0}
      onToggle={onToggle}
      onAdd={onAdd}
      onActivate={onActivate}
    />
  );
}
