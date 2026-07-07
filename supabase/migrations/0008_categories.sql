-- NoteFlow — İçerik kategorileri (Spor / Tarih / Bilim / Felsefe)
-- Post-it panosu ve Kitap Rafı dört kategoriye ayrılır. Her kategori kendi
-- etiket kümesini taşır; etiketler kategoriler arasında karışmaz.

-- Ortak kategori kontrolü.
-- ---------------------------------------------------------------------------
-- notes.category — her post-it bir kategoriye aittir.
-- ---------------------------------------------------------------------------
alter table public.notes
  add column if not exists category text not null default 'spor'
    check (category in ('spor', 'tarih', 'bilim', 'felsefe'));

-- ---------------------------------------------------------------------------
-- sources.category — kitaplar (ve pasaj devralması için tüm kaynaklar).
-- ---------------------------------------------------------------------------
alter table public.sources
  add column if not exists category text not null default 'spor'
    check (category in ('spor', 'tarih', 'bilim', 'felsefe'));

-- ---------------------------------------------------------------------------
-- tags.category — etiketler kategoriye özeldir. Aynı ad farklı
-- kategorilerde ayrı etiketler olur (ör. #kaynak Spor ≠ #kaynak Bilim).
-- ---------------------------------------------------------------------------
alter table public.tags
  add column if not exists category text not null default 'spor'
    check (category in ('spor', 'tarih', 'bilim', 'felsefe'));

-- Benzersizlik artık (user_id, name, category) üçlüsünde.
alter table public.tags drop constraint if exists tags_user_id_name_key;
alter table public.tags
  add constraint tags_user_id_name_category_key unique (user_id, name, category);

-- Kategoriye göre hızlı filtreleme için indeksler.
create index if not exists notes_user_category_idx
  on public.notes (user_id, category);
create index if not exists sources_user_category_idx
  on public.sources (user_id, kind, category);
create index if not exists tags_user_category_idx
  on public.tags (user_id, category);
