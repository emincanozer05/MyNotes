-- NoteFlow — Kariyer Yol Haritası: görsel kariyer ağacı
--
-- Ağaç tek bir tabloda tutulur (komşuluk listesi): gövde = parent_id'si boş olan
-- tek satır (kullanıcı başına), ana dallar gövdenin çocukları, alt dallar ve
-- hedefler daha derindeki satırlardır. Kategoriler sabit değildir; kullanıcı
-- dilediği düğümü ekler, taşır, siler.
--   status        : not_started | in_progress | done (yalnızca yaprak düğümlerde
--                   anlamlıdır; üst düğümlerin durumu alt hedeflerden hesaplanır)
--   subtasks      : [{ id, text, done }]
--   resources     : [{ id, title, url }]
--   prerequisites : bu düğümün kilidini açan düğüm id'leri (tamamlanmaları gerekir)
--   color         : ana dalın renk anahtarı (alt dallar ana daldan miras alır)
--   side          : ana dalın gövdenin 'left' / 'right' tarafı (boş = sıraya göre)
--   collapsed     : dal kapalı mı (görsel düzenin kalıcı parçası)
--   sort_order    : kardeşler arası sıra

create table if not exists public.career_nodes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  parent_id uuid references public.career_nodes (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  description text not null default '',
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'done')),
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  start_date date,
  due_date date,
  notes text not null default '',
  subtasks jsonb not null default '[]'::jsonb,
  resources jsonb not null default '[]'::jsonb,
  prerequisites uuid[] not null default '{}',
  color text,
  side text check (side in ('left', 'right')),
  collapsed boolean not null default false,
  sort_order integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists career_nodes_user_parent_idx
  on public.career_nodes (user_id, parent_id);

-- Kullanıcı başına tek gövde.
create unique index if not exists career_nodes_one_root_idx
  on public.career_nodes (user_id) where parent_id is null;

alter table public.career_nodes enable row level security;

do $$
begin
  create policy "career_nodes_all_own" on public.career_nodes
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception
  when duplicate_object then null;
end $$;

-- 0003'teki default privileges bunu zaten kapsar; eski kurulumlar için açıkça.
grant all on public.career_nodes to anon, authenticated, service_role;
