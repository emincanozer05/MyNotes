-- S&C Hub — initial schema
-- All user data lives in Postgres behind RLS; no client-side storage is used.

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- Auto-create a profile row on signup
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Sources: unified library of articles (DOI/PubMed imports), books, other
-- ---------------------------------------------------------------------------
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('article', 'book', 'other')),
  title text not null,
  authors text[] not null default '{}',
  year int,
  journal text,
  doi text,
  pmid text,
  url text,
  abstract text,
  cover_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, doi),
  unique (user_id, pmid)
);

create index sources_user_kind_idx on public.sources (user_id, kind);

-- ---------------------------------------------------------------------------
-- Notes: every note carries a mandatory source reference (title + author),
-- either linked to a library source or entered inline.
-- ---------------------------------------------------------------------------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  content text not null default '',
  source_id uuid references public.sources (id) on delete set null,
  source_title text not null,
  source_author text not null,
  source_year int,
  source_page text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_user_idx on public.notes (user_id, updated_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger notes_set_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

-- Zettelkasten: directed links between notes
create table public.note_links (
  user_id uuid not null references auth.users (id) on delete cascade,
  from_note uuid not null references public.notes (id) on delete cascade,
  to_note uuid not null references public.notes (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_note, to_note),
  check (from_note <> to_note)
);

-- Tags for cross-filtering (#kuvvet, #vbt, #recovery, ...)
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text,
  unique (user_id, name)
);

create table public.note_tags (
  note_id uuid not null references public.notes (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (note_id, tag_id)
);

-- Highlights: quoted passages collected in the "Öne Çıkanlar" panel
create table public.highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  note_id uuid not null references public.notes (id) on delete cascade,
  text text not null,
  comment text,
  created_at timestamptz not null default now()
);

create index highlights_user_idx on public.highlights (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Flashcards (SM-2 spaced repetition state)
-- ---------------------------------------------------------------------------
create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  note_id uuid references public.notes (id) on delete set null,
  front text not null,
  back text not null,
  ease real not null default 2.5,
  interval_days int not null default 0,
  repetitions int not null default 0,
  due_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index flashcards_due_idx on public.flashcards (user_id, due_at);

-- ---------------------------------------------------------------------------
-- Calculator history (1RM, force-velocity, Karvonen, ...)
-- ---------------------------------------------------------------------------
create table public.calc_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  calc_type text not null,
  inputs jsonb not null,
  results jsonb not null,
  created_at timestamptz not null default now()
);

create index calc_history_user_idx on public.calc_history (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Voice notes (audio in Supabase Storage, transcript as text)
-- ---------------------------------------------------------------------------
create table public.voice_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  note_id uuid references public.notes (id) on delete set null,
  audio_path text,
  transcript text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS: every table is isolated per user
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'sources', 'notes', 'note_links', 'tags', 'note_tags',
    'highlights', 'flashcards', 'calc_history', 'voice_notes'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "%s_all_own" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t, t
    );
  end loop;
end;
$$;
