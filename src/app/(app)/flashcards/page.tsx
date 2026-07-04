import { createClient } from "@/lib/supabase/server";
import { ReviewDeck } from "./ReviewDeck";
import { StudyDecks } from "./StudyDecks";
import { createFlashcard, deleteFlashcard } from "./actions";

const inputCls =
  "w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand-1)]";

interface CardRow {
  id: string;
  front: string;
  back: string;
  deck?: string | null;
  due_at: string;
  interval_days: number;
  repetitions: number;
}

export default async function FlashcardsPage() {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  // Select "*" so a missing `deck` column (pre-migration) doesn't error.
  const [{ data: due }, { data: allData }, { data: notes }] = await Promise.all([
    supabase
      .from("flashcards")
      .select("id, front, back")
      .lte("due_at", nowIso)
      .order("due_at")
      .limit(50),
    supabase
      .from("flashcards")
      .select("*")
      .order("due_at")
      .limit(500),
    supabase.from("notes").select("id, title").order("title"),
  ]);

  const all = (allData ?? []) as CardRow[];
  const studyCards = all.map((c) => ({
    id: c.id,
    front: c.front,
    back: c.back,
    deck: c.deck || "Genel",
    due_at: c.due_at,
  }));
  const deckNames = [...new Set(studyCards.map((c) => c.deck))].sort((a, b) =>
    a.localeCompare(b, "tr"),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Flashcard</h1>
        <p className="mt-1.5 text-sm text-[var(--muted)]">
          Aralıklı tekrar (SM-2): doğru hatırladıkça tekrar aralığı uzar,
          zorlandıkça sıklaşır.
        </p>
      </div>

      <section>
        <h2 className="mb-1 text-lg font-semibold">Kartlara çalış</h2>
        <p className="mb-3 text-sm text-[var(--muted)]">
          Bir deste seçin ve AnkiPro gibi hazırladığınız kartların tümüne
          çalışın.
        </p>
        <StudyDecks cards={studyCards} />
      </section>

      <section>
        <h2 className="mb-1 text-lg font-semibold">
          Bugünün tekrarı{" "}
          <span className="text-sm font-normal text-[var(--muted)]">
            ({due?.length ?? 0} kart)
          </span>
        </h2>
        <p className="mb-3 text-sm text-[var(--muted)]">
          Tüm destelerden tekrarı gelen kartlar (SM-2).
        </p>
        <ReviewDeck cards={due ?? []} />
      </section>

      <section className="glass-card rounded-xl p-5">
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
              defaultValue="Genel"
              placeholder="Örn: Enerji Sistemleri, Biyomekanik…"
              className={inputCls}
            />
            <datalist id="deck-options">
              {deckNames.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
            <p className="text-xs text-[var(--muted)]">
              Yeni bir deste adı yazabilir ya da mevcut bir desteyi seçebilirsiniz.
            </p>
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
          <button className="btn-gradient rounded-md px-4 py-2 text-sm font-semibold">
            Kart Ekle
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Tüm kartlar{" "}
          <span className="text-sm font-normal text-[var(--muted)]">
            ({all.length})
          </span>
        </h2>
        {all.length > 0 ? (
          <ul className="space-y-2">
            {all.map((c) => {
              const dueDate = new Date(c.due_at);
              const isDue = dueDate <= new Date();
              return (
                <li
                  key={c.id}
                  className="glass-card flex items-center justify-between gap-3 rounded-lg px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">
                        {c.deck || "Genel"}
                      </span>
                      <p className="truncate text-sm font-medium">{c.front}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
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
          <p className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--muted)]">
            Henüz kartınız yok.
          </p>
        )}
      </section>
    </div>
  );
}
