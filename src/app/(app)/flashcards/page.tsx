import { createClient } from "@/lib/supabase/server";
import { ReviewDeck } from "./ReviewDeck";
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
      .select("id, front, due_at, interval_days, repetitions")
      .order("due_at")
      .limit(200),
    supabase.from("notes").select("id, title").order("title"),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Flashcard</h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Aralıklı tekrar (SM-2): doğru hatırladıkça tekrar aralığı uzar,
          zorlandıkça sıklaşır.
        </p>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Bugünün tekrarı{" "}
          <span className="text-sm font-normal text-stone-500">
            ({due?.length ?? 0} kart)
          </span>
        </h2>
        <ReviewDeck cards={due ?? []} />
      </section>

      <section className="rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 p-5">
        <h2 className="text-lg font-semibold">Yeni kart</h2>
        <form action={createFlashcard} className="mt-3 space-y-3">
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

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Tüm kartlar{" "}
          <span className="text-sm font-normal text-stone-500">
            ({all?.length ?? 0})
          </span>
        </h2>
        {all && all.length > 0 ? (
          <ul className="space-y-2">
            {all.map((c) => {
              const dueDate = new Date(c.due_at);
              const isDue = dueDate <= new Date();
              return (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{c.front}</p>
                    <p className="text-xs text-stone-500">
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
          <p className="rounded-lg border border-dashed border-stone-300 dark:border-stone-700 p-6 text-center text-sm text-stone-500">
            Henüz kartınız yok.
          </p>
        )}
      </section>
    </div>
  );
}
