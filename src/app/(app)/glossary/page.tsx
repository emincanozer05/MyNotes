import { createClient } from "@/lib/supabase/server";
import { Glossary, type GlossaryEntry } from "./Glossary";

export default async function GlossaryPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("glossary_entries")
    .select("id, term, definition, source_path, created_at")
    .order("created_at", { ascending: false });

  return (
    <Glossary
      entries={(data ?? []) as GlossaryEntry[]}
      setupError={
        error
          ? "Sözlük yüklenemedi. Supabase'de 0015_glossary migration'ının çalıştırıldığından emin olun."
          : null
      }
    />
  );
}
