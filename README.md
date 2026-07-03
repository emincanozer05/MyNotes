# S&C Hub — Kuvvet & Kondisyon Bilgi Platformu

Kuvvet & Kondisyon antrenörleri için akademik literatür takibi, bilimsel not
alma, veri analitiği ve koçluk araçlarını bir araya getiren web uygulaması.

## Teknoloji Yığını

| Katman | Teknoloji |
| --- | --- |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| Backend / DB | Supabase (PostgreSQL + Auth + RLS + Storage) |
| Dış API'ler | CrossRef (DOI), NCBI E-utilities (PubMed), Anthropic Claude API |

Tüm veriler Supabase'de kullanıcıya izole (RLS) şekilde saklanır — `localStorage`
kullanılmaz; kütüphaneniz tüm cihazlarınızda senkronizedir.

## Kurulum

1. [supabase.com](https://supabase.com) üzerinde ücretsiz bir proje oluşturun.
2. Proje panelinde **SQL Editor**'ü açıp `supabase/migrations/0001_initial_schema.sql`
   dosyasının içeriğini çalıştırın.
3. `.env.example` dosyasını `.env.local` olarak kopyalayın ve
   **Project Settings → API** sayfasındaki `URL` ile `anon` anahtarını girin:

   ```bash
   cp .env.example .env.local
   ```

4. Bağımlılıkları kurup geliştirme sunucusunu başlatın:

   ```bash
   npm install
   npm run dev
   ```

5. <http://localhost:3000> adresinde "Kayıt Ol" ile hesabınızı oluşturun.

> Not: Supabase varsayılan olarak e-posta doğrulaması ister. Geliştirme
> sırasında kapatmak için: **Authentication → Providers → Email →
> "Confirm email"** seçeneğini devre dışı bırakın.

## Modüller

- ✅ **Literatür** — üç bölüm: (1) "Makaleleri Getir" ile sporcular üzerinde
  yapılmış RCT çalışmaları, (2) konu başlığına göre gruplanan kaydedilen
  makaleler, (3) not aldığın makaleler için A4 boyutunda yazdırılabilir föy.
  DOI / PubMed ile elle içe aktarma da mevcuttur.
- ✅ **Post-it Notlar** — kaynak referansı **opsiyonel**; notlar renkli post-it
  panosu olarak görünür. `[[Not Başlığı]]` ile Zettelkasten bağlantıları,
  `#etiket` ile çapraz filtreleme, not içi arama.
- ✅ **Öne Çıkanlar** — not içinde pasaj seçin, tek tıkla alıntı koleksiyonuna eklensin.
- ✅ **Bilgi Grafiği** — not/etiket/kaynak ilişkilerinin sürüklenebilir,
  tıklanabilir kuvvet-yönlendirmeli haritası.
- ✅ **Flashcard** — SM-2 aralıklı tekrar algoritması, günlük tekrar kuyruğu.
- ✅ **Feynman Modu** — notu sporcuya / asistan antrenöre / sosyal medya
  formatına sadeleştirir (Claude API; `ANTHROPIC_API_KEY` gerektirir).
- ✅ **Kitap Rafı** — kapak görselli liste; kapak kitap adından otomatik bulunur.
  Her kitap için zengin metin (font, boyut, renk, görsel ekleme) özet editörü.
- ✅ **Ses Notu & Transkript** — tarayıcıda konuşma tanıma (tr-TR), transkript
  tek tıkla kaynaklı nota dönüşür.
- ✅ **Bilgi Derinliği** — konu başına benzersiz kaynak sayısı analizi;
  yüzeysel kalınan konuları işaretler.

Geliştirme kuralları için [CLAUDE.md](./CLAUDE.md) dosyasına bakın.
