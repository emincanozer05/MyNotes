import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { importGlossary } from "@/lib/glossaryStore";

// Foreign-key-safe insert order + the conflict target used to upsert (restore
// without creating duplicates). user_id is always forced to the current user
// so a backup can also be restored into a different account.
const IMPORT_ORDER: { table: string; conflict: string }[] = [
  { table: "sources", conflict: "id" },
  { table: "notes", conflict: "id" },
  { table: "tags", conflict: "id" },
  { table: "note_tags", conflict: "note_id,tag_id" },
  { table: "note_links", conflict: "from_note,to_note" },
  { table: "flashcards", conflict: "id" },
  { table: "voice_notes", conflict: "id" },
  { table: "contacts", conflict: "id" },
];

/** POST /api/backup/import — restores rows from an exported backup JSON. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    app?: string;
    tables?: Record<string, Record<string, unknown>[]>;
  } | null;

  const tables = body?.tables;
  if (!tables || typeof tables !== "object") {
    return NextResponse.json(
      { error: "Geçersiz yedek dosyası." },
      { status: 400 },
    );
  }

  const result: Record<string, string | number> = {};

  for (const { table, conflict } of IMPORT_ORDER) {
    const rows = Array.isArray(tables[table]) ? tables[table] : [];
    if (rows.length === 0) {
      result[table] = 0;
      continue;
    }
    // Force ownership to the current user so RLS accepts the rows.
    const withUser = rows.map((r) => ({ ...r, user_id: user.id }));
    const { error } = await supabase
      .from(table)
      .upsert(withUser, { onConflict: conflict });
    result[table] = error ? `hata: ${error.message}` : rows.length;
  }

  // Glossary goes through its store (table or storage snapshot fallback).
  const glossaryRows = Array.isArray(tables.glossary_entries) ? tables.glossary_entries : [];
  try {
    result.glossary_entries = await importGlossary(supabase, user.id, glossaryRows);
  } catch (e) {
    result.glossary_entries = `hata: ${e instanceof Error ? e.message : "bilinmeyen"}`;
  }

  revalidatePath("/backup");
  return NextResponse.json({ ok: true, result });
}
