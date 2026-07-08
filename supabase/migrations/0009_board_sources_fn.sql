-- NoteFlow — Performans: pano/panel için hafifletilmiş kaynak içeriği
--
-- Post-it panosu ve Panel, etiketli pasajları (<mark> highlight'ları) çıkarmak
-- için TÜM kaynakların metadata jsonb'sini indiriyordu. Zengin metin notları
-- base64 görseller içerebildiğinden bu yük megabaytları bulup sayfa açılışını
-- yavaşlatıyordu. Bu fonksiyon aynı içeriği <img …> etiketleri veritabanında
-- ayıklanmış olarak döndürür: highlight işaretleri ve metin aynen korunur,
-- görsel verisi hattan hiç geçmez.
--
-- SECURITY INVOKER (varsayılan) olduğu için RLS aynen uygulanır; herkes
-- yalnızca kendi satırlarını görür.

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
