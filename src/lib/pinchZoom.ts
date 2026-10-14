/**
 * Two-finger pinch zoom (+ two-finger pan) for pointer-event driven maps.
 * The map keeps its own one-pointer gestures (drag a node, pan the canvas) and
 * asks this tracker about every pointer: once a second finger lands, the
 * tracker takes over, and `move` returns the view that keeps the content under
 * the fingers' midpoint glued to it while the spread scales the zoom.
 */
export interface PinchView {
  x: number;
  y: number;
  k: number;
}

interface Pt {
  x: number;
  y: number;
}

interface PinchBase {
  dist: number;
  cx: number;
  cy: number;
  view: PinchView;
}

export class PinchTracker {
  private pointers = new Map<number, Pt>();
  private base: PinchBase | null = null;

  constructor(
    private readonly minK: number,
    private readonly maxK: number,
  ) {}

  /** True while two fingers are down. */
  get active(): boolean {
    return this.base !== null;
  }

  /**
   * Registers a pointer going down. Returns true when this is the second
   * finger, i.e. a pinch just started (cancel any one-finger gesture).
   * `origin` is the canvas' top-left in client coordinates.
   */
  down(e: PointerEvent | React.PointerEvent, origin: Pt, view: PinchView): boolean {
    if (e.pointerType === "mouse") return false;
    this.pointers.set(e.pointerId, { x: e.clientX - origin.x, y: e.clientY - origin.y });
    if (this.pointers.size !== 2) return this.active;
    const [a, b] = [...this.pointers.values()];
    this.base = {
      dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
      view: { ...view },
    };
    return true;
  }

  /** New view while pinching, or null when the event isn't part of a pinch. */
  move(e: PointerEvent | React.PointerEvent, origin: Pt): PinchView | null {
    const p = this.pointers.get(e.pointerId);
    if (!p) return null;
    p.x = e.clientX - origin.x;
    p.y = e.clientY - origin.y;
    if (!this.base || this.pointers.size < 2) return null;
    const [a, b] = [...this.pointers.values()];
    const { dist, cx, cy, view } = this.base;
    const k = Math.min(
      this.maxK,
      Math.max(this.minK, view.k * (Math.hypot(a.x - b.x, a.y - b.y) / dist)),
    );
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    // Keep the graph point that was under the start midpoint under the current one.
    return {
      k,
      x: mx - (cx - view.x) * (k / view.k),
      y: my - (cy - view.y) * (k / view.k),
    };
  }

  /** Pointer released/cancelled. A pinch ends as soon as one finger lifts. */
  up(e: PointerEvent | React.PointerEvent) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.base = null;
  }
}
