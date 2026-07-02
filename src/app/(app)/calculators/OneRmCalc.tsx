"use client";

import { useState } from "react";
import { brzycki1RM, epley1RM, percentTable } from "@/lib/calculations";
import { saveCalculation } from "./actions";

const inputCls =
  "w-full rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500";

export function OneRmCalc() {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [saved, setSaved] = useState(false);

  const w = parseFloat(weight);
  const r = parseInt(reps, 10);
  const valid = w > 0 && r >= 1 && r <= 12;
  const epley = valid ? epley1RM(w, r) : null;
  const brzycki = valid ? brzycki1RM(w, r) : null;
  const avg = epley && brzycki ? (epley + brzycki) / 2 : null;

  async function handleSave() {
    if (!valid || !epley || !brzycki || !avg) return;
    await saveCalculation(
      "1rm",
      { weight: w, reps: r },
      { epley: +epley.toFixed(1), brzycki: +brzycki.toFixed(1), average: +avg.toFixed(1) },
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="rm-weight" className="text-sm font-medium">
            Kaldırılan ağırlık (kg)
          </label>
          <input
            id="rm-weight"
            type="number"
            min="1"
            step="0.5"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="rm-reps" className="text-sm font-medium">
            Tekrar sayısı (1–12)
          </label>
          <input
            id="rm-reps"
            type="number"
            min="1"
            max="12"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {r > 12 && (
        <p className="text-sm text-red-600 dark:text-red-400">
          12+ tekrarda 1RM tahminleri güvenilirliğini yitirir.
        </p>
      )}

      {valid && epley && brzycki && avg && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Epley", value: epley },
              { label: "Brzycki", value: brzycki },
              { label: "Ortalama", value: avg },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-stone-200 dark:border-stone-800 p-3 text-center"
              >
                <p className="text-2xl font-bold">
                  {s.value.toFixed(1)}
                  <span className="text-sm font-normal text-stone-500"> kg</span>
                </p>
                <p className="text-xs text-stone-500">{s.label}</p>
              </div>
            ))}
          </div>

          <details>
            <summary className="cursor-pointer text-sm font-medium text-amber-700 dark:text-amber-500">
              %1RM yük tablosu (ortalamaya göre)
            </summary>
            <table className="mt-2 w-full text-sm [font-variant-numeric:tabular-nums]">
              <tbody>
                {percentTable(avg).map((row) => (
                  <tr key={row.pct} className="border-b border-stone-100 dark:border-stone-900">
                    <td className="py-1 text-stone-500">%{row.pct}</td>
                    <td className="py-1 text-right font-medium">
                      {row.load.toFixed(1)} kg
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>

          <button
            onClick={handleSave}
            className="rounded-md border border-stone-300 dark:border-stone-700 px-4 py-1.5 text-sm font-medium hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            {saved ? "Kaydedildi ✓" : "Geçmişe kaydet"}
          </button>
        </>
      )}
    </div>
  );
}
