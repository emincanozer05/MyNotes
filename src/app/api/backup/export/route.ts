import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Tables that hold the user's data (RLS scopes every query to the user). */
const TABLES = [
  "sources",
  "notes",
  "tags",
  "note_tags",
  "note_links",
  "flashcards",
  "voice_notes",
] as const;

/**
 * GET /api/backup/export — downloads the whole account as a single JSON file.
 * Note: voice-note audio files live in Storage and are referenced by path;
 * the JSON carries the metadata/transcript, not the raw audio bytes.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  }

  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    const { data } = await supabase.from(t).select("*");
    tables[t] = data ?? [];
  }

  const payload = {
    app: "sc-hub",
    version: 1,
    exportedAt: new Date().toISOString(),
    userEmail: user.email ?? null,
    tables,
  };

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="sc-hub-yedek-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
