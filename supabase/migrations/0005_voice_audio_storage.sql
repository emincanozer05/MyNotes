-- S&C Hub — Ses notlarını gerçek ses dosyası olarak sakla + başlık ekle
-- 1) voice_notes tablosuna başlık kolonu (tarih zaten created_at'te var).
-- 2) 'voice-notes' özel (private) storage bucket'ı.
-- 3) storage.objects üzerinde kullanıcıya izole RLS: her kullanıcı yalnızca
--    kendi klasöründeki (<uid>/...) dosyaları görür/yükler/siler.

alter table public.voice_notes add column if not exists title text;

insert into storage.buckets (id, name, public)
values ('voice-notes', 'voice-notes', false)
on conflict (id) do nothing;

-- Politikaların idempotent olması için önce varsa düşür.
drop policy if exists "voice_notes_select_own" on storage.objects;
drop policy if exists "voice_notes_insert_own" on storage.objects;
drop policy if exists "voice_notes_delete_own" on storage.objects;

create policy "voice_notes_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "voice_notes_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "voice_notes_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'voice-notes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
