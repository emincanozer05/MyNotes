import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/translate — body: { text: string }
 * Returns a concise Turkish translation of an (English) article title.
 * Used by the literature page for on-hover title tooltips.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Çeviri için ANTHROPIC_API_KEY gerekli." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    text?: string;
  } | null;
  const text = body?.text?.trim();
  if (!text) {
    return NextResponse.json({ error: "Metin gerekli." }, { status: 400 });
  }

  const client = new Anthropic();
  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system:
        "Sen bilimsel makale başlıklarını Türkçeye çeviren bir çevirmensin. Sana verilen başlığı akıcı, doğal Türkçeye çevir. SADECE çeviriyi döndür; açıklama, tırnak işareti veya ek metin ekleme.",
      messages: [{ role: "user", content: text }],
    });

    const translation = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .trim();

    return NextResponse.json({ translation });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Çeviri hatası: ${error.message}` },
        { status: 502 },
      );
    }
    throw error;
  }
}
