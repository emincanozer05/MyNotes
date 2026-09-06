import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

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
  const google = await googleTranslate(text.slice(0, 5000), target);
  if (google !== null) return google;
  const mymemory = await myMemoryTranslate(text, target);
  if (mymemory !== null) return mymemory;
  const claude = await claudeTranslate([text], target);
  return claude?.[0] ?? null;
}

/** Translates a batch keeping 1:1 alignment via newline separators; falls
 *  back to Claude (also aligned) and then to per-item calls. */
async function translateAligned(texts: string[], target: string): Promise<string[]> {
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
