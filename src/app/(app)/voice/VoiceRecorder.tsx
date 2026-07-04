"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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

function defaultTitle() {
  return `Ses notu — ${new Date().toLocaleDateString("tr-TR")}`;
}

export function VoiceRecorder() {
  const router = useRouter();
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const canRecord = useSyncExternalStore(
    () => () => {},
    () =>
      typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof MediaRecorder !== "undefined",
    () => true,
  );

  const [recording, setRecording] = useState(false);
  const [title, setTitle] = useState("");
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    // Reset any previous take.
    setFinalText("");
    setInterimText("");
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);

    // Audio recording (MediaRecorder)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      recorder.start();
      recorderRef.current = recorder;
    } catch {
      setError("Mikrofona erişilemedi. İzin verdiğinizden emin olun.");
      return;
    }

    // Live transcript (Web Speech API) — optional; may be unsupported.
    const recognition = getRecognition();
    if (recognition) {
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
      recognition.onerror = () => {};
      recognition.onend = () => {};
      recognitionRef.current = recognition;
      try {
        recognition.start();
      } catch {
        /* already started / unsupported */
      }
    }

    setRecording(true);
  }

  function stop() {
    recorderRef.current?.stop();
    recognitionRef.current?.stop();
    setRecording(false);
    setInterimText("");
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      let audioPath: string | null = null;

      if (audioBlob) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setError("Oturum bulunamadı.");
          setSaving(false);
          return;
        }
        const path = `${user.id}/${crypto.randomUUID()}.webm`;
        const { error: upErr } = await supabase.storage
          .from("voice-notes")
          .upload(path, audioBlob, { contentType: "audio/webm" });
        if (upErr) {
          setError(`Ses yüklenemedi: ${upErr.message}`);
          setSaving(false);
          return;
        }
        audioPath = path;
      }

      const res = await saveVoiceNote(
        finalText,
        title.trim() || defaultTitle(),
        audioPath,
      );
      if (res?.error) {
        setError(res.error);
      } else {
        setFinalText("");
        setTitle("");
        setAudioBlob(null);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  const hasSomething = Boolean(audioBlob) || Boolean(finalText.trim());

  return (
    <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 p-5 space-y-4">
      <div className="space-y-1">
        <label htmlFor="voice-title" className="text-sm font-medium">
          Başlık
        </label>
        <input
          id="voice-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={defaultTitle()}
          className="w-full rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {!recording ? (
          <button
            onClick={start}
            disabled={!canRecord}
            className="rounded-md bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
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
          <span className="text-sm text-stone-500">● Kaydediliyor…</span>
        )}
      </div>

      {!canRecord && (
        <p className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950 p-3 text-xs">
          Tarayıcınız ses kaydını desteklemiyor; transkripti aşağıya elle
          yazabilirsiniz.
        </p>
      )}

      {audioUrl && (
        <div className="space-y-1">
          <label className="text-sm font-medium">Kayıt önizleme</label>
          <audio controls src={audioUrl} className="w-full" />
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor="transcript" className="text-sm font-medium">
          Transkript{" "}
          <span className="font-normal text-stone-400">(otomatik / elle)</span>
        </label>
        <textarea
          id="transcript"
          rows={5}
          value={finalText + (interimText ? ` ${interimText}` : "")}
          onChange={(e) => setFinalText(e.target.value)}
          placeholder="Konuşmanız burada metne dönüşür; elle de düzenleyebilirsiniz."
          className="w-full rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        onClick={save}
        disabled={saving || recording || !hasSomething}
        className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {saving ? "Kaydediliyor…" : "Ses Notunu Kaydet"}
      </button>
    </div>
  );
}
