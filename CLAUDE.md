# S&C Hub — Kuvvet & Kondisyon Bilgi Platformu

@AGENTS.md

## Proje Kuralları (KRİTİK)

1. **Git otomasyonu:** Her önemli değişiklik ve modül güncellemesinden sonra
   otomatik olarak git commit ve push süreçleri işletilmelidir.
   - Her anlamlı değişiklik/modül tamamlanması sonrası açıklayıcı mesajla
     `git commit` atılır (Örn: `feat: 1RM hesaplayıcı bileşeni eklendi`).
   - Büyük kod blokları veya yeni modüller push edilmeden önce kullanıcıya
     değişiklik özeti sunulup onay alınır. Küçük düzeltmeler, bug fix'ler ve
     ufak güncellemeler doğrudan push edilebilir.

2. **Veri kalıcılığı:** Veri saklama amacıyla `localStorage` veya
   `sessionStorage` KESİNLİKLE KULLANILMAZ. Tüm kullanıcı verisi Supabase
   (PostgreSQL) üzerinde, satır düzeyi güvenlik (RLS) ile kullanıcıya izole
   şekilde tutulur ve cihazlar arası senkronizedir.

3. **Dil:** Arayüz metinleri Türkçe, kod (değişken/fonksiyon adları, yorumlar)
   İngilizce yazılır.

## Teknoloji Yığını

- **Frontend:** Next.js 16 (App Router, `src/` dizini), React 19, TypeScript, Tailwind CSS v4
- **Backend/DB:** Supabase — PostgreSQL + Auth + RLS (+ Storage: ses kayıtları)
- **Dış API'ler:** CrossRef (DOI), NCBI E-utilities (PubMed), Anthropic Claude API (Feynman modu)

## Mimari Notları

- Next.js 16: `middleware.ts` yerine `src/proxy.ts` kullanılır; `cookies()`
  async'tir. Emin olunmayan API'ler için `node_modules/next/dist/docs/` okunur.
- Supabase istemcileri: `src/lib/supabase/server.ts` (RSC/route handler),
  `src/lib/supabase/client.ts` (tarayıcı). İstemciler modül kapsamında değil,
  istek başına oluşturulur.
- Veritabanı şeması `supabase/migrations/` altında SQL migration'ları olarak
  tutulur; şema değişikliği = yeni migration dosyası.
- Dış API çağrıları (CrossRef, PubMed) tarayıcıdan değil, her zaman route
  handler'lar (`src/app/api/…`) üzerinden yapılır.
- Tüm tablolarda `user_id` + RLS zorunludur; sorgular oturumdaki kullanıcıya
  göre otomatik filtrelenir.

## Komutlar

```bash
npm run dev     # geliştirme sunucusu
npm run build   # üretim derlemesi (değişiklik sonrası doğrulama için çalıştır)
npm run lint    # eslint
```

## Modül Yol Haritası

1. ✅ Aşama 1 — İskelet, CLAUDE.md, DB şeması, Auth, Literatür modülü (DOI/PubMed içe aktarma)
2. Aşama 2 — Not sistemi: zorunlu kaynak referansı, highlight koleksiyonu, Zettelkasten linkleri, etiketler
3. Aşama 3 — Hesaplayıcılar: 1RM (Epley/Brzycki), Kuvvet-Hız profili, Karvonen nabız bölgeleri
4. Aşama 4 — Bilgi grafiği (concept map) + Spaced repetition flashcard (SM-2)
5. Aşama 5 — Feynman modu (Claude API), Kitap rafı, Ses notu & transkript, Bilgi Derinliği paneli
