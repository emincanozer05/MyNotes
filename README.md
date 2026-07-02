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

- ✅ **Literatür** — DOI / PubMed kimliği yapıştırın, makale meta verisi
  (başlık, yazarlar, yıl, dergi, özet) otomatik çekilip kütüphaneye eklenir.
- 🔜 **Notlar** — zorunlu kaynak referansı, highlight koleksiyonu, Zettelkasten
  bağlantıları, akıllı etiketler (Aşama 2)
- 🔜 **Hesaplayıcılar** — 1RM (Epley/Brzycki), Kuvvet-Hız profili, Karvonen (Aşama 3)
- 🔜 **Bilgi Grafiği & Flashcard** — kavram haritası, SM-2 aralıklı tekrar (Aşama 4)
- 🔜 **Feynman Modu, Kitap Rafı, Ses Notu, Bilgi Derinliği** (Aşama 5)

Geliştirme kuralları için [CLAUDE.md](./CLAUDE.md) dosyasına bakın.
