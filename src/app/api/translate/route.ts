import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/translate
 * - body: { text: string, target?: string } → { translated }
 *   Single-text mode (literature title/abstract tooltips).
 * - body: { texts: string[], target?: string } → { translations: string[] }
 *   Batch mode for the editor's in-place "Eng" view: each item is one DOM
 *   text node, so the caller can rebuild the note with its original layout
 *   and formatting, only the words swapped to the target language.
 * Uses Google's public translate endpoint (no API key). External call is
 * made server-side per project conventions.
 */

const MAX_ITEMS = 400;
const MAX_ITEM_CHARS = 3000;
const BATCH_CHARS = 3800;

async function googleTranslate(q: string, target: string): Promise<string | null> {
  try {
    const url =
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(target)}` +
      `&dt=t&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { "User-Agent": "sc-hub/1.0" } });
    if (!res.ok) return null;
    // Response shape: [[["translated","source",...], ...], ...]
    const data = (await res.json()) as [Array<[string, string]>];
    return (data?.[0] ?? []).map((seg) => seg?.[0] ?? "").join("");
  } catch {
    return null;
  }
}

/** Translates a batch keeping 1:1 alignment via newline separators; falls
 *  back to per-item calls when the alignment doesn't survive. */
async function translateAligned(texts: string[], target: string): Promise<string[]> {
  const joined = texts.join("\n");
  const res = await googleTranslate(joined, target);
  if (res !== null) {
    const parts = res.split("\n");
    if (parts.length === texts.length) return parts.map((p) => p.trim());
  }
  const out: string[] = [];
  for (const t of texts) {
    const one = await googleTranslate(t, target);
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

  const translated = await googleTranslate(text.slice(0, 5000), target);
  if (translated === null) {
    return NextResponse.json({ error: "Çeviri alınamadı." }, { status: 502 });
  }
  return NextResponse.json({ translated: translated || text });
}
