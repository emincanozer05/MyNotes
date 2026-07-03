"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { saveVoiceNote } from "./actions";

// Minimal typings for the Web Speech API (not in lib.dom for all targets)
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}

function getRecognition(): SpeechRecognitionLike | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function VoiceRecorder() {
  const router = useRouter();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const supported = useSyncExternalStore(
    () => () => {},
    () => Boolean(getRecognition()),
    () => true, // assume support during SSR; resolved on the client
  );
  const [recording, setRecording] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function start() {
    const recognition = getRecognition();
    if (!recognition) return;

    recognition.lang = "tr-TR";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          setFinalText((prev) => `${prev}${result[0].transcript} `);
        } else {
          interim += result[0].transcript;
        }
      }
      setInterimText(interim);
    };
    recognition.onerror = (e) => {
      setError(
        e.error === "not-allowed"
          ? "Mikrofon izni verilmedi."
          : `Tanıma hatası: ${e.error}`,
      );
      setRecording(false);
    };
    recognition.onend = () => setRecording(false);

    recognitionRef.current = recognition;
    setError(null);
    recognition.start();
    setRecording(true);
  }

  function stop() {
    recognitionRef.current?.stop();
    setRecording(false);
    setInterimText("");
  }

  async function save() {
    setSaving(true);
    const res = await saveVoiceNote(finalText);
    setSaving(false);
    if (res?.error) {
      setError(res.error);
    } else {
      setFinalText("");
      router.refresh();
    }
  }

  if (!supported) {
    return (
      <p className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 p-4 text-sm">
        Tarayıcınız konuşma tanımayı desteklemiyor. Chrome veya Edge kullanın;
        transkripti aşağıya elle de yazabilirsiniz.
      </p>
    );
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center gap-3">
        {!recording ? (
          <button
            onClick={start}
            className="rounded-md bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
          >
            ● Kayda Başla
          </button>
        ) : (
          <button
            onClick={stop}
            className="animate-pulse rounded-md bg-stone-800 dark:bg-stone-200 px-5 py-2.5 text-sm font-semibold text-white dark:text-stone-900"
          >
            ■ Durdur
          </button>
        )}
        {recording && (
          <span className="text-sm text-stone-500">Dinleniyor… (tr-TR)</span>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="transcript" className="text-sm font-medium">
          Transkript
        </label>
        <textarea
          id="transcript"
          rows={6}
          value={finalText + (interimText ? ` ${interimText}` : "")}
          onChange={(e) => setFinalText(e.target.value)}
          placeholder="Konuşmanız burada metne dönüşecek; elle düzenleyebilirsiniz."
          className="w-full rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        onClick={save}
        disabled={saving || !finalText.trim()}
        className="btn-primary disabled:opacity-50"
      >
        {saving ? "Kaydediliyor…" : "Ses Notunu Kaydet"}
      </button>
    </div>
  );
}
