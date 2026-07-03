"use client";

import { useState } from "react";
import { fvProfileFromJumps, type FvCondition, type FvResult } from "@/lib/calculations";
import { saveCalculation } from "./actions";

const inputCls =
  "w-full rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500";

const ORIENTATION_LABEL = {
  force: "Kuvvet baskın → hız çalışmalı",
  velocity: "Hız baskın → kuvvet çalışmalı",
  balanced: "Dengeli profil",
} as const;

function FvChart({ result }: { result: FvResult }) {
  const W = 380;
  const H = 250;
  const m = { top: 16, right: 16, bottom: 40, left: 48 };
  const xMax = result.v0 * 1.08;
  const yMax = result.f0 * 1.08;
  const x = (v: number) => m.left + (v / xMax) * (W - m.left - m.right);
  const y = (f: number) => H - m.bottom - (f / yMax) * (H - m.top - m.bottom);

  const xTicks = [0, 1, 2, 3].filter((t) => t <= xMax);
  const yTicks = [0, 10, 20, 30, 40, 50].filter((t) => t <= yMax);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full max-w-md"
      role="img"
      aria-label="Kuvvet-hız profili grafiği: ölçülen noktalar ve doğrusal F-V ilişkisi"
    >
      {yTicks.map((t) => (
        <g key={`y${t}`}>
          <line
            x1={m.left}
            x2={W - m.right}
            y1={y(t)}
            y2={y(t)}
            className="stroke-[#e1e0d9] dark:stroke-[#2c2c2a]"
            strokeWidth="1"
          />
          <text
            x={m.left - 6}
            y={y(t) + 3}
            textAnchor="end"
            className="fill-[#898781] text-[10px] [font-variant-numeric:tabular-nums]"
          >
            {t}
          </text>
        </g>
      ))}
      {xTicks.map((t) => (
        <text
          key={`x${t}`}
          x={x(t)}
          y={H - m.bottom + 14}
          textAnchor="middle"
          className="fill-[#898781] text-[10px] [font-variant-numeric:tabular-nums]"
        >
          {t}
        </text>
      ))}
      <line
        x1={m.left}
        x2={W - m.right}
        y1={y(0)}
        y2={y(0)}
        className="stroke-[#c3c2b7] dark:stroke-[#383835]"
        strokeWidth="1"
      />
      <text
        x={(m.left + W - m.right) / 2}
        y={H - 8}
        textAnchor="middle"
        className="fill-[#898781] text-[10px]"
      >
        Ortalama itiş hızı (m/s)
      </text>
      <text
        x={12}
        y={(m.top + H - m.bottom) / 2}
        textAnchor="middle"
        transform={`rotate(-90 12 ${(m.top + H - m.bottom) / 2})`}
        className="fill-[#898781] text-[10px]"
      >
        Kuvvet (N/kg)
      </text>

      {/* fitted F-V line */}
      <line
        x1={x(0)}
        y1={y(result.f0)}
        x2={x(result.v0)}
        y2={y(0)}
        className="stroke-[#2a78d6] dark:stroke-[#3987e5]"
        strokeWidth="2"
      />

      {/* measured conditions */}
      {result.points.map((p, i) => (
        <circle
          key={i}
          cx={x(p.velocity)}
          cy={y(p.force)}
          r="4.5"
          className="fill-[#2a78d6] dark:fill-[#3987e5] stroke-[#fcfcfb] dark:stroke-[#1a1a19]"
          strokeWidth="2"
        >
          <title>{`${p.velocity.toFixed(2)} m/s · ${p.force.toFixed(1)} N/kg`}</title>
        </circle>
      ))}

      {/* direct labels for the two intercepts */}
      <text
        x={x(0) + 6}
        y={y(result.f0) - 6}
        className="fill-[#52514e] dark:fill-[#c3c2b7] text-[10px] font-medium"
      >
        F0 = {result.f0.toFixed(1)} N/kg
      </text>
      <text
        x={x(result.v0) - 4}
        y={y(0) - 8}
        textAnchor="end"
        className="fill-[#52514e] dark:fill-[#c3c2b7] text-[10px] font-medium"
      >
        V0 = {result.v0.toFixed(2)} m/s
      </text>
    </svg>
  );
}

export function FvProfileCalc() {
  const [bodyMass, setBodyMass] = useState("");
  const [pushOff, setPushOff] = useState("");
  const [rows, setRows] = useState<{ load: string; height: string }[]>([
    { load: "0", height: "" },
    { load: "20", height: "" },
  ]);
  const [result, setResult] = useState<FvResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function compute() {
    const conditions: FvCondition[] = rows
      .filter((r) => r.height)
      .map((r) => ({
        addedLoad: parseFloat(r.load) || 0,
        jumpHeightCm: parseFloat(r.height) || 0,
      }));
    const res = fvProfileFromJumps(
      parseFloat(bodyMass) || 0,
      (parseFloat(pushOff) || 0) / 100,
      conditions,
    );
    if ("error" in res) {
      setError(res.error);
      setResult(null);
    } else {
      setError(null);
      setResult(res);
    }
  }

  async function handleSave() {
    if (!result) return;
    await saveCalculation(
      "fv-profile",
      { bodyMass: parseFloat(bodyMass), pushOffCm: parseFloat(pushOff), rows },
      {
        f0: +result.f0.toFixed(1),
        v0: +result.v0.toFixed(2),
        pmax: +result.pmax.toFixed(1),
        imbalance: +result.imbalance.toFixed(0),
        orientation: result.orientation,
      },
    );
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500 dark:text-stone-400">
        Samozino yöntemi: farklı ek yüklerle yapılan squat sıçrama
        yüksekliklerinden F-V profili çıkarılır ve teorik optimumla
        karşılaştırılır.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="fv-mass" className="text-sm font-medium">
            Vücut ağırlığı (kg)
          </label>
          <input
            id="fv-mass"
            type="number"
            value={bodyMass}
            onChange={(e) => setBodyMass(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="fv-pushoff" className="text-sm font-medium">
            İtiş mesafesi (cm)
          </label>
          <input
            id="fv-pushoff"
            type="number"
            value={pushOff}
            onChange={(e) => setPushOff(e.target.value)}
            placeholder="çömelme→kalkış AKM yolu, örn. 35"
            className={inputCls}
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Sıçrama koşulları</p>
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="number"
              value={row.load}
              onChange={(e) =>
                setRows(rows.map((r, j) => (j === i ? { ...r, load: e.target.value } : r)))
              }
              aria-label={`Koşul ${i + 1} ek yük (kg)`}
              className={`${inputCls} !w-28`}
            />
            <span className="text-xs text-stone-500">kg ek yük →</span>
            <input
              type="number"
              value={row.height}
              onChange={(e) =>
                setRows(rows.map((r, j) => (j === i ? { ...r, height: e.target.value } : r)))
              }
              aria-label={`Koşul ${i + 1} sıçrama yüksekliği (cm)`}
              placeholder="sıçrama (cm)"
              className={`${inputCls} !w-32`}
            />
            {rows.length > 2 && (
              <button
                type="button"
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
                className="text-xs text-stone-400 hover:text-red-600"
              >
                Kaldır
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => setRows([...rows, { load: "", height: "" }])}
          className="text-sm font-medium text-amber-700 dark:text-amber-500 hover:underline"
        >
          + Koşul ekle
        </button>
      </div>

      <button
        onClick={compute}
        className="btn-primary"
      >
        Profili Analiz Et
      </button>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "F0 (N/kg)", value: result.f0.toFixed(1) },
              { label: "V0 (m/s)", value: result.v0.toFixed(2) },
              { label: "Pmax (W/kg)", value: result.pmax.toFixed(1) },
              { label: "FV dengesizliği", value: `%${result.imbalance.toFixed(0)}` },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-stone-200 dark:border-stone-800 p-3 text-center"
              >
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-xs text-stone-500">{s.label}</p>
              </div>
            ))}
          </div>

          <FvChart result={result} />

          <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 p-4">
            <p className="text-sm font-semibold">
              {ORIENTATION_LABEL[result.orientation]}
            </p>
            <p className="mt-1 text-sm leading-relaxed">{result.recommendation}</p>
            <p className="mt-2 text-xs text-stone-500">
              Sfv = {result.slope.toFixed(2)} · optimal Sfv ={" "}
              {result.slopeOpt.toFixed(2)} N·s/m/kg (90–110% arası dengeli kabul
              edilir)
            </p>
          </div>

          <button
            onClick={handleSave}
            className="rounded-md border border-stone-300 dark:border-stone-700 px-4 py-1.5 text-sm font-medium hover:bg-stone-100 dark:hover:bg-stone-800"
          >
            {saved ? "Kaydedildi ✓" : "Geçmişe kaydet"}
          </button>
        </div>
      )}
    </div>
  );
}
