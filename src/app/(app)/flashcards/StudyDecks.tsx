"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { gradeFlashcard, deleteFlashcardById } from "./actions";
import type { Sm2Quality } from "@/lib/sm2";

interface Card {
  id: string;
  front: string;
  back: string;
  deck: string;
  due_at: string;
}

const GRADES: { label: string; quality: Sm2Quality; cls: string }[] = [
  { label: "Tekrar", quality: 2, cls: "border-red-300 dark:border-red-900 text-red-600" },
  { label: "Zor", quality: 3, cls: "border-orange-300 dark:border-orange-900 text-orange-600" },
  { label: "İyi", quality: 4, cls: "border-emerald-300 dark:border-emerald-900 text-emerald-600" },
  { label: "Kolay", quality: 5, cls: "border-sky-300 dark:border-sky-900 text-sky-600" },
];

const DECK_COLORS = [
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-teal-600",
  "from-sky-500 to-indigo-600",
  "from-rose-500 to-pink-600",
  "from-violet-500 to-fuchsia-600",
];
function deckColor(name: string) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return DECK_COLORS[h % DECK_COLORS.length];
}

/** AnkiPro-style deck study: pick a deck and cram through all its cards. */
export function StudyDecks({ cards }: { cards: Card[] }) {
  const router = useRouter();
  const [activeDeck, setActiveDeck] = useState<string | null>(null);

  // Session state (only used while a deck is active).
  const [queue, setQueue] = useState<Card[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(0);
  const [pending, setPending] = useState(false);

  const decks = useMemo(() => {
    const now = new Date();
    const m = new Map<string, { total: number; due: number }>();
    for (const c of cards) {
      const name = c.deck || "Genel";
      const entry = m.get(name) ?? { total: 0, due: 0 };
      entry.total += 1;
      if (new Date(c.due_at) <= now) entry.due += 1;
      m.set(name, entry);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "tr"));
  }, [cards]);

  function startDeck(name: string) {
    const deckCards = cards.filter((c) => (c.deck || "Genel") === name);
    setActiveDeck(name);
    setQueue(deckCards);
    setRevealed(false);
    setDone(0);
  }

  function exitDeck() {
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
    // Failed cards loop back to the end of the session for another pass.
    setQueue((q) => (quality < 3 ? [...q.slice(1), current] : q.slice(1)));
  }

  async function removeCurrent() {
    const current = queue[0];
    if (!current) return;
    if (!window.confirm("Bu kart destenizden silinsin mi?")) return;
    setPending(true);
    await deleteFlashcardById(current.id);
    setPending(false);
    setRevealed(false);
    // Drop every instance of this card from the session queue.
    setQueue((q) => q.filter((c) => c.id !== current.id));
  }

  const current = queue[0];

  return (
    <>
      {/* ---- Deck list ("Kartlara çalış") ---- */}
      {decks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 dark:border-stone-700 p-6 text-center text-sm text-stone-500">
          Henüz desteniz yok. Aşağıdan kart ekleyin — kartlar seçtiğiniz desteye
          eklenir.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map(([name, info]) => (
            <button
              key={name}
              onClick={() => startDeck(name)}
              className="glass-card group relative overflow-hidden rounded-2xl p-4 text-left"
            >
              <div
                className={`absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${deckColor(name)} opacity-20 blur-xl transition-opacity group-hover:opacity-40`}
              />
              <p className="font-bold">{name}</p>
              <p className="mt-1 text-xs text-stone-500">
                {info.total} kart
                {info.due > 0 && (
                  <span className="ml-1 font-semibold text-amber-600 dark:text-amber-400">
                    · {info.due} tekrarı geldi
                  </span>
                )}
              </p>
              <span
                className={`mt-3 inline-block rounded-full bg-gradient-to-r ${deckColor(name)} px-3 py-1 text-xs font-semibold text-white`}
              >
                ▶ Çalış
              </span>
            </button>
          ))}
        </div>
      )}

      {/* ---- Active study session (centered modal, blurred backdrop) ---- */}
      <Modal open={activeDeck !== null} onClose={exitDeck} maxWidth="max-w-xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">{activeDeck}</p>
            <p className="text-xs text-stone-500">
              Kuyrukta {queue.length} kart · bu oturumda {done} değerlendirme
            </p>
          </div>
          <button
            onClick={exitDeck}
            className="rounded-full border border-[var(--border)] px-4 py-1.5 text-xs font-semibold transition-colors hover:bg-stone-500/10"
          >
            ✕ Bitir
          </button>
        </div>

        {current ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 p-8">
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

            <div className="flex justify-center">
              <button
                onClick={removeCurrent}
                disabled={pending}
                className="text-xs font-medium text-stone-400 transition-colors hover:text-rose-500 disabled:opacity-50"
              >
                🗑 Bu kartı desteden sil
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950 p-8 text-center">
            <p className="font-semibold">
              🎉 &quot;{activeDeck}&quot; destesi bitti — {done} değerlendirme.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              {activeDeck && (
                <button
                  onClick={() => startDeck(activeDeck)}
                  className="rounded-full bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  Baştan çalış
                </button>
              )}
              <button
                onClick={exitDeck}
                className="rounded-full border border-[var(--border)] px-5 py-2 text-sm font-semibold transition-colors hover:bg-stone-500/10"
              >
                Destelere dön
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
