"use server";

import { createClient, getSessionUser } from "@/lib/supabase/server";
import { isUuid, normalizeNode, type CareerNode } from "@/lib/career";

const MAX_BATCH = 400;

/**
 * Inserts or updates career nodes (full rows). Rows are re-sanitised here, so
 * a tampered client can't write malformed data. Parents are listed first, but
 * the self-referencing FK is checked at statement end anyway.
 */
export async function saveCareerNodes(
  input: CareerNode[],
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return { error: "Oturum bulunamadı." };
  if (!Array.isArray(input) || input.length === 0) return { error: null };
  if (input.length > MAX_BATCH) return { error: "Tek seferde çok fazla düğüm." };

  const now = new Date().toISOString();
  const rows = [];
  for (const raw of input) {
    const n = normalizeNode(raw as unknown as Record<string, unknown>);
    if (!n) return { error: "Geçersiz düğüm verisi." };
    rows.push({
      id: n.id,
      parent_id: n.parent_id,
      title: n.title,
      description: n.description,
      status: n.status,
      priority: n.priority,
      start_date: n.start_date,
      due_date: n.due_date,
      notes: n.notes,
      subtasks: n.subtasks,
      resources: n.resources,
      prerequisites: n.prerequisites,
      color: n.color,
      side: n.side,
      collapsed: n.collapsed,
      sort_order: n.sort_order,
      completed_at: n.completed_at,
      updated_at: now,
    });
  }
  // Parents first, so a fresh tree inserts in a natural order.
  const depthOf = new Map<string, number>();
  const byId = new Map(rows.map((r) => [r.id, r]));
  const depth = (id: string, guard = 0): number => {
    const known = depthOf.get(id);
    if (known !== undefined) return known;
    const r = byId.get(id);
    const d = r?.parent_id && byId.has(r.parent_id) && guard < 64 ? depth(r.parent_id, guard + 1) + 1 : 0;
    depthOf.set(id, d);
    return d;
  };
  rows.sort((a, b) => depth(a.id) - depth(b.id));

  const { error } = await supabase.from("career_nodes").upsert(rows, { onConflict: "id" });
  if (error) {
    return {
      error: /relation .*career_nodes|schema cache/i.test(error.message)
        ? "career_nodes tablosu yok. Supabase'de 0016_career_tree migration'ını çalıştırın."
        : error.message,
    };
  }
  return { error: null };
}

/** Deletes a node; its whole branch goes with it (ON DELETE CASCADE). */
export async function deleteCareerNode(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) return { error: "Oturum bulunamadı." };
  if (!isUuid(id)) return { error: "Geçersiz düğüm." };
  const { error } = await supabase.from("career_nodes").delete().eq("id", id);
  return { error: error?.message ?? null };
}
