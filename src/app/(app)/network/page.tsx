import { createClient } from "@/lib/supabase/server";
import { normalizeProfile, type Contact } from "@/lib/network";
import { NetworkMap } from "./NetworkMap";

export default async function NetworkPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("id, full_name, profile, created_at")
    .order("full_name", { ascending: true });

  const contacts: Contact[] = (data ?? []).map((r) => ({
    id: r.id as string,
    full_name: r.full_name as string,
    profile: normalizeProfile(r.profile),
    created_at: r.created_at as string,
  }));

  return (
    <NetworkMap
      contacts={contacts}
      setupError={
        error
          ? "Kişiler yüklenemedi. Supabase'de 0012_network_contacts migration'ının çalıştırıldığından emin olun."
          : null
      }
    />
  );
}
