"use client";

import { Icon } from "@/components/Icon";
import { PinchTracker } from "@/lib/pinchZoom";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { initials, type Contact } from "@/lib/network";

interface SimNode extends SimulationNodeDatum {
  id: string;
  r: number;
  phase: number;
}
type SimLink = SimulationLinkDatum<SimNode> & { key: string };
interface View {
  x: number;
  y: number;
  k: number;
}

const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
/** Resting simulation energy: keeps the gentle drift alive without jitter. */
const IDLE_ALPHA = 0.012;

/** Ring colour by relationship level (matches the legend). */
export const LEVEL_COLORS: Record<string, string> = {
  Yakın: "var(--brand-1)",
  "Düzenli iletişim": "var(--brand-4)",
  Tanışıklık: "var(--muted)",
};

function levelColor(level: string): string {
  return LEVEL_COLORS[level] ?? "var(--border-strong)";
}

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Slow sinusoidal nudge per node — the "floating" motion. It ignores the
 * simulation's alpha, so nodes keep drifting softly after the layout settles,
 * while collision/link forces keep them from overlapping.
 */
function driftForce(enabled: () => boolean) {
  let nodes: SimNode[] = [];
  const force = () => {
    if (!enabled()) return;
    const t = performance.now() / 1000;
    for (const n of nodes) {
      n.vx = (n.vx ?? 0) + Math.cos(t * 0.35 + n.phase) * 0.02;
      n.vy = (n.vy ?? 0) + Math.sin(t * 0.29 + n.phase * 1.7) * 0.02;
    }
  };
  force.initialize = (ns: SimNode[]) => {
    nodes = ns;
  };
  return force;
}

/**
 * Force-directed network graph: circular photo nodes, thin edges between
 * people who know each other, drag / pan / wheel-zoom, hover highlighting.
 * Positions are written straight to the DOM on every tick (no React render
 * per frame); React only re-renders when data, hover or selection change.
 */
export function NetworkGraph({
  contacts,
  edges,
  selectedId,
  onSelect,
  focus,
}: {
  contacts: Contact[];
  edges: { source: string; target: string }[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** Center the view on a node; `nonce` re-triggers for the same id. */
  focus: { id: string; nonce: number } | null;
}) {
  const uid = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef<SVGGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const nodesRef = useRef(new Map<string, SimNode>());
  const linksRef = useRef<SimLink[]>([]);
  const nodeEls = useRef(new Map<string, SVGGElement>());
  const linkEls = useRef(new Map<string, SVGLineElement>());
  const viewRef = useRef<View>({ x: 0, y: 0, k: 1 });
  const sizeRef = useRef<{ w: number; h: number } | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const driftRef = useRef(true);
  /** Two-finger pinch zoom / pan (touch + pen). */
  const pinch = useRef(new PinchTracker(MIN_ZOOM, MAX_ZOOM));
  /** Focus request for a node that isn't on the map yet (just saved). */
  const pendingFocus = useRef<string | null>(null);

  const [hovered, setHovered] = useState<string | null>(null);
  const [zoomedOut, setZoomedOut] = useState(false);

  const neighbors = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const e of edges) {
      if (!m.has(e.source)) m.set(e.source, new Set());
      if (!m.has(e.target)) m.set(e.target, new Set());
      m.get(e.source)!.add(e.target);
      m.get(e.target)!.add(e.source);
    }
    return m;
  }, [edges]);

  const radiusOf = (id: string) => 22 + Math.min(neighbors.get(id)?.size ?? 0, 6) * 2;

  // ---------------------------------------------------------------- drawing
  function draw() {
    for (const [id, el] of nodeEls.current) {
      const n = nodesRef.current.get(id);
      if (n) el.setAttribute("transform", `translate(${n.x ?? 0},${n.y ?? 0})`);
    }
    for (const l of linksRef.current) {
      const el = linkEls.current.get(l.key);
      const s = l.source as SimNode;
      const t = l.target as SimNode;
      if (!el || typeof s !== "object" || typeof t !== "object") continue;
      el.setAttribute("x1", String(s.x ?? 0));
      el.setAttribute("y1", String(s.y ?? 0));
      el.setAttribute("x2", String(t.x ?? 0));
      el.setAttribute("y2", String(t.y ?? 0));
    }
    placeTooltip();
  }

  function placeTooltip() {
    const tip = tooltipRef.current;
    const id = hoveredRef.current;
    if (!tip) return;
    const n = id ? nodesRef.current.get(id) : null;
    if (!n) return;
    const v = viewRef.current;
    const x = v.x + (n.x ?? 0) * v.k;
    const y = v.y + ((n.y ?? 0) - n.r - 6) * v.k;
    tip.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  }

  function applyView() {
    const v = viewRef.current;
    viewportRef.current?.setAttribute(
      "transform",
      `translate(${v.x},${v.y}) scale(${v.k})`,
    );
    setZoomedOut(v.k < 0.6);
    placeTooltip();
  }

  function zoomAt(factor: number, px: number, py: number) {
    const v = viewRef.current;
    const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.k * factor));
    viewRef.current = {
      k,
      x: px - (px - v.x) * (k / v.k),
      y: py - (py - v.y) * (k / v.k),
    };
    applyView();
  }

  /** Smoothly moves the view to `target` (eased, ~350ms). */
  function animateView(target: View) {
    const from = { ...viewRef.current };
    let start: number | null = null;
    const step = (now: number) => {
      start ??= now;
      const p = Math.min(1, (now - start) / 350);
      const e = 1 - Math.pow(1 - p, 3);
      viewRef.current = {
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
        k: from.k + (target.k - from.k) * e,
      };
      applyView();
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function centerOn(id: string) {
    const n = nodesRef.current.get(id);
    const size = sizeRef.current;
    if (!n || !size) return;
    const k = Math.max(viewRef.current.k, 1);
    animateView({ k, x: size.w / 2 - (n.x ?? 0) * k, y: size.h / 2 - (n.y ?? 0) * k });
  }

  /** Zoom around the canvas center (toolbar buttons). */
  function zoomCenter(factor: number) {
    const size = sizeRef.current;
    if (size) zoomAt(factor, size.w / 2, size.h / 2);
  }

  function fitView() {
    const size = sizeRef.current;
    const nodes = [...nodesRef.current.values()];
    if (!size || nodes.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, (n.x ?? 0) - n.r);
      maxX = Math.max(maxX, (n.x ?? 0) + n.r);
      minY = Math.min(minY, (n.y ?? 0) - n.r);
      maxY = Math.max(maxY, (n.y ?? 0) + n.r + 18);
    }
    const pad = 48;
    const k = Math.min(
      1.4,
      Math.max(
        MIN_ZOOM,
        Math.min(
          (size.w - pad * 2) / Math.max(1, maxX - minX),
          (size.h - pad * 2) / Math.max(1, maxY - minY),
        ),
      ),
    );
    animateView({
      k,
      x: size.w / 2 - ((minX + maxX) / 2) * k,
      y: size.h / 2 - ((minY + maxY) / 2) * k,
    });
  }

  // ------------------------------------------------------- simulation setup
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    driftRef.current = !reduced.matches;

    const sim = forceSimulation<SimNode, SimLink>([])
      .velocityDecay(0.35)
      .force("charge", forceManyBody<SimNode>().strength(-260).distanceMax(500))
      .force(
        "link",
        forceLink<SimNode, SimLink>([])
          .id((d) => d.id)
          .distance((l) => 70 + (l.source as SimNode).r + (l.target as SimNode).r)
          .strength(0.35),
      )
      .force("collide", forceCollide<SimNode>().radius((d) => d.r + 16).strength(0.9))
      .force("x", forceX<SimNode>(0).strength(0.045))
      .force("y", forceY<SimNode>(0).strength(0.045))
      .force("drift", driftForce(() => driftRef.current))
      .alphaTarget(driftRef.current ? IDLE_ALPHA : 0)
      .on("tick", draw);
    simRef.current = sim;
    return () => {
      sim.stop();
      simRef.current = null;
    };
    // draw() only touches refs, so binding it once is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Feed new/changed contacts into the running simulation, keeping the
  // positions of people already on the map (new ones appear next to a
  // connection, or near the center).
  useEffect(() => {
    const sim = simRef.current;
    if (!sim) return;
    const prev = nodesRef.current;
    const next = new Map<string, SimNode>();
    const isFirst = prev.size === 0;

    contacts.forEach((c, i) => {
      const r = radiusOf(c.id);
      const existing = prev.get(c.id);
      if (existing) {
        existing.r = r;
        next.set(c.id, existing);
        return;
      }
      const anchorId = [...(neighbors.get(c.id) ?? [])].find((id) => prev.has(id));
      const anchor = anchorId ? prev.get(anchorId) : null;
      const angle = (hash(c.id) % 360) * (Math.PI / 180);
      const dist = anchor ? 90 : isFirst ? 40 + 26 * Math.sqrt(i) : 60;
      next.set(c.id, {
        id: c.id,
        r,
        phase: (hash(c.id) % 628) / 100,
        x: (anchor?.x ?? 0) + Math.cos(angle) * dist,
        y: (anchor?.y ?? 0) + Math.sin(angle) * dist,
      });
    });
    nodesRef.current = next;

    const links: SimLink[] = edges
      .filter((e) => next.has(e.source) && next.has(e.target))
      .map((e) => ({ source: e.source, target: e.target, key: edgeKey(e.source, e.target) }));
    linksRef.current = links;

    sim.nodes([...next.values()]);
    (sim.force("link") as ReturnType<typeof forceLink<SimNode, SimLink>>).links(links);
    sim.alpha(isFirst ? 1 : 0.4).restart();
    draw();
    const waiting = pendingFocus.current;
    if (waiting && next.has(waiting)) {
      pendingFocus.current = null;
      const t = setTimeout(() => centerOn(waiting), 400);
      return () => clearTimeout(t);
    }
    if (isFirst && next.size > 0) {
      // Let the first layout settle a moment, then frame everything.
      const t = setTimeout(fitView, 700);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contacts, edges]);

  // ------------------------------------------------------- size / wheel zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry.contentRect;
      const prev = sizeRef.current;
      if (!prev) {
        viewRef.current = { x: w / 2, y: h / 2, k: 1 };
      } else {
        // Keep the same graph point centered when the panel opens/closes.
        viewRef.current = {
          ...viewRef.current,
          x: viewRef.current.x + (w - prev.w) / 2,
          y: viewRef.current.y + (h - prev.h) / 2,
        };
      }
      sizeRef.current = { w, h };
      applyView();
    });
    ro.observe(el);

    const svg = svgRef.current;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = svg!.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
    };
    svg?.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      ro.disconnect();
      svg?.removeEventListener("wheel", onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Center on a node requested by the parent (search, mutual-contact click).
  useEffect(() => {
    if (!focus) return;
    if (nodesRef.current.has(focus.id)) centerOn(focus.id);
    else pendingFocus.current = focus.id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  // ------------------------------------------------------ pointer handling
  const gesture = useRef<
    | { type: "drag"; id: string; sx: number; sy: number; moved: boolean }
    | { type: "pan"; sx: number; sy: number; vx: number; vy: number; moved: boolean }
    | null
  >(null);

  function canvasOrigin() {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: rect.left, y: rect.top };
  }

  /** Drops the current one-finger gesture (a node drag releases its node). */
  function cancelGesture() {
    const g = gesture.current;
    gesture.current = null;
    if (g?.type === "drag") {
      const n = nodesRef.current.get(g.id);
      if (n) {
        n.fx = null;
        n.fy = null;
      }
      simRef.current?.alphaTarget(driftRef.current ? IDLE_ALPHA : 0);
    }
  }

  /** Registers the pointer; true when a second finger started a pinch. */
  function beginPinch(e: React.PointerEvent): boolean {
    if (!pinch.current.down(e, canvasOrigin(), viewRef.current)) return false;
    svgRef.current?.setPointerCapture(e.pointerId);
    cancelGesture();
    return true;
  }

  function toGraph(clientX: number, clientY: number) {
    const rect = svgRef.current!.getBoundingClientRect();
    const v = viewRef.current;
    return {
      x: (clientX - rect.left - v.x) / v.k,
      y: (clientY - rect.top - v.y) / v.k,
    };
  }

  function onNodePointerDown(e: React.PointerEvent, id: string) {
    if (e.button !== 0) return;
    e.stopPropagation();
    if (beginPinch(e)) return;
    svgRef.current?.setPointerCapture(e.pointerId);
    const n = nodesRef.current.get(id);
    if (!n) return;
    n.fx = n.x;
    n.fy = n.y;
    gesture.current = { type: "drag", id, sx: e.clientX, sy: e.clientY, moved: false };
    simRef.current?.alphaTarget(0.25).restart();
  }

  function onSvgPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    if (beginPinch(e)) return;
    svgRef.current?.setPointerCapture(e.pointerId);
    const v = viewRef.current;
    gesture.current = { type: "pan", sx: e.clientX, sy: e.clientY, vx: v.x, vy: v.y, moved: false };
  }

  function onPointerMove(e: React.PointerEvent) {
    const pinched = pinch.current.move(e, canvasOrigin());
    if (pinch.current.active) {
      if (pinched) {
        viewRef.current = pinched;
        applyView();
      }
      return;
    }
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.sx;
    const dy = e.clientY - g.sy;
    if (Math.hypot(dx, dy) > 4) g.moved = true;
    if (g.type === "drag") {
      const n = nodesRef.current.get(g.id);
      if (!n) return;
      const p = toGraph(e.clientX, e.clientY);
      n.fx = p.x;
      n.fy = p.y;
    } else if (g.moved) {
      viewRef.current = { ...viewRef.current, x: g.vx + dx, y: g.vy + dy };
      applyView();
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    pinch.current.up(e);
    const g = gesture.current;
    gesture.current = null;
    if (svgRef.current?.hasPointerCapture(e.pointerId)) {
      svgRef.current.releasePointerCapture(e.pointerId);
    }
    if (!g) return;
    if (g.type === "drag") {
      const n = nodesRef.current.get(g.id);
      if (n) {
        n.fx = null;
        n.fy = null;
      }
      simRef.current?.alphaTarget(driftRef.current ? IDLE_ALPHA : 0);
      if (!g.moved) onSelect(g.id);
    } else if (!g.moved) {
      onSelect(null);
    }
  }

  function hover(id: string | null) {
    hoveredRef.current = id;
    setHovered(id);
    // Position before paint so the tooltip never flashes at the origin.
    requestAnimationFrame(placeTooltip);
  }

  // Highlight the hovered node (or the selected one) and its connections.
  const activeId = hovered ?? selectedId;
  const activeSet = activeId
    ? new Set([activeId, ...(neighbors.get(activeId) ?? [])])
    : null;
  const hoveredContact = hovered ? contacts.find((c) => c.id === hovered) : null;

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      <svg
        ref={svgRef}
        className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={onSvgPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="img"
        aria-label="Network grafiği"
      >
        <g ref={viewportRef}>
          <g>
            {edges.map((e) => {
              const key = edgeKey(e.source, e.target);
              const on = activeId != null && (e.source === activeId || e.target === activeId);
              return (
                <line
                  key={key}
                  ref={(el) => {
                    if (el) linkEls.current.set(key, el);
                    else linkEls.current.delete(key);
                  }}
                  stroke={on ? "var(--brand-1)" : "var(--border-strong)"}
                  strokeWidth={on ? 2 : 1.2}
                  strokeOpacity={activeSet && !on ? 0.25 : 0.9}
                  style={{ transition: "stroke-opacity 150ms, stroke 150ms" }}
                />
              );
            })}
          </g>
          <g>
            {contacts.map((c) => {
              const r = radiusOf(c.id);
              const photo = c.profile.personal.profile_photo;
              const selected = c.id === selectedId;
              const dimmed = activeSet ? !activeSet.has(c.id) : false;
              const clipId = `${uid}-clip-${c.id}`;
              return (
                <g
                  key={c.id}
                  ref={(el) => {
                    if (el) nodeEls.current.set(c.id, el);
                    else nodeEls.current.delete(c.id);
                  }}
                  onPointerDown={(e) => onNodePointerDown(e, c.id)}
                  // Touch has no hover; a tap selects (and opens the panel).
                  onPointerEnter={(e) => e.pointerType === "mouse" && hover(c.id)}
                  onPointerLeave={(e) => e.pointerType === "mouse" && hover(null)}
                  style={{
                    cursor: "pointer",
                    opacity: dimmed ? 0.28 : 1,
                    transition: "opacity 150ms",
                  }}
                >
                  {selected && (
                    <circle r={r + 7} fill="none" stroke="var(--brand-1)" strokeOpacity={0.3} strokeWidth={3} />
                  )}
                  <circle
                    r={r + 3}
                    fill="var(--surface)"
                    stroke={levelColor(c.profile.relationship.relationship_level)}
                    strokeWidth={selected ? 3 : 2}
                  />
                  <clipPath id={clipId}>
                    <circle r={r} />
                  </clipPath>
                  {photo ? (
                    <image
                      href={photo}
                      x={-r}
                      y={-r}
                      width={r * 2}
                      height={r * 2}
                      clipPath={`url(#${clipId})`}
                      preserveAspectRatio="xMidYMid slice"
                    />
                  ) : (
                    <>
                      <circle r={r} fill={`hsl(${hash(c.full_name) % 360} 22% 46%)`} />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#fff"
                        fontSize={r * 0.62}
                        fontWeight={700}
                        style={{ pointerEvents: "none" }}
                      >
                        {initials(c.full_name)}
                      </text>
                    </>
                  )}
                  <text
                    y={r + 17}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={selected ? 700 : 500}
                    fill="var(--foreground)"
                    stroke="var(--surface)"
                    strokeWidth={4}
                    paintOrder="stroke"
                    style={{
                      pointerEvents: "none",
                      opacity: zoomedOut && !selected ? 0 : 1,
                      transition: "opacity 150ms",
                    }}
                  >
                    {c.full_name}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* Hover card: name + occupation */}
      <div
        ref={tooltipRef}
        className={`pointer-events-none absolute left-0 top-0 z-10 max-w-[16rem] rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 shadow-[var(--shadow-2)] transition-opacity duration-150 ${
          hoveredContact ? "opacity-100" : "opacity-0"
        }`}
      >
        {hoveredContact && (
          <>
            <p className="text-sm font-bold leading-tight">{hoveredContact.full_name}</p>
            {(hoveredContact.profile.personal.occupation ||
              hoveredContact.profile.personal.job_title) && (
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {hoveredContact.profile.personal.occupation ||
                  hoveredContact.profile.personal.job_title}
              </p>
            )}
          </>
        )}
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 flex flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm shadow-[var(--shadow-1)]">
          <button
            type="button"
            title="Yakınlaştır"
            aria-label="Yakınlaştır"
            onClick={() => zoomCenter(1.25)}
            className="flex h-8 w-8 items-center justify-center border-b border-[var(--border)] text-[var(--muted)] transition-colors last:border-b-0 hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            <Icon name="plus" className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Uzaklaştır"
            aria-label="Uzaklaştır"
            onClick={() => zoomCenter(0.8)}
            className="flex h-8 w-8 items-center justify-center border-b border-[var(--border)] text-[var(--muted)] transition-colors last:border-b-0 hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            <Icon name="minus" className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Tümünü sığdır"
            aria-label="Tümünü sığdır"
            onClick={() => fitView()}
            className="flex h-8 w-8 items-center justify-center border-b border-[var(--border)] text-[var(--muted)] transition-colors last:border-b-0 hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
          >
            <Icon name="maximize" className="h-3.5 w-3.5" />
          </button>
      </div>

      {/* Legend: ring colour = relationship level */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-x-3 gap-y-1 rounded-lg bg-[color-mix(in_srgb,var(--surface)_85%,transparent)] px-2.5 py-1.5 text-[11px] text-[var(--muted)]">
        {Object.entries(LEVEL_COLORS).map(([label, color]) => (
          <span key={label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: color }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
