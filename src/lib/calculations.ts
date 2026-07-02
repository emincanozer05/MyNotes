/** Pure calculation helpers for the coaching tools. */

const G = 9.81;

// ---------------------------------------------------------------------------
// 1RM estimation
// ---------------------------------------------------------------------------

export function epley1RM(weight: number, reps: number): number {
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

export function brzycki1RM(weight: number, reps: number): number {
  return weight * (36 / (37 - reps));
}

/** Standard training loads as %1RM for prescription tables. */
export function percentTable(oneRm: number): { pct: number; load: number }[] {
  return [95, 90, 85, 80, 75, 70, 65, 60].map((pct) => ({
    pct,
    load: (oneRm * pct) / 100,
  }));
}

// ---------------------------------------------------------------------------
// Karvonen heart-rate zones
// ---------------------------------------------------------------------------

export interface HrZone {
  name: string;
  lowPct: number;
  highPct: number;
  lowBpm: number;
  highBpm: number;
}

export function karvonenTarget(
  hrRest: number,
  hrMax: number,
  intensity: number, // 0..1
): number {
  return Math.round(hrRest + (hrMax - hrRest) * intensity);
}

const ZONE_DEFS = [
  { name: "Z1 — Toparlanma", low: 0.5, high: 0.6 },
  { name: "Z2 — Aerobik dayanıklılık", low: 0.6, high: 0.7 },
  { name: "Z3 — Tempo", low: 0.7, high: 0.8 },
  { name: "Z4 — Laktat eşiği", low: 0.8, high: 0.9 },
  { name: "Z5 — VO₂max / anaerobik", low: 0.9, high: 1.0 },
];

export function karvonenZones(hrRest: number, hrMax: number): HrZone[] {
  return ZONE_DEFS.map((z) => ({
    name: z.name,
    lowPct: z.low * 100,
    highPct: z.high * 100,
    lowBpm: karvonenTarget(hrRest, hrMax, z.low),
    highBpm: karvonenTarget(hrRest, hrMax, z.high),
  }));
}

// ---------------------------------------------------------------------------
// Force-Velocity profile (Samozino jump method)
// ---------------------------------------------------------------------------

export interface FvCondition {
  /** additional load in kg (0 = bodyweight jump) */
  addedLoad: number;
  /** squat-jump height in cm */
  jumpHeightCm: number;
}

export interface FvPoint {
  velocity: number; // mean push-off velocity (m/s)
  force: number; // mean force relative to body mass (N/kg)
}

export interface FvResult {
  points: FvPoint[];
  f0: number; // N/kg — theoretical max force
  v0: number; // m/s — theoretical max velocity
  pmax: number; // W/kg
  slope: number; // Sfv (N·s/m/kg)
  slopeOpt: number; // optimal Sfv for max jump height
  imbalance: number; // % — 100 = balanced
  orientation: "force" | "velocity" | "balanced";
  recommendation: string;
}

/**
 * Computes mean force & velocity per loaded-jump condition (Samozino et al.),
 * fits the linear F-v relationship and compares its slope with the optimal
 * slope that maximizes unloaded jump height at the same Pmax.
 */
export function fvProfileFromJumps(
  bodyMass: number,
  pushOffM: number, // push-off distance in m (crouch→takeoff CoM displacement)
  conditions: FvCondition[],
): FvResult | { error: string } {
  const valid = conditions.filter(
    (c) => c.jumpHeightCm > 0 && c.addedLoad >= 0,
  );
  if (bodyMass <= 0 || pushOffM <= 0)
    return { error: "Vücut ağırlığı ve itiş mesafesi pozitif olmalı." };
  if (valid.length < 2)
    return { error: "En az iki farklı yük koşulu (örn. 0 kg ve +20 kg) girin." };

  const points: FvPoint[] = valid.map((c) => {
    const h = c.jumpHeightCm / 100;
    const totalMass = bodyMass + c.addedLoad;
    // mean push-off velocity = takeoff velocity / 2
    const velocity = Math.sqrt((G * h) / 2);
    // mean force during push-off, relative to body mass
    const force = (totalMass * G * (h / pushOffM + 1)) / bodyMass;
    return { velocity, force };
  });

  // least-squares fit: force = f0 + slope * velocity
  const n = points.length;
  const sx = points.reduce((s, p) => s + p.velocity, 0);
  const sy = points.reduce((s, p) => s + p.force, 0);
  const sxx = points.reduce((s, p) => s + p.velocity * p.velocity, 0);
  const sxy = points.reduce((s, p) => s + p.velocity * p.force, 0);
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-9)
    return { error: "Koşullar birbirinden yeterince farklı değil (aynı hız)." };

  const slope = (n * sxy - sx * sy) / denom;
  const f0 = (sy - slope * sx) / n;
  if (slope >= 0 || f0 <= G)
    return {
      error:
        "Veriler geçerli bir F-V doğrusu üretmedi. Yük arttıkça sıçrama yüksekliği düşmeli.",
    };

  const v0 = -f0 / slope;
  const pmax = (f0 * v0) / 4;

  const slopeOpt = optimalSlope(pmax, pushOffM);
  const imbalance = (slope / slopeOpt) * 100;

  let orientation: FvResult["orientation"];
  let recommendation: string;
  if (imbalance > 110) {
    orientation = "force";
    recommendation =
      "Profil kuvvet baskın: hız üretimi görece zayıf. Balistik/pliometrik sıçramalar, düşük yükte yüksek hızlı çalışmalar (yüksüz CMJ, band-assisted jump, hafif yük VBT) önceliklendirilmeli.";
  } else if (imbalance < 90) {
    orientation = "velocity";
    recommendation =
      "Profil hız baskın: maksimal kuvvet görece zayıf. Ağır yüklü çalışmalar (squat/deadlift %80+ 1RM, ağır sled itişleri) ile F0 geliştirilmeli.";
  } else {
    orientation = "balanced";
    recommendation =
      "Profil dengeli: mevcut F-V eğimi teorik optimuma yakın. Karma (kuvvet + hız) yüklemeyle Pmax'ı büyütmeye odaklanın.";
  }

  return { points, f0, v0, pmax, slope, slopeOpt, imbalance, orientation, recommendation };
}

/**
 * Finds the F-v slope that maximizes theoretical squat-jump height for a
 * fixed relative Pmax and push-off distance (grid search over the model:
 * 4v̄² − 2·hpo·S·v̄ − 2·hpo·(F0 − g) = 0, h = 2v̄²/g, F0 = √(−4·Pmax·S)).
 */
function optimalSlope(pmax: number, pushOffM: number): number {
  let bestS = -1;
  let bestH = -Infinity;
  for (let s = -60; s <= -0.5; s += 0.05) {
    const f0 = Math.sqrt(-4 * pmax * s);
    if (f0 <= G) continue;
    const disc = 4 * pushOffM * pushOffM * s * s + 32 * pushOffM * (f0 - G);
    if (disc < 0) continue;
    const vMean = (2 * pushOffM * s + Math.sqrt(disc)) / 8;
    if (vMean <= 0) continue;
    const h = (2 * vMean * vMean) / G;
    if (h > bestH) {
      bestH = h;
      bestS = s;
    }
  }
  return bestS;
}
