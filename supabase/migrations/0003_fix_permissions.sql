-- S&C Hub — "permission denied" düzeltmesi
--
-- Uygulamadaki tüm özellikler (notlar, post-it panosu, bilgi grafiği,
-- flashcard, ses notu, kitap rafı, bilgi derinliği, makale kaydetme)
-- "permission denied" hatası veriyordu. Sebep: PostgREST'in kullandığı
-- API rolleri (anon / authenticated) public şemadaki tablolara erişim
-- yetkisine (GRANT) sahip değildi. RLS politikaları (0001) satır düzeyinde
-- izolasyonu zaten sağlıyor; bu dosya yalnızca rollerin tablolara
-- ulaşabilmesi için gereken yetkileri verir.
--
-- Uygulamak için: Supabase Dashboard → SQL Editor → bu dosyayı yapıştırıp
-- çalıştırın (veya `supabase db push`).

grant usage on schema public to anon, authenticated, service_role;

-- Mevcut tablolar, sıralar ve fonksiyonlar
grant all privileges on all tables in schema public
  to anon, authenticated, service_role;
grant all privileges on all sequences in schema public
  to anon, authenticated, service_role;
grant execute on all functions in schema public
  to anon, authenticated, service_role;

-- Gelecekte oluşturulacak nesneler için varsayılan yetkiler
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to anon, authenticated, service_role;
