-- NoteFlow — 0008 + 0009'un 0010'dan SONRA güvenli uygulanması
--
-- Bazı kurulumlarda 0010 (özel kategoriler) uygulanmış ama 0008 (category
-- kolonları) ve 0009 (board_sources) uygulanmamıştır. 0008'i olduğu gibi
-- çalıştırmak, 0010'un kaldırdığı 4'lü CHECK kısıtlarını geri getirir ve
-- kullanıcının eklediği özel kategorileri (ör. "kisisel-gelisim") bozar.
-- Bu dosya aynı sonucu CHECK olmadan, idempotent biçimde üretir; 0008/0009/
-- 0010'un hepsi uygulanmış bir veritabanında çalıştırmak da zararsızdır.

-- 1) category kolonları (0008, CHECK'siz — 0010'un nihai hâli).
alter table public.notes
  add column if not exists category text not null default 'spor';
alter table public.sources
  add column if not exists category text not null default 'spor';
alter table public.tags
  add column if not exists category text not null default 'spor';

-- 0008 daha önce uygulandıysa kalmış olabilecek 4'lü kısıtlar (0010 ile aynı).
alter table public.notes   drop constraint if exists notes_category_check;
alter table public.sources drop constraint if exists sources_category_check;
alter table public.tags    drop constraint if exists tags_category_check;

-- 2) Kitapların kategorisi Kitap Rafı'nda metadata.category'de tutulur; kolonu
--    onunla eşitle ki pasaj/etiket kategorileri tutarlı olsun. Kurslar
--    (kind = 'other', metadata.category = 'course') ve makaleler 'spor' kalır.
update public.sources
set category = metadata->>'category'
where kind = 'book'
  and coalesce(metadata->>'category', '') not in ('', 'course')
  and category is distinct from metadata->>'category';

-- 3) Etiket benzersizliği (user_id, name) → (user_id, name, category).
alter table public.tags drop constraint if exists tags_user_id_name_key;
do $$
begin
  alter table public.tags
    add constraint tags_user_id_name_category_key unique (user_id, name, category);
exception
  when duplicate_object or duplicate_table then null;
end $$;

-- 4) İndeksler (0008).
create index if not exists notes_user_category_idx
  on public.notes (user_id, category);
create index if not exists sources_user_category_idx
  on public.sources (user_id, kind, category);
create index if not exists tags_user_category_idx
  on public.tags (user_id, category);

-- 5) Pano/panel için görselsiz kaynak içeriği (0009 ile birebir aynı).
create or replace function public.board_sources()
returns table (
  id uuid,
  kind text,
  title text,
  category text,
  metadata jsonb
)
language sql
stable
as $$
  select
    s.id,
    s.kind,
    s.title,
    s.category,
    jsonb_build_object(
      'category', s.metadata->'category',
      'summary', case
        when s.metadata ? 'summary' then
          to_jsonb(regexp_replace(s.metadata->>'summary', '<img[^>]*>', '', 'gi'))
      end,
      'notes', case
        when jsonb_typeof(s.metadata->'notes') = 'array' then (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'id', n->'id',
                'title', n->'title',
                'html', to_jsonb(
                  regexp_replace(coalesce(n->>'html', ''), '<img[^>]*>', '', 'gi')
                )
              )
              order by ord
            ),
            '[]'::jsonb
          )
          from jsonb_array_elements(s.metadata->'notes') with ordinality as t(n, ord)
        )
      end
    )
  from public.sources s;
$$;

-- 0003'teki default privileges bunu zaten kapsar; eski kurulumlar için açıkça.
grant execute on function public.board_sources()
  to anon, authenticated, service_role;
