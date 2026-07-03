"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { gradeFlashcard } from "./actions";
import type { Sm2Quality } from "@/lib/sm2";

export interface DeckCard {
  id: string;
  front: string;
  back: string;
  deck: string;
}

const GRADES: { label: string; quality: Sm2Quality; cls: string }[] = [
  { label: "Tekrar", quality: 2, cls: "border-red-300 dark:border-red-900 text-red-600" },
  { label: "Zor", quality: 3, cls: "border-orange-300 dark:border-orange-900 text-orange-600" },
  { label: "İyi", quality: 4, cls: "border-emerald-300 dark:border-emerald-900 text-emerald-600" },
  { label: "Kolay", quality: 5, cls: "border-sky-300 dark:border-sky-900 text-sky-600" },
];

/**
 * AnkiPro-style deck study: pick one of the decks you built, then drill through
 * every card in it (not only cards that are due). Grades still feed SM-2 so the
 * spaced-repetition schedule stays in sync.
 */
export function DeckStudy({ cards }: { cards: DeckCard[] }) {
  const router = useRouter();
  const [activeDeck, setActiveDeck] = useState<string | null>(null);
  const [queue, setQueue] = useState<DeckCard[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [pending, setPending] = useState(false);

  const decks = useMemo(() => {
    const m = new Map<string, DeckCard[]>();
    for (const c of cards) {
      if (!m.has(c.deck)) m.set(c.deck, []);
      m.get(c.deck)!.push(c);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "tr"));
  }, [cards]);

  function startDeck(deck: string, deckCards: DeckCard[]) {
    setActiveDeck(deck);
    setQueue([...deckCards]);
    setTotal(deckCards.length);
    setDone(0);
    setRevealed(false);
  }

  function exit() {
    setActiveDeck(null);
    setQueue([]);
    router.refresh();
  }

  async function grade(quality: Sm2Quality) {
    const current = queue[0];
    if (!current) return;
    setPending(true);
    await gradeFlashcard(current.id, quality);
    setPending(false);
    setRevealed(false);
    setDone((d) => d + 1);
    // Cards graded "Tekrar" come back around later in the session.
    setQueue((q) => (quality < 3 ? [...q.slice(1), current] : q.slice(1)));
  }

  // ---- Deck picker ----
  if (!activeDeck) {
    if (decks.length === 0) {
      return (
        <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500 dark:border-stone-700">
          Henüz deste yok. Aşağıdan kart eklerken bir deste adı verin, sonra
          buradan o desteye çalışın.
        </p>
      );
    }
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {decks.map(([deck, deckCards]) => (
          <div
            key={deck}
            className="glass-card flex items-center justify-between gap-3 rounded-xl p-4"
          >
            <div className="min-w-0">
              <p className="truncate font-bold">📚 {deck}</p>
              <p className="text-xs text-stone-500">{deckCards.length} kart</p>
            </div>
            <button
              onClick={() => startDeck(deck, deckCards)}
              className="btn-gradient shrink-0 rounded-full px-4 py-2 text-xs font-semibold"
            >
              Çalış →
            </button>
          </div>
        ))}
      </div>
    );
  }

  // ---- Study session ----
  const current = queue[0];

  if (!current) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-900 dark:bg-emerald-950">
        <p className="text-lg font-semibold">
          🎉 &ldquo;{activeDeck}&rdquo; destesini bitirdiniz!
        </p>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {done} değerlendirme yapıldı.
        </p>
        <button
          onClick={exit}
          className="mt-4 rounded-full border border-[var(--border)] px-5 py-2 text-sm font-semibold transition-colors hover:bg-stone-500/10"
        >
          ← Destelere dön
        </button>
      </div>
    );
  }

  const progress = total > 0 ? Math.min(100, (done / total) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-stone-500">
        <button
          onClick={exit}
          className="rounded-full border border-[var(--border)] px-3 py-1 font-semibold transition-colors hover:bg-stone-500/10"
        >
          ← {activeDeck}
        </button>
        <span>
          {done} / {total} · kuyrukta {queue.length}
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-500/15">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-rose-500 transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex min-h-56 flex-col justify-center rounded-xl border border-stone-200 bg-white p-8 dark:border-stone-800 dark:bg-stone-950">
        <p className="text-center text-lg font-medium leading-relaxed">
          {current.front}
        </p>
        {revealed && (
          <p className="mt-6 border-t border-dashed border-stone-200 pt-6 text-center text-[15px] leading-relaxed text-stone-700 dark:border-stone-800 dark:text-stone-300">
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
              className={`rounded-md border py-2.5 text-sm font-semibold hover:bg-stone-50 disabled:opacity-50 dark:hover:bg-stone-900 ${g.cls}`}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
