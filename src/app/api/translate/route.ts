import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/translate — body: { text: string, target?: string }
 * Translates English article titles/abstracts to Turkish for the hover
 * tooltip on the literature page. Uses Google's public translate endpoint
 * (no API key). External call is made server-side per project conventions.
 */
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
    target?: string;
  } | null;

  const text = body?.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "Metin gerekli." }, { status: 400 });
  }
  const target = body?.target || "tr";

  try {
    const url =
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(target)}` +
      `&dt=t&q=${encodeURIComponent(text.slice(0, 5000))}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "sc-hub/1.0" },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Çeviri servisi hatası (HTTP ${res.status})` },
        { status: 502 },
      );
    }
    // Response shape: [[["translated","source",...], ...], ...]
    const data = (await res.json()) as [Array<[string, string]>];
    const translated = (data?.[0] ?? [])
      .map((seg) => seg?.[0] ?? "")
      .join("");
    return NextResponse.json({ translated: translated || text });
  } catch {
    return NextResponse.json(
      { error: "Çeviri alınamadı." },
      { status: 502 },
    );
  }
}
