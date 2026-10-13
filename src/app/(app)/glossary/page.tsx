import { createClient, getSessionUser } from "@/lib/supabase/server";
import { listGlossary, type GlossaryEntry } from "@/lib/glossaryStore";
import { Glossary } from "./Glossary";

export default async function GlossaryPage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  let entries: GlossaryEntry[] = [];
  let setupError: string | null = null;
  try {
    if (user) entries = await listGlossary(supabase, user.id);
  } catch (e) {
    setupError = `Sözlük yüklenemedi: ${e instanceof Error ? e.message : "bilinmeyen hata"}`;
  }
  return <Glossary entries={entries} setupError={setupError} />;
}
