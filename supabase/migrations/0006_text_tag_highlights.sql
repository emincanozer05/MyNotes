-- S&C Hub — Metin etiketleme (renkli vurgu) sistemi
--
-- Not/post-it/kitap/kurs editörlerinde seçilen metne, kullanıcının kendi
-- oluşturduğu renkli bir etiket iliştirilebilir. Etiketin rengi `tags.color`
-- alanında (zaten var, şimdiye dek kullanılmıyordu) saklanır; her uygulamada
-- aynı renk kullanılır. Hangi metnin hangi etiketle işaretlendiği burada,
-- `tag_highlights` tablosunda tutulur — "Etiketler" sekmesi bu tabloyu listeler.
--
-- Bu tablo, eski serbest-alıntı `highlights` tablosunun yerini alır (o tablo
-- ve "❝ Alıntıya ekle" akışı kaldırılmıştır).

create table public.tag_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  text text not null,
  -- Post-it / makale notu ise note_id, kitap/kurs özeti ise source_id dolu olur.
  note_id uuid references public.notes (id) on delete cascade,
  source_id uuid references public.sources (id) on delete cascade,
  section_id text,
  section_title text,
  created_at timestamptz not null default now(),
  check (note_id is not null or source_id is not null)
);

create index tag_highlights_user_idx on public.tag_highlights (user_id, created_at desc);
create index tag_highlights_tag_idx on public.tag_highlights (user_id, tag_id);

alter table public.tag_highlights enable row level security;
create policy "tag_highlights_all_own" on public.tag_highlights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant all privileges on table public.tag_highlights to anon, authenticated, service_role;

-- Eski serbest-alıntı tablosu artık kullanılmıyor.
drop table if exists public.highlights;
