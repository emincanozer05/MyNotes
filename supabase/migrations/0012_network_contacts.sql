-- NoteFlow — Network Haritası: kişi profilleri
--
-- "Bilgi Derinliği" sekmesinin yerini alan Network Haritası, kişisel/profesyonel
-- ağdaki kişileri tutar. Profilin tamamı örnek JSON şemasıyla birebir aynı
-- yapıda `profile` jsonb alanındadır:
--   personal, contact, professional, relationship, network_development
-- Grafikteki bağlantılar (kenarlar) profile.relationship.mutual_contacts
-- listesindeki isimlerden türetilir; aynı adın iki kez eklenmemesi için ad
-- kullanıcı başına (büyük/küçük harf duyarsız) benzersizdir.
-- Profil fotoğrafı istemcide küçültülüp data URL olarak profile.personal
-- .profile_photo içinde saklanır (kitap kapaklarıyla aynı yaklaşım).

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  full_name text not null check (length(trim(full_name)) > 0),
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists contacts_user_name_idx
  on public.contacts (user_id, lower(full_name));

alter table public.contacts enable row level security;

do $$
begin
  create policy "contacts_all_own" on public.contacts
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception
  when duplicate_object then null;
end $$;

-- 0003'teki default privileges bunu zaten kapsar; eski kurulumlar için açıkça.
grant all on public.contacts to anon, authenticated, service_role;
