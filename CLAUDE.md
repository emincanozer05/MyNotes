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
- Yazı tipi Google Sans (`next/font/google`, `--font-google-sans`). Arayüzde
  emoji kullanılmaz; simgeler `src/components/Icon.tsx` (currentColor SVG)
  üzerinden eklenir.

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

10. ✅ Çeviri (`/api/translate`: Literatür başlıkları, not editörü "Türkçeye çevir"/
   "Eng", PDF görüntüleyici "Türkçe"): `GEMINI_API_KEY` (veya `GOOGLE_API_KEY`)
   tanımlıysa önce Google Gemini ile (çeviri modeli `GEMINI_TRANSLATE_MODEL`,
   varsayılan `gemini-2.5-flash-lite`; Açıkla'nın `GEMINI_MODEL`'inden ayrı, çünkü
   kota model başına), anahtar yoksa ya da çağrı başarısızsa sırayla Google
   gtx → MyMemory → Anthropic ile çevrilir. Sık tetiklenen Literatür başlık
   tooltip'i Gemini'yi yalnızca yedek olarak kullanır (`quality` bayrağı yok);
   PDF "Türkçe" ve editör çevirisi Gemini'yi önce dener. 429'da Gemini 1 dk
   atlanır. Ortak anahtar/model okuma `src/lib/gemini.ts`'te.

11. ✅ **Ne, nedir?** sözlüğü (`/glossary`): kavram/ifade tanımları
   `glossary_entries` tablosunda (`0015`; `term` boş olabilir, `definition`,
   `source_path`). Not editöründe (`RichTextEditor`) metin seçilince araç
   çubuğundaki "Sözlüğe Kaydet" seçimi başlıksız girdi olarak ekler; başlık
   sonradan sayfada elle girilir ("Başlık bekleyenler" bölümü). Yedeklemeye dahil.
   0015 uygulanmamışsa girdiler `voice-notes` bucket'ında `<uid>/glossary/v-<ts>.json`
   anlık görüntüsü olarak tutulur (bucket'ta UPDATE politikası yok: her yazma yeni
   dosya + eskileri silme); tablo oluşunca ilk okumada otomatik tabloya taşınır.
   Erişim `src/lib/glossaryStore.ts` üzerinden.

12. ✅ Arayüz düzeltmeleri: not editörünün seçim araç kutusunda "Açıkla" butonu
   (`ExplainSelection` yalnızca `EXPLAIN_REQUEST_EVENT` olayıyla tetiklenir; editörde
   yüzen buton gizlenir, `data-explain-inline`); Kitap Notları başlıkları açılır
   menü (`TitledNotes`); etiketlerde `#` öneki gösterilmez (yazarken `#etiket`
   sözdizimi geçerli); Literatür "Notlarım" sekmesi etiket haritası
   (`library/TagMap.tsx`, d3-force): düğüm = etiket (boyut = çalışma sayısı), kenar =
   aynı makalede birlikte geçme; etikete tıklayınca o etiketin çalışmaları altta açılır;
   "Liste" görünümü eski arama/sıralama listesini korur.

13. ✅ Tablet uyumu: kenar çubuğu `lg` (1024px) altında açılır menüdür (dikey tablet
   tam genişlik kullanır); haritalar (`NetworkGraph`, `TagMap`) iki parmakla
   yakınlaştırma/uzaklaştırma + iki parmakla kaydırmayı destekler
   (`src/lib/pinchZoom.ts`, pointer events); Tailwind `hover:` dokunmatikte çalışmadığından
   hover ile açılan sil butonları `touch-show` sınıfıyla dokunmatikte hep görünür.

14. ✅ **Kariyer Yol Haritası** (`/career`, kenar çubuğunda ayrı sekme): ana kariyer
   hedefi ağacın gövdesi, gelişim alanları ana dallar, alt hedefler/görevler
   dallardaki düğümlerdir (kutu/liste/Kanban yok). Tek tabloda (`career_nodes`,
   `0016`; komşuluk listesi, kullanıcı başına tek gövde, `parent_id` cascade) tutulur:
   durum, öncelik, tarihler, alt görevler, kaynaklar, notlar, ön koşullar
   (`prerequisites` → kilitli düğüm), dal rengi/tarafı, `collapsed`, `sort_order`.
   Saf mantık `src/lib/career.ts` (ilerleme = yaprak hedeflerden hesaplanır, iki
   taraflı ağaç yerleşimi, örnek ağaç); arayüz `src/app/(app)/career/`:
   `CareerTree.tsx` (yerel durum + sıralı, iyimser Supabase yazımı: `actions.ts`),
   `TreeCanvas.tsx` (SVG; sürükle/tekerlek/iki parmak zoom, düğümü başka düğüme
   sürükleyerek taşıma, aç/kapa, sığdır, tam ekran), `NodePanel.tsx` (sağ detay
   paneli). Tamamlanan dallar bağlantı çizgisini doldurur; tamamlanınca tek seferlik
   halka animasyonu. Yedeklemeye dahil. Tablo yoksa sayfa açıklayıcı uyarı gösterir.

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
