import { createClient } from "@/lib/supabase/server";
import { ReviewDeck } from "./ReviewDeck";
import { DeckStudy, type DeckCard } from "./DeckStudy";
import { createFlashcard, deleteFlashcard } from "./actions";

const inputCls =
  "w-full rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500";

export default async function FlashcardsPage() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [{ data: due }, { data: all }, { data: notes }] = await Promise.all([
    supabase
      .from("flashcards")
      .select("id, front, back")
      .lte("due_at", nowIso)
      .order("due_at")
      .limit(50),
    supabase
      .from("flashcards")
      .select("id, front, back, deck, due_at, interval_days, repetitions")
      .order("deck")
      .order("due_at")
      .limit(500),
    supabase.from("notes").select("id, title").order("title"),
  ]);

  const allCards = all ?? [];
  const studyCards: DeckCard[] = allCards.map((c) => ({
    id: c.id,
    front: c.front,
    back: c.back,
    deck: c.deck ?? "Genel",
  }));

  // Existing deck names, offered as datalist suggestions in the new-card form.
  const deckNames = [...new Set(studyCards.map((c) => c.deck))].sort((a, b) =>
    a.localeCompare(b, "tr"),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          <span className="gradient-text">Flashcard</span>
        </h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Aralıklı tekrar (SM-2): doğru hatırladıkça tekrar aralığı uzar,
          zorlandıkça sıklaşır. Kendi destelerini hazırla ve istediğin desteye
          çalış.
        </p>
      </div>

      {/* ---- Study your decks (AnkiPro-style) ---- */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">
          🎯 Kartlara Çalış{" "}
          <span className="text-sm font-normal text-stone-500">
            (hazırladığın desteler)
          </span>
        </h2>
        <DeckStudy cards={studyCards} />
      </section>

      {/* ---- Due today ---- */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Bugünün tekrarı{" "}
          <span className="text-sm font-normal text-stone-500">
            ({due?.length ?? 0} kart)
          </span>
        </h2>
        <ReviewDeck cards={due ?? []} />
      </section>

      {/* ---- New card ---- */}
      <section className="rounded-lg border border-stone-200 bg-white p-5 dark:border-stone-800 dark:bg-stone-950">
        <h2 className="text-lg font-semibold">Yeni kart</h2>
        <form action={createFlashcard} className="mt-3 space-y-3">
          <div className="space-y-1">
            <label htmlFor="fc-deck" className="text-sm font-medium">
              Deste
            </label>
            <input
              id="fc-deck"
              name="deck"
              list="deck-options"
              placeholder="Örn: Sakatlık Önleme (boşsa 'Genel')"
              className={inputCls}
            />
            <datalist id="deck-options">
              {deckNames.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1">
            <label htmlFor="fc-front" className="text-sm font-medium">
              Ön yüz (soru)
            </label>
            <textarea
              id="fc-front"
              name="front"
              rows={2}
              required
              placeholder="Örn: ACWR'nin 'tatlı nokta' aralığı nedir?"
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="fc-back" className="text-sm font-medium">
              Arka yüz (cevap)
            </label>
            <textarea
              id="fc-back"
              name="back"
              rows={2}
              required
              placeholder="Örn: 0.8–1.3 (Gabbett, 2016)"
              className={inputCls}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="fc-note" className="text-sm font-medium">
              Bağlı not (isteğe bağlı)
            </label>
            <select id="fc-note" name="note_id" className={inputCls}>
              <option value="">—</option>
              {(notes ?? []).map((n) => (
                <option key={n.id} value={n.id}>
                  {n.title}
                </option>
              ))}
            </select>
          </div>
          <button className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
            Kart Ekle
          </button>
        </form>
      </section>

      {/* ---- All cards ---- */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Tüm kartlar{" "}
          <span className="text-sm font-normal text-stone-500">
            ({allCards.length})
          </span>
        </h2>
        {allCards.length > 0 ? (
          <ul className="space-y-2">
            {allCards.map((c) => {
              const dueDate = new Date(c.due_at);
              const isDue = dueDate <= new Date();
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-4 py-2.5 dark:border-stone-800 dark:bg-stone-950"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                        {c.deck ?? "Genel"}
                      </span>
                      <p className="truncate text-sm font-medium">{c.front}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-stone-500">
                      {isDue
                        ? "Tekrarı geldi"
                        : `Sonraki tekrar: ${dueDate.toLocaleDateString("tr-TR")}`}{" "}
                      · aralık {c.interval_days} gün · {c.repetitions} başarılı tekrar
                    </p>
                  </div>
                  <form action={deleteFlashcard}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="text-xs text-stone-400 hover:text-red-600">
                      Sil
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500 dark:border-stone-700">
            Henüz kartınız yok.
          </p>
        )}
      </section>
    </div>
  );
}
