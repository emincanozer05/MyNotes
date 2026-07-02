/** SM-2 spaced-repetition scheduling (SuperMemo 2). */

export interface Sm2State {
  ease: number;
  interval_days: number;
  repetitions: number;
}

export type Sm2Quality = 0 | 1 | 2 | 3 | 4 | 5;

export function sm2Review(
  state: Sm2State,
  quality: Sm2Quality,
  now: Date = new Date(),
): Sm2State & { due_at: string } {
  let { ease, interval_days: interval, repetitions } = state;

  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) interval = 1;
    else if (repetitions === 2) interval = 6;
    else interval = Math.round(interval * ease);
  }

  ease = Math.max(
    1.3,
    ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );

  const due = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);

  return {
    ease: +ease.toFixed(2),
    interval_days: interval,
    repetitions,
    due_at: due.toISOString(),
  };
}
