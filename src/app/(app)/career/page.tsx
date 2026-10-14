import { createClient } from "@/lib/supabase/server";
import { normalizeNode, type CareerNode } from "@/lib/career";
import { CareerTree } from "./CareerTree";

export const metadata = { title: "Kariyer Yol Haritası" };

export default async function CareerPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("career_nodes")
    .select("*")
    .order("created_at", { ascending: true });

  const nodes: CareerNode[] = (data ?? [])
    .map((r) => normalizeNode(r as Record<string, unknown>))
    .filter((n): n is CareerNode => n !== null);

  return (
    <CareerTree
      initialNodes={nodes}
      setupError={
        error
          ? "Kariyer ağacı yüklenemedi. Supabase'de 0016_career_tree migration'ının çalıştırıldığından emin olun."
          : null
      }
    />
  );
}
