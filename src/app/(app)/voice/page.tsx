import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { VoiceRecorder } from "./VoiceRecorder";
import { convertToNote, deleteVoiceNote } from "./actions";

interface VoiceRow {
  id: string;
  title: string | null;
  transcript: string;
  note_id: string | null;
  audio_path: string | null;
  created_at: string;
}

export default async function VoicePage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("voice_notes")
    .select("id, title, transcript, note_id, audio_path, created_at")
    .order("created_at", { ascending: false });

  const voiceNotes = (data ?? []) as VoiceRow[];

  // Signed URLs for playback (bucket is private).
  const paths = voiceNotes
    .map((v) => v.audio_path)
    .filter((p): p is string => Boolean(p));
  const signedUrls = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("voice-notes")
      .createSignedUrls(paths, 60 * 60);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) signedUrls.set(s.path, s.signedUrl);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Ses Notu &amp; Transkript
        </h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          Sahada konuşun; ses <b>dosya olarak</b> kaydedilir, konuşma metne
          dönüşür. Her kayda başlık ve tarih eklenir.
        </p>
      </div>

      <VoiceRecorder />

      <section>
        <h2 className="mb-3 text-lg font-semibold">Kayıtlı ses notları</h2>
        {voiceNotes.length > 0 ? (
          <ul className="space-y-3">
            {voiceNotes.map((v) => {
              const url = v.audio_path
                ? signedUrls.get(v.audio_path)
                : undefined;
              return (
                <li
                  key={v.id}
                  className="rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold leading-snug">
                        {v.title?.trim() || "Ses notu"}
                      </h3>
                      <p className="text-xs text-stone-400">
                        {new Date(v.created_at).toLocaleString("tr-TR")}
                      </p>
                    </div>
                  </div>

                  {url && (
                    <audio controls src={url} className="mt-3 w-full" />
                  )}

                  {v.transcript && (
                    <p className="mt-3 text-sm leading-relaxed text-stone-700 dark:text-stone-300">
                      {v.transcript}
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-end gap-3">
                    {v.note_id ? (
                      <Link
                        href={`/notes/${v.note_id}`}
                        className="text-xs font-medium text-amber-700 dark:text-amber-500 hover:underline"
                      >
                        Nota git →
                      </Link>
                    ) : (
                      v.transcript && (
                        <form action={convertToNote}>
                          <input type="hidden" name="id" value={v.id} />
                          <button className="text-xs font-medium text-amber-700 dark:text-amber-500 hover:underline">
                            Nota dönüştür
                          </button>
                        </form>
                      )
                    )}
                    <form action={deleteVoiceNote}>
                      <input type="hidden" name="id" value={v.id} />
                      <button className="text-xs text-stone-400 hover:text-red-600">
                        Sil
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
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
