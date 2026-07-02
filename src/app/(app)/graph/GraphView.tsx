"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export interface GraphNode {
  id: string;
  label: string;
  type: "note" | "tag" | "source";
}

export interface GraphEdge {
  source: string;
  target: string;
}

// Categorical identity colors (validated palette): note=blue, tag=aqua, source=yellow
const COLORS = {
  light: { note: "#2a78d6", tag: "#1baf7a", source: "#eda100", label: "#52514e", edge: "#e1e0d9", halo: "#fcfcfb" },
  dark: { note: "#3987e5", tag: "#199e70", source: "#c98500", label: "#c3c2b7", edge: "#2c2c2a", halo: "#1a1a19" },
};

const RADIUS = { note: 7, tag: 5, source: 6 };

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export function GraphView({ nodes, edges }: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || nodes.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = rect.width;
    const H = Math.max(480, Math.min(640, rect.width * 0.7));
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);

    const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const sim: SimNode[] = nodes.map((n, i) => ({
      ...n,
      x: W / 2 + Math.cos((i / nodes.length) * Math.PI * 2) * Math.min(W, H) * 0.3,
      y: H / 2 + Math.sin((i / nodes.length) * Math.PI * 2) * Math.min(W, H) * 0.3,
      vx: 0,
      vy: 0,
    }));
    const byId = new Map(sim.map((n) => [n.id, n]));
    const links = edges
      .map((e) => ({ a: byId.get(e.source), b: byId.get(e.target) }))
      .filter((l): l is { a: SimNode; b: SimNode } => Boolean(l.a && l.b));

    let hovered: SimNode | null = null;
    let dragged: SimNode | null = null;
    let didDrag = false;
    let alpha = 1;
    let raf = 0;

    function tick() {
      // pairwise repulsion
      for (let i = 0; i < sim.length; i++) {
        for (let j = i + 1; j < sim.length; j++) {
          const a = sim[i];
          const b = sim[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) {
            dx = Math.random() - 0.5;
            dy = Math.random() - 0.5;
            d2 = 1;
          }
          const f = Math.min(2200 / d2, 8);
          const d = Math.sqrt(d2);
          const fx = (dx / d) * f;
          const fy = (dy / d) * f;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }
      // springs
      for (const { a, b } of links) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = (d - 80) * 0.02;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
      // centering + integration
      for (const n of sim) {
        n.vx += (W / 2 - n.x) * 0.002;
        n.vy += (H / 2 - n.y) * 0.002;
        if (n !== dragged) {
          n.x += n.vx * alpha;
          n.y += n.vy * alpha;
        }
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x = Math.max(16, Math.min(W - 16, n.x));
        n.y = Math.max(16, Math.min(H - 16, n.y));
      }
      alpha = Math.max(0.03, alpha * 0.995);
    }

    function draw() {
      const c = darkQuery.matches ? COLORS.dark : COLORS.light;
      ctx.clearRect(0, 0, W, H);

      const neighborIds = new Set<string>();
      if (hovered) {
        for (const { a, b } of links) {
          if (a === hovered) neighborIds.add(b.id);
          if (b === hovered) neighborIds.add(a.id);
        }
      }

      ctx.lineWidth = 1;
      for (const { a, b } of links) {
        const active = hovered && (a === hovered || b === hovered);
        ctx.strokeStyle = active ? c[hovered!.type] : c.edge;
        ctx.globalAlpha = active ? 0.9 : 1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      const showAllLabels = sim.length <= 40;
      for (const n of sim) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, RADIUS[n.type], 0, Math.PI * 2);
        ctx.fillStyle = c[n.type];
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = c.halo;
        ctx.stroke();

        const labelled =
          showAllLabels || n === hovered || (hovered && neighborIds.has(n.id));
        if (labelled) {
          ctx.font =
            n === hovered
              ? "600 12px system-ui, sans-serif"
              : "11px system-ui, sans-serif";
          ctx.fillStyle = c.label;
          const text =
            n.label.length > 28 ? `${n.label.slice(0, 27)}…` : n.label;
          ctx.fillText(text, n.x + RADIUS[n.type] + 4, n.y + 4);
        }
      }
    }

    function loop() {
      tick();
      draw();
      raf = requestAnimationFrame(loop);
    }
    loop();

    function nodeAt(mx: number, my: number): SimNode | null {
      let best: SimNode | null = null;
      let bestD = 14 * 14; // generous hit target
      for (const n of sim) {
        const dx = n.x - mx;
        const dy = n.y - my;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = n;
        }
      }
      return best;
    }

    function pos(e: PointerEvent) {
      const r = canvas!.getBoundingClientRect();
      return { mx: e.clientX - r.left, my: e.clientY - r.top };
    }

    function onMove(e: PointerEvent) {
      const { mx, my } = pos(e);
      if (dragged) {
        dragged.x = mx;
        dragged.y = my;
        didDrag = true;
        alpha = Math.max(alpha, 0.3);
        return;
      }
      hovered = nodeAt(mx, my);
      canvas!.style.cursor = hovered ? "pointer" : "default";
    }
    function onDown(e: PointerEvent) {
      const { mx, my } = pos(e);
      dragged = nodeAt(mx, my);
      didDrag = false;
    }
    function onUp() {
      if (dragged && !didDrag) {
        if (dragged.type === "note") router.push(`/notes/${dragged.id}`);
        else if (dragged.type === "tag")
          router.push(`/notes?tag=${encodeURIComponent(dragged.label.replace(/^#/, ""))}`);
      }
      dragged = null;
    }

    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointerleave", () => {
      hovered = null;
      dragged = null;
    });

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
    };
  }, [nodes, edges, router]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full rounded-lg border border-stone-200 dark:border-stone-800 bg-[#fcfcfb] dark:bg-[#1a1a19]"
    />
  );
}
