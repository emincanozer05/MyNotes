"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/Icon";
import {
  BRANCH_COLORS,
  PRIORITY_LABEL,
  STATUS_LABEL,
  cryptoId,
  dueState,
  formatDate,
  hostOf,
  pathTo,
  requiresNode,
  subtreeIds,
  type CareerNode,
  type CareerPriority,
  type CareerStatus,
  type NodeStats,
  type TreeIndex,
} from "@/lib/career";

export type NodePatch = Partial<CareerNode> | ((n: CareerNode) => Partial<CareerNode>);

interface Props {
  node: CareerNode;
  tree: TreeIndex;
  stats: Map<string, NodeStats>;
  /** True right after this goal was created: focus + select its name. */
  titleFocus: boolean;
  onUpdate: (id: string, patch: NodePatch) => void;
  onAddChild: (parentId: string, title: string) => void;
  onMove: (id: string, parentId: string) => void;
  onReorder: (id: string, delta: -1 | 1) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  onClose: () => void;
}

const labelCls = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]";
const fieldCls =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm outline-none transition-colors focus:border-[var(--brand-1)]";

function Section({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  return (
    <section className="space-y-1.5 border-t border-[var(--border)] px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
          {title}
        </h3>
        {hint && <span className="text-[11px] text-[var(--muted)]">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/**
 * Text input / textarea that keeps its own draft (so typing never re-renders
 * the whole tree) and commits to the store shortly after typing stops, and
 * immediately on blur.
 */
function DraftField({
  value,
  onCommit,
  multiline = false,
  className = fieldCls,
  placeholder,
  rows = 3,
  required = false,
  autoFocus = false,
  maxLength,
  ariaLabel,
}: {
  value: string;
  onCommit: (v: string) => void;
  multiline?: boolean;
  className?: string;
  placeholder?: string;
  rows?: number;
  required?: boolean;
  autoFocus?: boolean;
  maxLength?: number;
  ariaLabel?: string;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef(value);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  // A just-created goal opens with its name selected, ready to be typed over.
  useEffect(() => {
    if (!autoFocus) return;
    ref.current?.focus();
    ref.current?.select();
  }, [autoFocus]);

  const commit = (v: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (required && !v.trim()) return;
    if (v === last.current) return;
    last.current = v;
    onCommit(v);
  };

  const common = {
    ref,
    defaultValue: value,
    placeholder,
    maxLength,
    "aria-label": ariaLabel,
    className,
    onChange: (e: { target: { value: string } }) => {
      const v = e.target.value;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => commit(v), 350);
    },
    onBlur: (e: { target: { value: string } }) => {
      if (required && !e.target.value.trim()) {
        // Never leave a goal without a name.
        e.target.value = last.current;
        return;
      }
      commit(e.target.value);
    },
  };

  return multiline ? (
    <textarea {...common} rows={rows} className={`${className} resize-y`} />
  ) : (
    <input
      {...common}
      type="text"
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
    />
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled = [],
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: T[];
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-0.5"
    >
      {options.map((o) => {
        const on = o.value === value;
        const off = disabled.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={off}
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              on
                ? "bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--shadow-1)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function NodePanel({
  node,
  tree,
  stats,
  titleFocus,
  onUpdate,
  onAddChild,
  onMove,
  onReorder,
  onDelete,
  onSelect,
  onClose,
}: Props) {
  const st = stats.get(node.id);
  const path = pathTo(tree, node.id);
  const isRoot = node.parent_id === null;
  const isMain = !isRoot && path.length === 2;
  const kids = tree.children.get(node.id) ?? [];
  const siblings = node.parent_id ? (tree.children.get(node.parent_id) ?? []) : [];
  const idx = siblings.findIndex((s) => s.id === node.id);
  const isLeaf = st?.isLeaf ?? true;
  const locked = st?.locked ?? false;
  const pct = Math.round((st?.progress ?? 0) * 100);
  const due = dueState(node, st?.status === "done");

  const [newSub, setNewSub] = useState("");
  const [newRes, setNewRes] = useState({ title: "", url: "" });
  const [resError, setResError] = useState("");
  const [newChild, setNewChild] = useState("");

  const descendants = new Set(subtreeIds(tree, node.id));
  const ancestors = new Set(path.map((p) => p.id));

  const branchName = (n: CareerNode) => {
    const parent = n.parent_id ? tree.byId.get(n.parent_id) : null;
    return parent && parent.parent_id ? `${parent.title} › ${n.title}` : n.title;
  };

  const prereqOptions = [...tree.byId.values()].filter(
    (n) =>
      n.id !== node.id &&
      !descendants.has(n.id) &&
      !ancestors.has(n.id) &&
      !node.prerequisites.includes(n.id) &&
      !requiresNode(tree, n.id, node.id),
  );
  const moveOptions = [...tree.byId.values()].filter(
    (n) => !descendants.has(n.id) && n.id !== node.parent_id,
  );
  const depthOf = (n: CareerNode) => pathTo(tree, n.id).length - 1;

  function setStatus(status: CareerStatus) {
    onUpdate(node.id, { status });
  }

  function addSubtask() {
    const text = newSub.trim();
    if (!text) return;
    onUpdate(node.id, (n) => ({
      subtasks: [...n.subtasks, { id: cryptoId(), text, done: false }],
    }));
    setNewSub("");
  }

  function addResource() {
    const url = newRes.url.trim();
    if (!url) return;
    let ok = false;
    try {
      const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`);
      ok = u.protocol === "http:" || u.protocol === "https:";
    } catch {
      ok = false;
    }
    if (!ok) {
      setResError("Geçerli bir bağlantı gir (https://…).");
      return;
    }
    setResError("");
    const full = /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
    onUpdate(node.id, (n) => ({
      resources: [
        ...n.resources,
        { id: cryptoId(), title: newRes.title.trim() || hostOf(full), url: full },
      ],
    }));
    setNewRes({ title: "", url: "" });
  }

  return (
    <aside
      aria-label="Hedef detayları"
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-2)]"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <header className="px-4 pb-3 pt-3.5">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-[11px] text-[var(--muted)]">
            {path.length > 1
              ? path.slice(0, -1).map((p, i) => (
                  <span key={p.id}>
                    {i > 0 && <span className="px-1">›</span>}
                    <button
                      type="button"
                      onClick={() => onSelect(p.id)}
                      className="hover:text-[var(--foreground)] hover:underline"
                    >
                      {p.title}
                    </button>
                  </span>
                ))
              : "Ana hedef (gövde)"}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Paneli kapat"
            className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-2)]"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
        <DraftField
          key={node.id}
          value={node.title}
          required
          maxLength={200}
          ariaLabel="Hedef adı"
          autoFocus={titleFocus}
          onCommit={(title) => onUpdate(node.id, { title: title.trim() })}
          className="mt-1 w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 -mx-1 text-lg font-bold tracking-tight outline-none transition-colors hover:border-[var(--border)] focus:border-[var(--brand-1)]"
        />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto" key={node.id}>
        {/* Status / progress */}
        <Section title="Durum">
          {isLeaf ? (
            <Segmented<CareerStatus>
              label="Durum"
              value={node.status}
              onChange={setStatus}
              disabled={locked ? ["in_progress", "done"] : []}
              options={(Object.keys(STATUS_LABEL) as CareerStatus[]).map((s) => ({
                value: s,
                label: STATUS_LABEL[s],
              }))}
            />
          ) : (
            <div>
              <div
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-2 overflow-hidden rounded-full bg-[var(--surface-3)]"
              >
                <div
                  className="h-full rounded-full bg-[var(--brand-1)] transition-[width] duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-[var(--muted)]">
                %{pct} · {st?.leavesDone ?? 0}/{st?.leaves ?? 0} hedef tamamlandı. Durum, alt
                hedeflerden hesaplanır.
              </p>
            </div>
          )}
          {locked && (
            <p className="flex items-start gap-1.5 rounded-lg bg-[var(--surface-2)] px-2.5 py-2 text-xs text-[var(--muted)]">
              <Icon name="lock" className="mt-0.5 h-3.5 w-3.5" />
              <span>
                {st && st.blockedBy.length > 0 ? (
                  <>
                    Kilitli. Önce tamamlanmalı:{" "}
                    {st.blockedBy.map((id, i) => (
                      <span key={id}>
                        {i > 0 && ", "}
                        <button
                          type="button"
                          onClick={() => onSelect(id)}
                          className="font-semibold text-[var(--foreground)] underline"
                        >
                          {tree.byId.get(id)?.title}
                        </button>
                      </span>
                    ))}
                    .
                  </>
                ) : (
                  "Kilitli: üst dalın ön koşulları tamamlanmadı."
                )}
              </span>
            </p>
          )}
          {isLeaf && node.status === "done" && node.completed_at && (
            <p className="text-xs text-[var(--muted)]">
              Tamamlandı: {formatDate(node.completed_at)}
            </p>
          )}
        </Section>

        {!isRoot && (
          <Section title="Öncelik ve tarih">
            <Segmented<CareerPriority>
              label="Öncelik"
              value={node.priority}
              onChange={(priority) => onUpdate(node.id, { priority })}
              options={(Object.keys(PRIORITY_LABEL) as CareerPriority[]).map((p) => ({
                value: p,
                label: PRIORITY_LABEL[p],
              }))}
            />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <label className="block">
                <span className={labelCls}>Başlangıç</span>
                <input
                  type="date"
                  value={node.start_date ?? ""}
                  onChange={(e) => onUpdate(node.id, { start_date: e.target.value || null })}
                  className={fieldCls}
                />
              </label>
              <label className="block">
                <span className={labelCls}>Hedef tarih</span>
                <input
                  type="date"
                  value={node.due_date ?? ""}
                  onChange={(e) => onUpdate(node.id, { due_date: e.target.value || null })}
                  className={fieldCls}
                />
              </label>
            </div>
            {due && (
              <p
                className={`text-xs font-semibold ${
                  due === "overdue" ? "text-[var(--brand-2)]" : "text-[var(--accent-text)]"
                }`}
              >
                {due === "overdue" ? "Hedef tarih geçti." : "Hedef tarih yaklaşıyor."}
              </p>
            )}
          </Section>
        )}

        <Section title="Açıklama">
          <DraftField
            key={`d-${node.id}`}
            multiline
            value={node.description}
            placeholder="Bu hedef neden önemli, neyi kapsıyor?"
            maxLength={5000}
            ariaLabel="Açıklama"
            onCommit={(description) => onUpdate(node.id, { description })}
          />
        </Section>

        {!isRoot && (
          <Section
            title="Alt görevler"
            hint={
              node.subtasks.length
                ? `${node.subtasks.filter((s) => s.done).length}/${node.subtasks.length}`
                : undefined
            }
          >
            <ul className="space-y-1">
              {node.subtasks.map((s) => (
                <li key={s.id} className="group flex items-center gap-2">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={s.done}
                    aria-label={s.done ? "Tamamlandı işaretini kaldır" : "Tamamlandı olarak işaretle"}
                    onClick={() =>
                      onUpdate(node.id, (n) => ({
                        subtasks: n.subtasks.map((x) =>
                          x.id === s.id ? { ...x, done: !x.done } : x,
                        ),
                      }))
                    }
                    className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-colors ${
                      s.done
                        ? "border-[var(--brand-1)] bg-[var(--brand-1)] text-white"
                        : "border-[var(--border-strong)] hover:border-[var(--brand-1)]"
                    }`}
                  >
                    {s.done && <Icon name="check" className="h-3 w-3" strokeWidth={3} />}
                  </button>
                  <DraftField
                    key={s.id}
                    value={s.text}
                    required
                    maxLength={300}
                    ariaLabel="Alt görev"
                    onCommit={(text) =>
                      onUpdate(node.id, (n) => ({
                        subtasks: n.subtasks.map((x) => (x.id === s.id ? { ...x, text } : x)),
                      }))
                    }
                    className={`min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm outline-none focus:border-[var(--brand-1)] ${
                      s.done ? "text-[var(--muted)] line-through" : ""
                    }`}
                  />
                  <button
                    type="button"
                    aria-label="Alt görevi sil"
                    onClick={() =>
                      onUpdate(node.id, (n) => ({
                        subtasks: n.subtasks.filter((x) => x.id !== s.id),
                      }))
                    }
                    className="touch-show flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--muted)] opacity-0 transition-opacity hover:bg-[var(--surface-2)] focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Icon name="x" className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-1.5">
              <input
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addSubtask()}
                placeholder="Alt görev ekle…"
                maxLength={300}
                aria-label="Yeni alt görev"
                className={fieldCls}
              />
              <button
                type="button"
                onClick={addSubtask}
                disabled={!newSub.trim()}
                aria-label="Alt görevi ekle"
                className="btn-ghost shrink-0 rounded-lg px-2.5 disabled:opacity-40"
              >
                <Icon name="plus" className="h-4 w-4" />
              </button>
            </div>
            {!isLeaf && node.subtasks.length > 0 && (
              <p className="text-[11px] text-[var(--muted)]">
                Bu hedefin alt dalları var; ilerleme alt dallardan hesaplanır.
              </p>
            )}
          </Section>
        )}

        <Section title="Kaynaklar">
          {node.resources.length > 0 && (
            <ul className="space-y-1">
              {node.resources.map((r) => (
                <li key={r.id} className="group flex items-center gap-2">
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-1 text-sm text-[var(--brand-4)] hover:bg-[var(--surface-2)]"
                    title={r.url}
                  >
                    <Icon name="external" className="h-3.5 w-3.5" />
                    <span className="truncate">{r.title}</span>
                  </a>
                  <button
                    type="button"
                    aria-label="Kaynağı sil"
                    onClick={() =>
                      onUpdate(node.id, (n) => ({
                        resources: n.resources.filter((x) => x.id !== r.id),
                      }))
                    }
                    className="touch-show flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[var(--muted)] opacity-0 transition-opacity hover:bg-[var(--surface-2)] focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Icon name="x" className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-1.5">
            <input
              value={newRes.title}
              onChange={(e) => setNewRes({ ...newRes, title: e.target.value })}
              placeholder="Başlık (isteğe bağlı)"
              maxLength={200}
              aria-label="Kaynak başlığı"
              className={fieldCls}
            />
            <div className="flex gap-1.5">
              <input
                value={newRes.url}
                onChange={(e) => setNewRes({ ...newRes, url: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && addResource()}
                placeholder="Bağlantı (https://…)"
                aria-label="Kaynak bağlantısı"
                className={fieldCls}
              />
              <button
                type="button"
                onClick={addResource}
                disabled={!newRes.url.trim()}
                aria-label="Kaynağı ekle"
                className="btn-ghost shrink-0 rounded-lg px-2.5 disabled:opacity-40"
              >
                <Icon name="plus" className="h-4 w-4" />
              </button>
            </div>
            {resError && <p className="text-xs text-[var(--brand-2)]">{resError}</p>}
          </div>
        </Section>

        <Section title="Notlar">
          <DraftField
            key={`n-${node.id}`}
            multiline
            rows={4}
            value={node.notes}
            placeholder="Serbest notlar…"
            maxLength={20000}
            ariaLabel="Notlar"
            onCommit={(notes) => onUpdate(node.id, { notes })}
          />
        </Section>

        {!isRoot && (
          <Section title="Ön koşullar" hint="Tamamlanmadan bu hedef kilitli kalır">
            {node.prerequisites.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {node.prerequisites
                  .filter((id) => tree.byId.has(id))
                  .map((id) => (
                    <li
                      key={id}
                      className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] py-0.5 pl-2.5 pr-1 text-xs"
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(id)}
                        className="max-w-[10rem] truncate font-semibold hover:underline"
                      >
                        {tree.byId.get(id)?.title}
                      </button>
                      <button
                        type="button"
                        aria-label="Ön koşulu kaldır"
                        onClick={() =>
                          onUpdate(node.id, (n) => ({
                            prerequisites: n.prerequisites.filter((p) => p !== id),
                          }))
                        }
                        className="flex h-5 w-5 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-3)]"
                      >
                        <Icon name="x" className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
              </ul>
            )}
            <select
              aria-label="Ön koşul ekle"
              value=""
              onChange={(e) => {
                const id = e.target.value;
                if (id) onUpdate(node.id, (n) => ({ prerequisites: [...n.prerequisites, id] }));
              }}
              className={fieldCls}
            >
              <option value="">Ön koşul ekle…</option>
              {prereqOptions.map((n) => (
                <option key={n.id} value={n.id}>
                  {branchName(n)}
                </option>
              ))}
            </select>
          </Section>
        )}

        <Section title="Dal">
          <div className="flex gap-1.5">
            <input
              value={newChild}
              onChange={(e) => setNewChild(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newChild.trim()) {
                  onAddChild(node.id, newChild.trim());
                  setNewChild("");
                }
              }}
              placeholder={isRoot ? "Yeni ana dal ekle…" : "Alt hedef / dal ekle…"}
              maxLength={200}
              aria-label="Alt hedef adı"
              className={fieldCls}
            />
            <button
              type="button"
              disabled={!newChild.trim()}
              onClick={() => {
                onAddChild(node.id, newChild.trim());
                setNewChild("");
              }}
              className="btn-gradient shrink-0 rounded-lg px-3 text-sm font-semibold disabled:opacity-50"
            >
              Ekle
            </button>
          </div>
          {kids.length > 0 && (
            <p className="text-[11px] text-[var(--muted)]">{kids.length} doğrudan alt hedef.</p>
          )}

          {isMain && (
            <div className="space-y-2 pt-1.5">
              <div>
                <span className={labelCls}>Dal rengi</span>
                <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Dal rengi">
                  {BRANCH_COLORS.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      role="radio"
                      aria-checked={node.color === c.key}
                      aria-label={c.label}
                      title={c.label}
                      onClick={() => onUpdate(node.id, { color: c.key })}
                      className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                        node.color === c.key ? "border-[var(--foreground)]" : "border-transparent"
                      }`}
                      style={{ background: c.value }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <span className={labelCls}>Gövdenin tarafı</span>
                <Segmented<"left" | "right">
                  label="Gövdenin tarafı"
                  value={node.side ?? (idx % 2 === 0 ? "right" : "left")}
                  onChange={(side) => onUpdate(node.id, { side })}
                  options={[
                    { value: "left", label: "Sol" },
                    { value: "right", label: "Sağ" },
                  ]}
                />
              </div>
            </div>
          )}

          {!isRoot && (
            <div className="space-y-2 pt-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--muted)]">Sıra</span>
                <button
                  type="button"
                  disabled={idx <= 0}
                  onClick={() => onReorder(node.id, -1)}
                  className="btn-ghost flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold disabled:opacity-40"
                >
                  <Icon name="arrow-up" className="h-3.5 w-3.5" /> Yukarı
                </button>
                <button
                  type="button"
                  disabled={idx < 0 || idx >= siblings.length - 1}
                  onClick={() => onReorder(node.id, 1)}
                  className="btn-ghost flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold disabled:opacity-40"
                >
                  <Icon name="arrow-down" className="h-3.5 w-3.5" /> Aşağı
                </button>
              </div>
              <label className="block">
                <span className={labelCls}>Başka bir dala taşı</span>
                <select
                  value=""
                  onChange={(e) => e.target.value && onMove(node.id, e.target.value)}
                  className={fieldCls}
                >
                  <option value="">Hedef dal seç…</option>
                  {moveOptions.map((n) => (
                    <option key={n.id} value={n.id}>
                      {`${"  ".repeat(Math.min(depthOf(n), 4))}${n.title}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </Section>

        {!isRoot && (
          <div className="border-t border-[var(--border)] px-4 py-3.5">
            <button
              type="button"
              onClick={() => onDelete(node.id)}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-[var(--brand-2)] hover:bg-[var(--surface-2)]"
            >
              <Icon name="trash" className="h-4 w-4" />
              {kids.length > 0 ? "Dalı ve alt hedeflerini sil" : "Hedefi sil"}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
