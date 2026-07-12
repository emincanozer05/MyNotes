-- NoteFlow — Kullanıcı tanımlı (custom) kategoriler
--
-- Kitap Rafı ve Post-it panosu artık dört sabit kategoriyle sınırlı değil:
-- kullanıcı "+" ile kendi kategorisini ekleyebilir. Yeni kategoriler bu tabloda
-- tutulur ve her iki sekme (Kitap Rafı + Post-it) aynı listeyi okuduğundan
-- otomatik senkron kalır. Sabit dört kategori (spor/tarih/bilim/felsefe) kodda
-- yerleşiktir; bu tablo yalnızca kullanıcının eklediklerini taşır.

-- ---------------------------------------------------------------------------
-- categories — kullanıcıya özel ek kategoriler (RLS ile izole).
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  slug text not null,
  label text not null,
  created_at timestamptz not null default now(),
  unique (user_id, slug)
);

create index if not exists categories_user_idx
  on public.categories (user_id, created_at);

alter table public.categories enable row level security;

do $$
begin
  create policy "categories_all_own" on public.categories
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception
  when duplicate_object then null;
end;
$$;

-- 0003'teki default privileges yeni tabloyu kapsar; eski kurulumlar için açıkça.
grant all on public.categories to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Sabit dört değere kilitleyen CHECK kısıtları kaldırılır; artık custom slug'lar
-- da (notes/sources/tags.category) saklanabilir. RLS satır izolasyonu değişmez.
-- ---------------------------------------------------------------------------
alter table public.notes   drop constraint if exists notes_category_check;
alter table public.sources drop constraint if exists sources_category_check;
alter table public.tags    drop constraint if exists tags_category_check;
