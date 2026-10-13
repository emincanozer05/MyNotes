-- NoteFlow — "Ne, nedir?" sözlüğü
--
-- Kavram/ifade tanımları. Not editöründe seçilen metin "Sözlüğe Kaydet" ile
-- tanım (`definition`) olarak eklenir; başlık (`term`) boş kalabilir ve sonradan
-- elle girilir. `source_path` girdinin kaydedildiği sayfanın yoludur
-- (ör. /bookshelf/<id>) — "Kaynağa git" bağlantısı için.

create table if not exists public.glossary_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  term text not null default '',
  definition text not null default '',
  source_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists glossary_entries_user_idx
  on public.glossary_entries (user_id, created_at desc);

alter table public.glossary_entries enable row level security;

do $$
begin
  create policy "glossary_entries_all_own" on public.glossary_entries
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception
  when duplicate_object then null;
end $$;

grant all on public.glossary_entries to anon, authenticated, service_role;
