"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { gradeFlashcard } from "./actions";
import type { Sm2Quality } from "@/lib/sm2";

interface Card {
  id: string;
  front: string;
  back: string;
}

const GRADES: { label: string; quality: Sm2Quality; cls: string }[] = [
  { label: "Tekrar", quality: 2, cls: "border-red-300 dark:border-red-900 text-red-600" },
  { label: "Zor", quality: 3, cls: "border-orange-300 dark:border-orange-900 text-orange-600" },
  { label: "İyi", quality: 4, cls: "border-emerald-300 dark:border-emerald-900 text-emerald-600" },
  { label: "Kolay", quality: 5, cls: "border-sky-300 dark:border-sky-900 text-sky-600" },
];

export function ReviewDeck({ cards }: { cards: Card[] }) {
  const router = useRouter();
  const [queue, setQueue] = useState(cards);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);
  const [pending, setPending] = useState(false);

  const current = queue[0];

  if (!current) {
    return (
      <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950 p-8 text-center">
        <p className="font-semibold">
          {done > 0 ? `Tebrikler — ${done} kartı tamamladınız! 🎉` : "Bugün tekrarı gelen kart yok."}
        </p>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          SM-2 algoritması bir sonraki tekrar tarihlerini otomatik planlar.
        </p>
      </div>
    );
  }

  async function grade(quality: Sm2Quality) {
    setPending(true);
    const res = await gradeFlashcard(current.id, quality);
    setPending(false);
    setRevealed(false);
    setDone((d) => d + 1);
    // failed cards go to the back of today's queue for another pass
    setQueue((q) =>
      quality < 3 ? [...q.slice(1), current] : q.slice(1),
    );
    if (res?.error) console.error(res.error);
    if (queue.length === 1 && quality >= 3) router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-stone-500">
        Kuyrukta {queue.length} kart · bu oturumda {done} değerlendirme
      </p>
      <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 p-8">
        <p className="text-center text-lg font-medium leading-relaxed">
          {current.front}
        </p>
        {revealed && (
          <p className="mt-6 border-t border-dashed border-stone-200 dark:border-stone-800 pt-6 text-center text-[15px] leading-relaxed text-stone-700 dark:text-stone-300">
            {current.back}
          </p>
        )}
      </div>

      {!revealed ? (
        <button
          onClick={() => setRevealed(true)}
          className="w-full rounded-md bg-amber-600 py-2.5 text-sm font-semibold text-white hover:bg-amber-700"
        >
          Cevabı Göster
        </button>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {GRADES.map((g) => (
            <button
              key={g.label}
              disabled={pending}
              onClick={() => grade(g.quality)}
              className={`rounded-md border py-2.5 text-sm font-semibold hover:bg-stone-50 dark:hover:bg-stone-900 disabled:opacity-50 ${g.cls}`}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
