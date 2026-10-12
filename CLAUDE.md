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
2. ✅ Aşama 2 — Not sistemi: zorunlu kaynak referansı, highlight koleksiyonu, Zettelkasten linkleri, etiketler
3. ✅ Aşama 3 — Hesaplayıcılar (Aşama 6'da kaldırıldı)
4. ✅ Aşama 4 — Bilgi grafiği (concept map) + Spaced repetition flashcard (SM-2)
5. ✅ Aşama 5 — Feynman modu (Claude API, `claude-opus-4-8`), Kitap rafı, Ses notu & transkript (Web Speech API), Bilgi Derinliği paneli
6. ✅ Aşama 6 — Dinamik tasarım (aurora arka plan + animasyonlar); kaynak referansı opsiyonel + Post-it not panosu; Literatür 3 bölüm (RCT getir / konu bazlı liste / A4 yazdırma); Hesaplayıcılar kaldırıldı; Kitap Rafı zengin metin özet editörü (font/boyut/renk/görsel). Makale konusu ve kitap özeti `sources.metadata` jsonb alanında tutulur; not kaynağı için `0002` migration.
7. ✅ Aşama 7 — "Bilgi Derinliği" yerine **Network Haritası** (`/network`, eski
   `/insights` yönlendirilir): kişi profilleri `contacts` tablosunda (`0012`),
   profil örnek JSON şemasıyla birebir (`personal`, `contact`, `professional`,
   `relationship`, `network_development`) `profile` jsonb'de; foto istemcide
   küçültülüp data URL olarak saklanır. Grafik `d3-force` ile (sürükle/zoom/
   hover/süzülme); kenarlar `relationship.mutual_contacts` isimlerinden
   türetilir, ağda olmayan ortak tanıdık yeni kişi olarak eklenir. Literatür
   listesi `library_articles()` RPC'si (`0011`) ile görselsiz özet çeker;
   etiket filtreleri (Literatür + Post-it) dropdown; dar ekranda açılır menü.
8. ✅ Aşama 8 — **Açıkla** (RemNote AI Explain benzeri): herhangi bir okunabilir
   metin seçilince yanında "Açıkla" butonu çıkar; seçim + paragraf + en yakın
   başlık `POST /api/explain`'e gider, açıklama NDJSON akışıyla seçimin yanındaki
   popup'a yazılır ("Daha Basit Açıkla" / "Detaylandır" aynı bağlamla yeniden
   üretir). Bileşen `src/components/ExplainSelection.tsx` (app layout'ta tek kez
   monte edilir), sözleşme `src/lib/explain.ts`. Form alanları, butonlar ve
   `data-no-explain` işaretli öğeler hariç tutulur. Önbellek yalnızca bellekte
   (sekme başına + sunucu örneği başına); DB'ye dokunmaz. `GEMINI_API_KEY` (Google Gemini, `GEMINI_MODEL` ile model seçilir, varsayılan
   `gemini-2.5-flash`) tanımlıysa Gemini ile, değilse `ANTHROPIC_API_KEY` ile
   çalışır; `EXPLAIN_PROVIDER=gemini|anthropic` ile zorlanabilir.
9. ✅ Literatür "Kendi makaleni ekle" formuna PDF yükleme: dosya tarayıcıdan
   doğrudan özel `article-pdfs` bucket'ına (`0014`, `<uid>/…` RLS) yüklenir;
   0014 uygulanmamışsa `voice-notes` bucket'ına (`<uid>/article-pdfs/`) düşer.
   İşaretçi `sources.metadata.pdf` (`bucket`, `path`, `name`, `size`) içinde;
   açma imzalı URL ile (`getArticlePdfUrl`), makale silinince PDF de silinir.
   PDF içindeki DOI/başlık (XMP, Info, link anotasyonları) formu doldurur
   (`src/lib/articlePdf.ts`).

`0008`/`0009` uygulanmamış ama `0010` uygulanmış veritabanları için `0013`
aynı şemayı CHECK kısıtları olmadan, idempotent olarak kurar (0008'i 0010'dan
sonra çalıştırmak özel kategorileri bozar — onun yerine 0013 kullanılır).
Canlı veritabanında 0011, 0012 ve 0013 uygulanmıştır.

Kimlik doğrulama: Site tek kullanıcılıdır; giriş/kayıt/şifre sıfırlama
ekranları kaldırıldı. `src/proxy.ts`, geçerli oturum yoksa sunucu ortamındaki
`OWNER_EMAIL` / `OWNER_PASSWORD` ile otomatik `signInWithPassword` yapar (RLS
`auth.uid()` ile çalışmaya devam eder). Değişkenler tanımsızsa ya da giriş
başarısızsa proxy açıklayıcı 503 döner. Hesap Supabase'de (Authentication →
Users) önceden oluşturulmuş ve e-postası doğrulanmış olmalıdır.

Feynman modu `ANTHROPIC_API_KEY` ister; anahtar yoksa route açıklayıcı 503 döner.

`0003` migration'ı "permission denied" hatalarını çözer: PostgREST rollerine
(anon/authenticated) public şema GRANT'lerini verir — RLS satır izolasyonu
değişmez; yeni tablolar default privileges ile otomatik kapsanır. Literatür
sayfası sekmeli akış tasarımındadır (Günlük Akış / Kaydedilenler /
Not Aldıklarım) ve kullanıcı kendi makalesini elle ekleyebilir
(`addOwnArticle`, `metadata.manual = true`).
