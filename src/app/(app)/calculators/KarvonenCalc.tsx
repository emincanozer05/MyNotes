"use client";

import { useState } from "react";
import { karvonenTarget, karvonenZones } from "@/lib/calculations";
import { saveCalculation } from "./actions";

const inputCls =
  "w-full rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500";

export function KarvonenCalc() {
  const [rest, setRest] = useState("");
  const [max, setMax] = useState("");
  const [age, setAge] = useState("");
  const [intensity, setIntensity] = useState("70");
  const [saved, setSaved] = useState(false);

  const hrRest = parseInt(rest, 10);
  const hrMax = max ? parseInt(max, 10) : age ? 220 - parseInt(age, 10) : NaN;
  const pct = parseInt(intensity, 10);
  const valid =
    hrRest > 20 && hrMax > hrRest && hrMax < 230 && pct >= 30 && pct <= 100;

  const target = valid ? karvonenTarget(hrRest, hrMax, pct / 100) : null;
  const zones = valid ? karvonenZones(hrRest, hrMax) : null;

  async function handleSave() {
    if (!valid || !target) return;
    await saveCalculation(
      "karvonen",
      { hrRest, hrMax, intensity: pct },
      { target, zones: karvonenZones(hrRest, hrMax) },
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <label htmlFor="k-rest" className="text-sm font-medium">
            Dinlenme nabzı
          </label>
          <input
            id="k-rest"
            type="number"
            value={rest}
            onChange={(e) => setRest(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="k-max" className="text-sm font-medium">
            Maks. nabız
          </label>
          <input
            id="k-max"
            type="number"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            placeholder="biliniyorsa"
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="k-age" className="text-sm font-medium">
            Yaş (maks. yoksa)
          </label>
          <input
            id="k-age"
            type="number"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            placeholder="220 − yaş"
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="k-int" className="text-sm font-medium">
            Hedef yoğunluk %
          </label>
          <input
            id="k-int"
            type="number"
            min="30"
            max="100"
            value={intensity}
            onChange={(e) => setIntensity(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {valid && target && zones && (
        <>
          <div className="rounded-lg border border-stone-200 dark:border-stone-800 p-4 text-center">
            <p className="text-3xl font-bold">
              {target}
              <span className="text-sm font-normal text-stone-500"> atım/dk</span>
            </p>
            <p className="text-xs text-stone-500">
              %{pct} yoğunlukta hedef nabız (KAR = {hrMax} − {hrRest})
            </p>
          </div>

          <table className="w-full text-sm [font-variant-numeric:tabular-nums]">
            <thead>
              <tr className="border-b border-stone-200 dark:border-stone-800 text-left text-xs text-stone-500">
                <th className="py-1.5 font-medium">Bölge</th>
                <th className="py-1.5 text-right font-medium">Yoğunluk</th>
                <th className="py-1.5 text-right font-medium">Nabız aralığı</th>
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr key={z.name} className="border-b border-stone-100 dark:border-stone-900">
                  <td className="py-1.5">{z.name}</td>
                  <td className="py-1.5 text-right text-stone-500">
                    %{z.lowPct}–{z.highPct}
                  </td>
                  <td className="py-1.5 text-right font-medium">
                    {z.lowBpm}–{z.highBpm}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

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
