import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { VoiceRecorder } from "./VoiceRecorder";
import { convertToNote, deleteVoiceNote } from "./actions";

export default async function VoicePage() {
  const supabase = await createClient();
  const { data: voiceNotes } = await supabase
    .from("voice_notes")
    .select("id, transcript, note_id, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ses Notu &amp; Transkript</h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Sahada veya antrenmanda konuşun; kayıt anında metne dönüşür ve tek
          tıkla kaynaklı bir nota çevrilir.
        </p>
      </div>

      <VoiceRecorder />

      <section>
        <h2 className="mb-3 text-lg font-semibold">Kayıtlı transkriptler</h2>
        {voiceNotes && voiceNotes.length > 0 ? (
          <ul className="space-y-3">
            {voiceNotes.map((v) => (
              <li
                key={v.id}
                className="card p-4"
              >
                <p className="text-sm leading-relaxed">{v.transcript}</p>
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-xs text-stone-400">
                    {new Date(v.created_at).toLocaleString("tr-TR")}
                  </p>
                  <div className="flex items-center gap-3">
                    {v.note_id ? (
                      <Link
                        href={`/notes/${v.note_id}`}
                        className="text-xs font-medium text-amber-700 dark:text-amber-500 hover:underline"
                      >
                        Nota git →
                      </Link>
                    ) : (
                      <form action={convertToNote}>
                        <input type="hidden" name="id" value={v.id} />
                        <button className="text-xs font-medium text-amber-700 dark:text-amber-500 hover:underline">
                          Nota dönüştür
                        </button>
                      </form>
                    )}
                    <form action={deleteVoiceNote}>
                      <input type="hidden" name="id" value={v.id} />
                      <button className="text-xs text-stone-400 hover:text-red-600">
                        Sil
                      </button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed border-stone-300 dark:border-stone-700 p-6 text-center text-sm text-stone-500">
            Henüz ses notunuz yok.
          </p>
        )}
      </section>
    </div>
  );
}
