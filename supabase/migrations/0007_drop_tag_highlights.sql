-- S&C Hub — "Etiketler" ayrı listesi kaldırıldı.
--
-- Etiketlenmiş pasajlar artık ayrı bir tabloda takip edilmiyor: vurgu zaten
-- not/kaynak içeriğinin HTML'ine (<mark data-tag-id>) gömülü olarak kalıcı;
-- post-it rengi de okuma anında bu içerikten türetiliyor. Bu yüzden
-- 0006'da eklenen izleme tablosuna artık gerek yok.

drop table if exists public.tag_highlights;
