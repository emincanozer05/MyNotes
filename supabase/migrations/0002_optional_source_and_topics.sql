-- S&C Hub — Aşama 6 şema güncellemesi
-- 1) Not oluştururken kaynak referansı artık zorunlu değil.
-- 2) Makale konu başlığı ve kitap özeti (zengin metin) `sources.metadata`
--    jsonb alanında tutulur; ayrı bir migration gerektirmez, bu dosya yalnızca
--    kaynak referansının opsiyonelleştirilmesini uygular.

alter table public.notes alter column source_title drop not null;
alter table public.notes alter column source_author drop not null;
alter table public.notes alter column source_title set default '';
alter table public.notes alter column source_author set default '';

-- Not: makale konu başlığı -> sources.metadata->>'topic'
--      kitap özeti (HTML)   -> sources.metadata->>'summary'
-- Bu alanlar jsonb `metadata` içinde saklandığından ek kolon gerekmez.
