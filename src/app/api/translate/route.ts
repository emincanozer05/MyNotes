import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { geminiKey, geminiModel } from "@/lib/gemini";

/**
 * POST /api/translate
 * - body: { text: string, target?: string } → { translated }
 *   Single-text mode (literature title/abstract tooltips).
 * - body: { texts: string[], target?: string } → { translations: string[] }
 *   Batch mode for the editor's in-place "Eng" view: each item is one DOM
 *   text node, so the caller can rebuild the note with its original layout
 *   and formatting, only the words swapped to the target language.
 *
 * Providers are tried in order and the first one that answers wins:
 *   0. Google Gemini (GEMINI_API_KEY / GOOGLE_API_KEY, model via GEMINI_MODEL) —
 *      context-aware, so sentences keep their meaning. Skipped without a key.
 *   1. Google's key-free endpoint (fast, free) — but it answers 429 to
 *      datacenter IPs, which is what silently broke title translations.
 *   2. MyMemory's key-free API — modest limits, good enough for titles.
 *   3. The Anthropic API (ANTHROPIC_API_KEY) — always available when the key
 *      is configured, and the most accurate on scientific titles.
 * External calls are made server-side per project conventions.
 */

const MAX_ITEMS = 400;
const MAX_ITEM_CHARS = 3000;
const BATCH_CHARS = 3800;
const MYMEMORY_MAX_CHARS = 480;
const CLAUDE_MODEL = "claude-opus-4-8";

const LANGUAGE_NAMES: Record<string, string> = {
  tr: "Turkish",
  en: "English",
};

/** Google's undocumented gtx endpoint. Returns null on any failure so the
 *  caller can move on to the next provider. */
async function googleTranslate(q: string, target: string): Promise<string | null> {
  try {
    const url =
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(target)}` +
      `&dt=t&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { "User-Agent": "sc-hub/1.0" } });
    if (!res.ok) return null;
    // Response shape: [[["translated","source",...], ...], ...]
    const data = (await res.json()) as [Array<[string, string]>];
    const out = (data?.[0] ?? []).map((seg) => seg?.[0] ?? "").join("");
    return out.trim() ? out : null;
  } catch {
    return null;
  }
}

/** MyMemory — key-free, but one short text per call. */
async function myMemoryTranslate(
  q: string,
  target: string,
): Promise<string | null> {
  if (q.length > MYMEMORY_MAX_CHARS) return null;
  try {
    const url =
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}` +
      `&langpair=${encodeURIComponent(`en|${target}`)}`;
    const res = await fetch(url, { headers: { "User-Agent": "sc-hub/1.0" } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      responseStatus?: number | string;
      responseData?: { translatedText?: string };
    };
    if (Number(data.responseStatus) !== 200) return null;
    const out = data.responseData?.translatedText ?? "";
    // MyMemory reports quota problems inside the translated text itself.
    if (!out.trim() || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(out)) {
      return null;
    }
    return out;
  } catch {
    return null;
  }
}

/** Google Gemini — context-aware batch translation with strict 1:1 alignment.
 *  Null when no key is configured or the call fails, so the caller falls back. */
async function geminiTranslate(
  texts: string[],
  target: string,
): Promise<string[] | null> {
  const key = geminiKey();
  if (!key || texts.length === 0) return null;
  const language = LANGUAGE_NAMES[target] ?? target;
  const model = geminiModel();
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text:
                  `You are a translation engine for a strength & conditioning / sports-science study platform. ` +
                  `Translate every item of the JSON array you receive into natural, fluent ${language}. ` +
                  "Translate by meaning, not word by word: each item is a full sentence or passage, so keep its logic intact. " +
                  "Keep established scientific terminology and abbreviations (e.g. RPE, 1RM, RIR) as they are used in the field. " +
                  "Rejoin words split by end-of-line hyphens. Do not add commentary, notes or quotes. " +
                  "Return a JSON array of strings with exactly the same number of items, in the same order.",
              },
            ],
          },
          contents: [{ role: "user", parts: [{ text: JSON.stringify(texts) }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192,
            responseMimeType: "application/json",
            responseSchema: { type: "ARRAY", items: { type: "STRING" } },
            // 2.5 Flash "thinks" by default, which only adds latency here.
            ...(/2\.5-flash/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        }),
        signal: AbortSignal.timeout(45_000),
      },
    );
    if (!res.ok) {
      console.warn(`[translate] Gemini HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const raw = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== texts.length) return null;
    return parsed.map((t, i) => (typeof t === "string" && t.trim() ? t : texts[i]));
  } catch (e) {
    console.warn("[translate] Gemini failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Anthropic API — batch translation with strict 1:1 alignment, used as the
 *  dependable fallback when the key-free endpoints refuse. */
async function claudeTranslate(
  texts: string[],
  target: string,
): Promise<string[] | null> {
  if (!process.env.ANTHROPIC_API_KEY || texts.length === 0) return null;
  const language = LANGUAGE_NAMES[target] ?? target;
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      system:
        `You are a translation engine for a sports-science library. Translate each input item into ${language}. ` +
        "The items are scientific article titles, abstracts, and note fragments: keep the meaning exact, " +
        "keep established scientific terminology, and do not add commentary. " +
        "Reply with ONLY a JSON array of strings — one translated string per input item, in the same order, " +
        "with exactly the same number of items. No markdown, no code fences.",
      messages: [
        {
          role: "user",
          content: JSON.stringify(texts),
        },
      ],
    });
    const raw = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("")
      .trim()
      // Tolerate a stray code fence around the JSON.
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== texts.length) return null;
    return parsed.map((t, i) => (typeof t === "string" && t.trim() ? t : texts[i]));
  } catch {
    return null;
  }
}

/** One text through the provider chain; null only when every provider fails. */
async function translateOne(
  text: string,
  target: string,
): Promise<string | null> {
  const gemini = await geminiTranslate([text.slice(0, 5000)], target);
  if (gemini) return gemini[0];
  const google = await googleTranslate(text.slice(0, 5000), target);
  if (google !== null) return google;
  const mymemory = await myMemoryTranslate(text, target);
  if (mymemory !== null) return mymemory;
  const claude = await claudeTranslate([text], target);
  return claude?.[0] ?? null;
}

/** Translates a batch keeping 1:1 alignment: Gemini first, then newline-joined
 *  Google, then Claude (also aligned), then per-item calls. */
async function translateAligned(texts: string[], target: string): Promise<string[]> {
  const viaGemini = await geminiTranslate(texts, target);
  if (viaGemini) return viaGemini.map((p) => p.trim());

  const joined = texts.join("\n");
  const res = await googleTranslate(joined, target);
  if (res !== null) {
    const parts = res.split("\n");
    if (parts.length === texts.length) return parts.map((p) => p.trim());
  }

  // One Claude call keeps the whole batch aligned without N round trips.
  const viaClaude = await claudeTranslate(texts, target);
  if (viaClaude) return viaClaude.map((p) => p.trim());

  const out: string[] = [];
  for (const t of texts) {
    const one = await translateOne(t, target);
    out.push(one?.trim() || t);
  }
  return out;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    text?: string;
    texts?: string[];
    target?: string;
  } | null;
  const target = body?.target || "tr";

  // ---- Batch mode (formatted in-place translation) ----------------------
  if (Array.isArray(body?.texts)) {
    // Newlines inside an item would break the 1:1 alignment; flatten them.
    const items = body.texts
      .slice(0, MAX_ITEMS)
      .map((t) => String(t ?? "").replace(/\s*\n\s*/g, " ").slice(0, MAX_ITEM_CHARS));

    // Greedily pack items into batches so each upstream URL stays small.
    const translations: string[] = [];
    let batch: string[] = [];
    let batchLen = 0;
    const flush = async () => {
      if (batch.length === 0) return;
      translations.push(...(await translateAligned(batch, target)));
      batch = [];
      batchLen = 0;
    };
    for (const item of items) {
      if (!item.trim()) {
        // Keep placeholders aligned without spending a translation on them.
        await flush();
        translations.push(item);
        continue;
      }
      if (batchLen + item.length + 1 > BATCH_CHARS) await flush();
      batch.push(item);
      batchLen += item.length + 1;
    }
    await flush();

    return NextResponse.json({ translations });
  }

  // ---- Single-text mode --------------------------------------------------
  const text = body?.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "Metin gerekli." }, { status: 400 });
  }

  const translated = await translateOne(text, target);
  if (translated === null) {
    return NextResponse.json({ error: "Çeviri alınamadı." }, { status: 502 });
  }
  return NextResponse.json({ translated: translated || text });
}
