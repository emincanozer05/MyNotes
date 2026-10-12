-- NoteFlow — Literatür: kendi eklenen makalelere PDF yükleme
--
-- 'article-pdfs' özel (private) storage bucket'ı; yalnızca PDF, en fazla 50 MB.
-- storage.objects üzerinde kullanıcıya izole RLS: her kullanıcı yalnızca kendi
-- klasöründeki (<uid>/...) dosyaları görür/yükler/siler. Makale satırı yalnızca
-- dosyanın yolunu `sources.metadata.pdf` içinde tutar; tablo şeması değişmez.
--
-- Bu migration uygulanmamış veritabanlarında uygulama, aynı politikalara sahip
-- mevcut 'voice-notes' bucket'ına (0005) <uid>/article-pdfs/ altında yükler.
-- İdempotenttir; tekrar çalıştırılabilir.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('article-pdfs', 'article-pdfs', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists "article_pdfs_select_own" on storage.objects;
drop policy if exists "article_pdfs_insert_own" on storage.objects;
drop policy if exists "article_pdfs_delete_own" on storage.objects;

create policy "article_pdfs_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'article-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "article_pdfs_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'article-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "article_pdfs_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'article-pdfs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
