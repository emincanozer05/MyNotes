import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

const AUDIENCE_PROMPTS: Record<string, string> = {
  athlete:
    "Bir sporcuya anlatıyormuşsun gibi sadeleştir: teknik jargonu günlük dile çevir, sahadan somut örnekler ver, 'senin antrenmanında bu şu demek' diliyle yaz.",
  "assistant-coach":
    "Bir asistan antrenöre anlatıyormuşsun gibi aktar: temel terminolojiyi koru ama pratik uygulamaya çevir; antrenman planlamasında nasıl kullanacağını, nelere dikkat edeceğini maddeler halinde ver.",
  "social-media":
    "Bilgiyi sosyal medya içeriğine dönüştür: dikkat çekici bir giriş cümlesi, 3-5 kısa ve vurucu madde, bir pratik çıkarım ve 3-5 uygun hashtag ile Instagram/X gönderisi formatında yaz.",
};

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
      {
        error:
          "Feynman modu için ANTHROPIC_API_KEY gerekli. .env.local dosyanıza Anthropic API anahtarınızı ekleyin.",
      },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    noteId?: string;
    audience?: string;
  } | null;

  const audiencePrompt = AUDIENCE_PROMPTS[body?.audience ?? ""];
  if (!body?.noteId || !audiencePrompt) {
    return NextResponse.json(
      { error: "noteId ve geçerli bir audience gerekli." },
      { status: 400 },
    );
  }

  const { data: note } = await supabase
    .from("notes")
    .select("title, content, source_title, source_author, source_year")
    .eq("id", body.noteId)
    .maybeSingle();

  if (!note) {
    return NextResponse.json({ error: "Not bulunamadı." }, { status: 404 });
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 2048,
      thinking: { type: "adaptive" },
      system:
        "Sen deneyimli bir Kuvvet & Kondisyon antrenörüsün. Sana akademik bir not verilecek; görevin bu bilgiyi hedef kitleye uygun şekilde, bilimsel doğruluğu koruyarak Türkçe sadeleştirmek. Kaynağa saygı göster ama akademik dil kullanma.",
      messages: [
        {
          role: "user",
          content: `${audiencePrompt}\n\nNot başlığı: ${note.title}\nKaynak: ${note.source_author}${note.source_year ? ` (${note.source_year})` : ""} — ${note.source_title}\n\nNot içeriği:\n${note.content}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "İçerik güvenlik nedeniyle işlenemedi." },
        { status: 422 },
      );
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return NextResponse.json({ text });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json(
        { error: "Anthropic API anahtarı geçersiz." },
        { status: 503 },
      );
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "API limiti aşıldı, biraz sonra tekrar deneyin." },
        { status: 429 },
      );
    }
    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Anthropic API hatası: ${error.message}` },
        { status: 502 },
      );
    }
    throw error;
  }
}
