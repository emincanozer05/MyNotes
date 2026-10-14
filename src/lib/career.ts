/**
 * Kariyer Yol Haritası — pure data model, progress maths and tree layout.
 * No React / Supabase in here, so the same helpers serve the server action
 * (sanitising), the client store and the canvas.
 */

export type CareerStatus = "not_started" | "in_progress" | "done";
export type CareerPriority = "low" | "medium" | "high";
export type CareerSide = "left" | "right";

export interface Subtask {
  id: string;
  text: string;
  done: boolean;
}
export interface Resource {
  id: string;
  title: string;
  url: string;
}

export interface CareerNode {
  id: string;
  parent_id: string | null;
  title: string;
  description: string;
  status: CareerStatus;
  priority: CareerPriority;
  start_date: string | null;
  due_date: string | null;
  notes: string;
  subtasks: Subtask[];
  resources: Resource[];
  prerequisites: string[];
  color: string | null;
  side: CareerSide | null;
  collapsed: boolean;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
}

export const STATUS_LABEL: Record<CareerStatus, string> = {
  not_started: "Başlanmadı",
  in_progress: "Devam ediyor",
  done: "Tamamlandı",
};
export const PRIORITY_LABEL: Record<CareerPriority, string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
};

/** Branch colours: readable on both the light and the dark surface. */
export const BRANCH_COLORS: { key: string; label: string; value: string }[] = [
  { key: "blue", label: "Mavi", value: "#337ea9" },
  { key: "amber", label: "Turuncu", value: "#d9730d" },
  { key: "teal", label: "Turkuaz", value: "#2a9d8f" },
  { key: "rose", label: "Kırmızı", value: "#de5451" },
  { key: "violet", label: "Mor", value: "#9065b0" },
  { key: "green", label: "Yeşil", value: "#4f9d5d" },
];
const COLOR_BY_KEY = new Map(BRANCH_COLORS.map((c) => [c.key, c.value]));
/** Colour of the trunk and of branches without an explicit choice. */
export const TRUNK_COLOR = "var(--foreground)";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

function safeUrl(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().slice(0, 2000);
  if (!t) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Coerces any row/JSON into a well-formed node (used on read and on write). */
export function normalizeNode(raw: Record<string, unknown>): CareerNode | null {
  if (!isUuid(raw.id)) return null;
  const title = str(raw.title, 200).trim();
  if (!title) return null;

  const status: CareerStatus =
    raw.status === "done" || raw.status === "in_progress" ? raw.status : "not_started";
  const priority: CareerPriority =
    raw.priority === "low" || raw.priority === "high" ? raw.priority : "medium";

  const subtasks: Subtask[] = (Array.isArray(raw.subtasks) ? raw.subtasks : [])
    .slice(0, 100)
    .flatMap((s) => {
      const o = s as Record<string, unknown> | null;
      const text = str(o?.text, 300).trim();
      return o && text
        ? [{ id: str(o.id, 64) || cryptoId(), text, done: o.done === true }]
        : [];
    });

  const resources: Resource[] = (Array.isArray(raw.resources) ? raw.resources : [])
    .slice(0, 50)
    .flatMap((r) => {
      const o = r as Record<string, unknown> | null;
      const url = safeUrl(o?.url);
      if (!o || !url) return [];
      return [
        {
          id: str(o.id, 64) || cryptoId(),
          title: str(o.title, 200).trim() || hostOf(url),
          url,
        },
      ];
    });

  const prerequisites = (Array.isArray(raw.prerequisites) ? raw.prerequisites : [])
    .filter(isUuid)
    .filter((p) => p !== raw.id)
    .slice(0, 50);

  const colorKey = typeof raw.color === "string" ? raw.color : null;
  const date = (v: unknown) => (typeof v === "string" && DATE_RE.test(v.slice(0, 10)) ? v.slice(0, 10) : null);

  return {
    id: raw.id,
    parent_id: isUuid(raw.parent_id) ? raw.parent_id : null,
    title,
    description: str(raw.description, 5000),
    status,
    priority,
    start_date: date(raw.start_date),
    due_date: date(raw.due_date),
    notes: str(raw.notes, 20000),
    subtasks,
    resources,
    prerequisites,
    color: colorKey && COLOR_BY_KEY.has(colorKey) ? colorKey : null,
    side: raw.side === "left" || raw.side === "right" ? raw.side : null,
    collapsed: raw.collapsed === true,
    sort_order: Number.isFinite(raw.sort_order) ? Math.trunc(raw.sort_order as number) : 0,
    completed_at: typeof raw.completed_at === "string" ? raw.completed_at : null,
    created_at: typeof raw.created_at === "string" ? raw.created_at : new Date().toISOString(),
  };
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function cryptoId(): string {
  return globalThis.crypto.randomUUID();
}

export function newNode(
  parent_id: string | null,
  title: string,
  sort_order: number,
  patch: Partial<CareerNode> = {},
): CareerNode {
  return {
    id: cryptoId(),
    parent_id,
    title,
    description: "",
    status: "not_started",
    priority: "medium",
    start_date: null,
    due_date: null,
    notes: "",
    subtasks: [],
    resources: [],
    prerequisites: [],
    color: null,
    side: null,
    collapsed: false,
    sort_order,
    completed_at: null,
    created_at: new Date().toISOString(),
    ...patch,
  };
}

// ------------------------------------------------------------------ tree

export interface TreeIndex {
  byId: Map<string, CareerNode>;
  /** Children per parent, in display order. */
  children: Map<string, CareerNode[]>;
  root: CareerNode | null;
}

export function indexTree(nodes: CareerNode[]): TreeIndex {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map<string, CareerNode[]>();
  let root: CareerNode | null = null;
  for (const n of nodes) {
    if (n.parent_id && byId.has(n.parent_id)) {
      const list = children.get(n.parent_id);
      if (list) list.push(n);
      else children.set(n.parent_id, [n]);
    } else if (!root) {
      root = n;
    }
  }
  for (const list of children.values()) {
    list.sort(
      (a, b) =>
        a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
    );
  }
  return { byId, children, root };
}

/** Ids of `id` and everything below it. */
export function subtreeIds(tree: TreeIndex, id: string): string[] {
  const out: string[] = [];
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    out.push(cur);
    for (const c of tree.children.get(cur) ?? []) stack.push(c.id);
  }
  return out;
}

/** Path root → … → id (inclusive). */
export function pathTo(tree: TreeIndex, id: string): CareerNode[] {
  const out: CareerNode[] = [];
  let cur = tree.byId.get(id);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    out.push(cur);
    cur = cur.parent_id ? tree.byId.get(cur.parent_id) : undefined;
  }
  return out.reverse();
}

// -------------------------------------------------------------- progress

export interface NodeStats {
  /** 0…1 */
  progress: number;
  status: CareerStatus;
  /** Leaf goals below (or the node itself when it is a leaf). */
  leaves: number;
  leavesDone: number;
  /** Own status can be edited (a leaf that isn't locked). */
  isLeaf: boolean;
  locked: boolean;
  /** Prerequisite nodes that still block this node. */
  blockedBy: string[];
  descendants: number;
}

function leafProgress(n: CareerNode): number {
  if (n.status === "done") return 1;
  if (n.subtasks.length > 0) {
    const done = n.subtasks.filter((s) => s.done).length;
    const frac = done / n.subtasks.length;
    // Finished checklist but not marked done: stays just below "done".
    return Math.min(frac, 0.99) || (n.status === "in_progress" ? 0.25 : 0);
  }
  return n.status === "in_progress" ? 0.5 : 0;
}

/**
 * Progress + status per node. Parents derive both from their leaf goals;
 * a node is locked while any prerequisite (or an ancestor's prerequisite)
 * isn't done — already-finished nodes are never shown as locked.
 */
export function computeStats(tree: TreeIndex): Map<string, NodeStats> {
  const stats = new Map<string, NodeStats>();

  const walk = (n: CareerNode): NodeStats => {
    const kids = tree.children.get(n.id) ?? [];
    let s: NodeStats;
    if (kids.length === 0) {
      const progress = leafProgress(n);
      s = {
        progress,
        status: n.status === "done" ? "done" : progress > 0 ? "in_progress" : "not_started",
        leaves: 1,
        leavesDone: n.status === "done" ? 1 : 0,
        isLeaf: true,
        locked: false,
        blockedBy: [],
        descendants: 0,
      };
    } else {
      let leaves = 0;
      let done = 0;
      let weighted = 0;
      let descendants = 0;
      for (const k of kids) {
        const ks = walk(k);
        leaves += ks.leaves;
        done += ks.leavesDone;
        weighted += ks.progress * ks.leaves;
        descendants += 1 + ks.descendants;
      }
      const progress = leaves ? weighted / leaves : 0;
      s = {
        progress,
        status: done === leaves ? "done" : progress > 0 ? "in_progress" : "not_started",
        leaves,
        leavesDone: done,
        isLeaf: false,
        locked: false,
        blockedBy: [],
        descendants,
      };
    }
    stats.set(n.id, s);
    return s;
  };
  if (tree.root) walk(tree.root);

  // Locking needs every node's status, so it's a second pass (top-down).
  const lock = (n: CareerNode, parentLocked: boolean) => {
    const s = stats.get(n.id)!;
    const blockedBy = n.prerequisites.filter((p) => {
      const ps = stats.get(p);
      return ps !== undefined && ps.status !== "done";
    });
    s.blockedBy = blockedBy;
    s.locked = s.status !== "done" && (parentLocked || blockedBy.length > 0);
    for (const k of tree.children.get(n.id) ?? []) lock(k, s.locked);
  };
  if (tree.root) lock(tree.root, false);
  return stats;
}

/** Whether `candidate` (transitively) requires `id` — used to refuse cycles. */
export function requiresNode(tree: TreeIndex, candidate: string, id: string): boolean {
  const seen = new Set<string>();
  const stack = [candidate];
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === id) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const p of tree.byId.get(cur)?.prerequisites ?? []) stack.push(p);
  }
  return false;
}

export function branchColorValue(key: string | null): string {
  return (key && COLOR_BY_KEY.get(key)) || "var(--muted)";
}

// ---------------------------------------------------------------- layout

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  r: number;
  depth: number;
  /** -1 grows to the left of the trunk, +1 to the right, 0 = trunk. */
  dir: -1 | 0 | 1;
  /** Branch colour (inherited from the main branch). */
  color: string;
  /** Display label, already truncated. */
  label: string;
  labelWidth: number;
  parentId: string | null;
}

export interface Layout {
  nodes: LayoutNode[];
  byId: Map<string, LayoutNode>;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

const RADIUS = [28, 18, 13, 9.5];
const ROW = 54;
const BRANCH_GAP = 26;
const COL_GAP = 64;
const ROOT_GAP = 110;
const CHAR_W = 6.7;
const MAX_LABEL = 26;

export function radiusAt(depth: number): number {
  return RADIUS[Math.min(depth, RADIUS.length - 1)];
}

function truncate(s: string, max = MAX_LABEL): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/**
 * Two-sided tidy tree around the trunk (root at 0,0): main branches go to the
 * left or right of the trunk, every deeper level is a column whose spacing
 * adapts to its longest label, so labels never collide with the next level.
 * Collapsed branches contribute no rows.
 */
export function layoutTree(tree: TreeIndex): Layout {
  const out: LayoutNode[] = [];
  const byId = new Map<string, LayoutNode>();
  const root = tree.root;
  if (!root) {
    return { nodes: out, byId, bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 } };
  }

  const rootLabel = truncate(root.title, 44);
  const rootNode: LayoutNode = {
    id: root.id,
    x: 0,
    y: 0,
    r: RADIUS[0],
    depth: 0,
    dir: 0,
    color: TRUNK_COLOR,
    label: rootLabel,
    labelWidth: rootLabel.length * CHAR_W * 1.15,
    parentId: null,
  };
  out.push(rootNode);
  byId.set(root.id, rootNode);

  const visibleKids = (n: CareerNode) =>
    n.collapsed ? [] : (tree.children.get(n.id) ?? []);

  // Main branches → sides (explicit choice, else alternate right / left).
  const mains = tree.children.get(root.id) ?? [];
  const sides: Record<"left" | "right", CareerNode[]> = { left: [], right: [] };
  mains.forEach((m, i) => {
    sides[m.side ?? (i % 2 === 0 ? "right" : "left")].push(m);
  });

  const rows = new Map<string, number>();
  const rowsOf = (n: CareerNode): number => {
    const kids = visibleKids(n);
    const v = kids.length ? kids.reduce((s, k) => s + rowsOf(k), 0) : 1;
    rows.set(n.id, v);
    return v;
  };

  for (const sideKey of ["right", "left"] as const) {
    const branches = sides[sideKey];
    if (branches.length === 0 || root.collapsed) continue;
    const dir: 1 | -1 = sideKey === "right" ? 1 : -1;

    // Column widths per depth for this side.
    const colW: number[] = [];
    const measure = (n: CareerNode, depth: number) => {
      const lw = truncate(n.title).length * CHAR_W + 14;
      colW[depth] = Math.max(colW[depth] ?? 0, radiusAt(depth) * 2 + lw);
      for (const k of visibleKids(n)) measure(k, depth + 1);
    };
    branches.forEach((b) => measure(b, 1));
    const colX: number[] = [0, ROOT_GAP + RADIUS[0]];
    for (let d = 2; d < colW.length; d++) {
      colX[d] = colX[d - 1] + (colW[d - 1] ?? 0) + COL_GAP;
    }

    const totalRows = branches.reduce((s, b) => s + rowsOf(b), 0);
    const totalH = totalRows * ROW + (branches.length - 1) * BRANCH_GAP;
    let cursor = -totalH / 2;

    const place = (n: CareerNode, depth: number, top: number, color: string): number => {
      const kids = visibleKids(n);
      const span = (rows.get(n.id) ?? 1) * ROW;
      let y: number;
      if (kids.length === 0) {
        y = top + span / 2;
      } else {
        let t = top;
        const ys: number[] = [];
        for (const k of kids) {
          ys.push(place(k, depth + 1, t, color));
          t += (rows.get(k.id) ?? 1) * ROW;
        }
        y = (ys[0] + ys[ys.length - 1]) / 2;
      }
      const label = truncate(n.title);
      const ln: LayoutNode = {
        id: n.id,
        x: dir * colX[depth],
        y,
        r: radiusAt(depth),
        depth,
        dir,
        color,
        label,
        labelWidth: label.length * CHAR_W,
        parentId: n.parent_id,
      };
      out.push(ln);
      byId.set(n.id, ln);
      return y;
    };

    for (const b of branches) {
      const color = branchColorValue(b.color);
      place(b, 1, cursor, color);
      cursor += (rows.get(b.id) ?? 1) * ROW + BRANCH_GAP;
    }
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of out) {
    const lw = n.depth === 0 ? n.labelWidth / 2 : n.labelWidth + 12;
    const left = n.depth === 0 ? n.x - Math.max(n.r, lw) : n.dir < 0 ? n.x - n.r - lw : n.x - n.r;
    const right = n.depth === 0 ? n.x + Math.max(n.r, lw) : n.dir > 0 ? n.x + n.r + lw : n.x + n.r;
    minX = Math.min(minX, left);
    maxX = Math.max(maxX, right);
    minY = Math.min(minY, n.y - n.r - 6);
    maxY = Math.max(maxY, n.y + n.r + (n.depth === 0 ? 34 : 6));
  }
  return { nodes: out, byId, bounds: { minX, minY, maxX, maxY } };
}

/** Connector between a parent and a child: a soft S-curve, trunk fans out. */
export function branchPath(p: LayoutNode, c: LayoutNode): string {
  const dx = c.x - p.x;
  const mx = p.x + dx * 0.55;
  return `M${p.x.toFixed(1)} ${p.y.toFixed(1)}C${mx.toFixed(1)} ${p.y.toFixed(1)} ${(
    p.x + dx * 0.45
  ).toFixed(1)} ${c.y.toFixed(1)} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`;
}

/** Stroke width by depth: thick trunk-side limbs, thin twigs. */
export function branchWidth(depth: number): number {
  return [0, 7, 4.5, 3, 2][Math.min(depth, 4)];
}

// ------------------------------------------------------------ sample tree

type SeedGoal = string | { t: string; needs?: string };
interface SeedSub {
  t: string;
  goals?: SeedGoal[];
  needs?: string;
}
interface SeedBranch {
  t: string;
  color: string;
  subs: SeedSub[];
}

const SEED: SeedBranch[] = [
  {
    t: "Akademik Gelişim",
    color: "blue",
    subs: [
      {
        t: "Yüksek Lisans",
        goals: ["Program araştırması ve başvuru", "Tez konusunun belirlenmesi", "Tez savunması"],
      },
      {
        t: "Doktora",
        needs: "Yüksek Lisans",
        goals: ["Araştırma önerisi", "Yeterlik sınavı"],
      },
      {
        t: "Bilimsel Yayınlar",
        goals: ["İlk derleme makalesi", "Hakemli dergide özgün makale", "Uluslararası kongre sunumu"],
      },
    ],
  },
  {
    t: "Mesleki Gelişim",
    color: "amber",
    subs: [
      { t: "Sertifikalar", goals: ["CSCS (NSCA)", "UKSCA veya ASCA akreditasyonu"] },
      { t: "Uzmanlık Eğitimleri", goals: ["Hız ve çeviklik eğitimi", "Kuvvet-güç antrenmanı uzmanlığı"] },
      { t: "Uygulamalı Deneyimler", goals: ["Deneyimli bir antrenörle gölge çalışma", "Test bataryası uygulamaları"] },
    ],
  },
  {
    t: "Dil ve İletişim",
    color: "teal",
    subs: [
      { t: "İngilizce", goals: ["Hedef sınav puanı", "Akademik yazım"] },
      { t: "Sunum ve İletişim", goals: ["Konferans konuşması", "Sporcu ve teknik ekiple iletişim"] },
    ],
  },
  {
    t: "Profesyonel Deneyim",
    color: "rose",
    subs: [
      { t: "Staj ve Asistanlık", goals: ["Bir takım yanında staj"] },
      { t: "İlk Tam Zamanlı Pozisyon" },
      { t: "Uluslararası Pozisyon", needs: "İlk Tam Zamanlı Pozisyon" },
    ],
  },
  {
    t: "Kişisel Gelişim",
    color: "violet",
    subs: [
      { t: "Network ve Mentorluk", goals: ["Mentor bulmak"] },
      { t: "Sağlık ve Rutin" },
    ],
  },
];

/** Example tree matching the brief (trunk + 5 branches), freely editable. */
export function sampleTree(trunkTitle: string): CareerNode[] {
  const nodes: CareerNode[] = [];
  const root = newNode(null, trunkTitle, 0);
  nodes.push(root);
  const idByTitle = new Map<string, string>();
  const needs: { node: CareerNode; title: string }[] = [];

  SEED.forEach((b, bi) => {
    const branch = newNode(root.id, b.t, bi, { color: b.color });
    nodes.push(branch);
    b.subs.forEach((s, si) => {
      const sub = newNode(branch.id, s.t, si);
      nodes.push(sub);
      idByTitle.set(s.t, sub.id);
      if (s.needs) needs.push({ node: sub, title: s.needs });
      (s.goals ?? []).forEach((g, gi) => {
        const goal = newNode(sub.id, typeof g === "string" ? g : g.t, gi);
        nodes.push(goal);
      });
    });
  });
  for (const { node, title } of needs) {
    const id = idByTitle.get(title);
    if (id) node.prerequisites = [id];
  }
  return nodes;
}

// ------------------------------------------------------------- formatting

export function dueState(n: CareerNode, done: boolean): "overdue" | "soon" | null {
  if (!n.due_date || done) return null;
  const due = new Date(`${n.due_date}T23:59:59`).getTime();
  const now = Date.now();
  if (due < now) return "overdue";
  return due - now < 14 * 86_400_000 ? "soon" : null;
}

export function formatDate(d: string | null): string {
  if (!d) return "";
  const dt = new Date(`${d.slice(0, 10)}T00:00:00`);
  return Number.isNaN(dt.getTime())
    ? d
    : dt.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}
