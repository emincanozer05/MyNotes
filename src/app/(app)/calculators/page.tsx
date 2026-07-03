import { createClient } from "@/lib/supabase/server";
import { OneRmCalc } from "./OneRmCalc";
import { FvProfileCalc } from "./FvProfileCalc";
import { KarvonenCalc } from "./KarvonenCalc";
import { deleteCalculation } from "./actions";

interface CalcRow {
  id: string;
  calc_type: string;
  inputs: Record<string, unknown>;
  results: Record<string, unknown>;
  created_at: string;
}

function summarize(row: CalcRow): string {
  const i = row.inputs;
  const r = row.results;
  switch (row.calc_type) {
    case "1rm":
      return `${i.weight} kg × ${i.reps} tekrar → 1RM ≈ ${r.average} kg (Epley ${r.epley} / Brzycki ${r.brzycki})`;
    case "fv-profile":
      return `F0 ${r.f0} N/kg · V0 ${r.v0} m/s · Pmax ${r.pmax} W/kg · dengesizlik %${r.imbalance}`;
    case "karvonen":
      return `Dinlenme ${i.hrRest} / Maks ${i.hrMax} → %${i.intensity} hedef: ${r.target} atım/dk`;
    default:
      return "";
  }
}

const TYPE_LABEL: Record<string, string> = {
  "1rm": "1RM",
  "fv-profile": "Kuvvet-Hız",
  karvonen: "Karvonen",
};

export default async function CalculatorsPage() {
  const supabase = await createClient();
  const { data: history } = await supabase
    .from("calc_history")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  const sections = [
    {
      title: "1RM Hesaplayıcı",
      desc: "Epley ve Brzycki formülleriyle tahmini maksimal kuvvet.",
      body: <OneRmCalc />,
    },
    {
      title: "Kuvvet-Hız Profili",
      desc: "Yüklü sıçrama verilerinden atletin kuvvet mi hız mı çalışması gerektiğini analiz eder.",
      body: <FvProfileCalc />,
    },
    {
      title: "Karvonen Nabız Bölgeleri",
      desc: "Kalp atım rezervine göre hedef nabız ve antrenman bölgeleri.",
      body: <KarvonenCalc />,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hesaplayıcılar</h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Kondisyonerlik araçları — sonuçları geçmişe kaydedebilirsiniz.
        </p>
      </div>

      {sections.map((s) => (
        <section
          key={s.title}
          className="card p-5"
        >
          <h2 className="text-lg font-semibold">{s.title}</h2>
          <p className="mt-0.5 mb-4 text-sm text-stone-500 dark:text-stone-400">
            {s.desc}
          </p>
          {s.body}
        </section>
      ))}

      <section>
        <h2 className="text-lg font-semibold">Hesaplama geçmişi</h2>
        {history && history.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {(history as CalcRow[]).map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 card px-4 py-2.5"
              >
                <div className="min-w-0">
                  <span className="mr-2 rounded bg-stone-100 dark:bg-stone-800 px-1.5 py-0.5 text-xs font-medium text-stone-600 dark:text-stone-300">
                    {TYPE_LABEL[row.calc_type] ?? row.calc_type}
                  </span>
                  <span className="text-sm">{summarize(row)}</span>
                  <span className="ml-2 text-xs text-stone-400">
                    {new Date(row.created_at).toLocaleDateString("tr-TR")}
                  </span>
                </div>
                <form action={deleteCalculation}>
                  <input type="hidden" name="id" value={row.id} />
                  <button className="text-xs text-stone-400 hover:text-red-600">
                    Sil
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 rounded-lg border border-dashed border-stone-300 dark:border-stone-700 p-6 text-center text-sm text-stone-500">
            Henüz kayıtlı hesaplama yok.
          </p>
        )}
      </section>
    </div>
  );
}
