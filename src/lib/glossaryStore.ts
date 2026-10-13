import type { createClient } from "@/lib/supabase/server";

/**
 * Storage for the "Ne, nedir?" glossary.
 *
 * Primary backend is the `glossary_entries` table (migration 0015). On a
 * database where 0015 hasn't been applied the entries live in the existing
 * private `voice-notes` bucket (0005, `<uid>/…` RLS) as a single JSON snapshot
 * under `<uid>/glossary/` — so the feature works without a manual migration.
 * The bucket has no UPDATE policy, so each write uploads a new, timestamped
 * snapshot and removes the older ones; reads take the newest. Once the table
 * exists, a leftover snapshot is moved into it on the next read.
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface GlossaryEntry {
  id: string;
  term: string;
  definition: string;
  source_path: string | null;
  created_at: string;
  updated_at: string;
}

const TABLE = "glossary_entries";
const BUCKET = "voice-notes";
const COLUMNS = "id, term, definition, source_path, created_at, updated_at";

function folder(userId: string) {
  return `${userId}/glossary`;
}

/** True when PostgREST reports that the glossary table isn't deployed. */
function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    (error.message ?? "").includes(TABLE)
  );
}

function newId(): string {
  return crypto.randomUUID();
}

function normalize(raw: Partial<GlossaryEntry>): GlossaryEntry | null {
  if (!raw || typeof raw.id !== "string") return null;
  const now = new Date().toISOString();
  return {
    id: raw.id,
    term: typeof raw.term === "string" ? raw.term : "",
    definition: typeof raw.definition === "string" ? raw.definition : "",
    source_path: typeof raw.source_path === "string" ? raw.source_path : null,
    created_at: typeof raw.created_at === "string" ? raw.created_at : now,
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : now,
  };
}

// ---- Storage snapshot backend ----------------------------------------------

/** Snapshot file names in the user's glossary folder, newest first. */
async function snapshotNames(supabase: Supabase, userId: string): Promise<string[]> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(folder(userId), { limit: 1000 });
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((f) => f.name)
    .filter((n) => /^v-\d+\.json$/.test(n))
    .sort((a, b) => Number(b.slice(2, -5)) - Number(a.slice(2, -5)));
}

async function readSnapshot(
  supabase: Supabase,
  userId: string,
): Promise<{ entries: GlossaryEntry[]; names: string[] }> {
  const names = await snapshotNames(supabase, userId);
  if (names.length === 0) return { entries: [], names };
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(`${folder(userId)}/${names[0]}`);
  if (error || !data) throw new Error(error?.message ?? "Sözlük okunamadı.");
  const parsed = JSON.parse(await data.text()) as unknown;
  const list = Array.isArray(parsed) ? parsed : [];
  return {
    entries: list.map((e) => normalize(e as Partial<GlossaryEntry>)).filter(
      (e): e is GlossaryEntry => e !== null,
    ),
    names,
  };
}

async function writeSnapshot(
  supabase: Supabase,
  userId: string,
  entries: GlossaryEntry[],
  oldNames: string[],
) {
  // Strictly increasing name even for two writes in the same millisecond.
  const newest = oldNames[0] ? Number(oldNames[0].slice(2, -5)) : 0;
  const name = `v-${Math.max(Date.now(), newest + 1)}.json`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(`${folder(userId)}/${name}`, JSON.stringify(entries), {
      contentType: "application/json",
      upsert: false,
    });
  if (error) throw new Error(error.message);
  if (oldNames.length > 0) {
    await supabase.storage
      .from(BUCKET)
      .remove(oldNames.map((n) => `${folder(userId)}/${n}`));
  }
}

async function mutateSnapshot(
  supabase: Supabase,
  userId: string,
  fn: (entries: GlossaryEntry[]) => GlossaryEntry[],
) {
  const { entries, names } = await readSnapshot(supabase, userId);
  await writeSnapshot(supabase, userId, fn(entries), names);
}

/** Moves a leftover storage snapshot into the (now existing) table. */
async function migrateSnapshot(supabase: Supabase, userId: string) {
  let snap: { entries: GlossaryEntry[]; names: string[] };
  try {
    snap = await readSnapshot(supabase, userId);
  } catch {
    return;
  }
  if (snap.names.length === 0) return;
  if (snap.entries.length > 0) {
    const { error } = await supabase
      .from(TABLE)
      .upsert(snap.entries.map((e) => ({ ...e, user_id: userId })), { onConflict: "id" });
    if (error) return;
  }
  await supabase.storage
    .from(BUCKET)
    .remove(snap.names.map((n) => `${folder(userId)}/${n}`));
}

// ---- Public API ------------------------------------------------------------

export async function listGlossary(
  supabase: Supabase,
  userId: string,
): Promise<GlossaryEntry[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .order("created_at", { ascending: false });
  if (!error) {
    const names = await snapshotNames(supabase, userId).catch(() => []);
    if (names.length === 0) return (data ?? []) as GlossaryEntry[];
    await migrateSnapshot(supabase, userId);
    const again = await supabase
      .from(TABLE)
      .select(COLUMNS)
      .order("created_at", { ascending: false });
    return (again.data ?? data ?? []) as GlossaryEntry[];
  }
  if (!isMissingTable(error)) throw new Error(error.message);
  const { entries } = await readSnapshot(supabase, userId);
  return entries.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function insertGlossary(
  supabase: Supabase,
  userId: string,
  input: { term: string; definition: string; source_path: string | null },
): Promise<string> {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(input)
    .select("id")
    .single();
  if (!error) return data.id as string;
  if (!isMissingTable(error)) throw new Error(error.message);
  const now = new Date().toISOString();
  const entry: GlossaryEntry = { id: newId(), ...input, created_at: now, updated_at: now };
  await mutateSnapshot(supabase, userId, (list) => [entry, ...list]);
  return entry.id;
}

export async function updateGlossary(
  supabase: Supabase,
  userId: string,
  id: string,
  input: { term: string; definition: string },
) {
  const updated_at = new Date().toISOString();
  const { error } = await supabase
    .from(TABLE)
    .update({ ...input, updated_at })
    .eq("id", id);
  if (!error) return;
  if (!isMissingTable(error)) throw new Error(error.message);
  await mutateSnapshot(supabase, userId, (list) =>
    list.map((e) => (e.id === id ? { ...e, ...input, updated_at } : e)),
  );
}

export async function deleteGlossary(supabase: Supabase, userId: string, id: string) {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (!error) return;
  if (!isMissingTable(error)) throw new Error(error.message);
  await mutateSnapshot(supabase, userId, (list) => list.filter((e) => e.id !== id));
}

/** Backup restore: upserts rows by id into whichever backend is active. */
export async function importGlossary(
  supabase: Supabase,
  userId: string,
  rows: Record<string, unknown>[],
): Promise<number> {
  const entries = rows
    .map((r) => normalize(r as Partial<GlossaryEntry>))
    .filter((e): e is GlossaryEntry => e !== null);
  if (entries.length === 0) return 0;
  const { error } = await supabase
    .from(TABLE)
    .upsert(entries.map((e) => ({ ...e, user_id: userId })), { onConflict: "id" });
  if (!error) return entries.length;
  if (!isMissingTable(error)) throw new Error(error.message);
  const byId = new Map(entries.map((e) => [e.id, e]));
  await mutateSnapshot(supabase, userId, (list) => [
    ...list.filter((e) => !byId.has(e.id)),
    ...entries,
  ]);
  return entries.length;
}
