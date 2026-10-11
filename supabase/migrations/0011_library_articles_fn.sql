-- NoteFlow — Performans: Literatür listesi için hafifletilmiş makale satırları
--
-- Literatür sayfası tüm makaleleri `select *` ile çekiyordu; makale özetleri
-- (metadata.summary) base64 görseller içerebildiğinden sayfaya her dönüşte
-- megabaytlarca veri iniyordu. Bu fonksiyon aynı satırları özetteki <img …>
-- etiketleri veritabanında ayıklanmış olarak döndürür. Listede yalnızca metin
-- önizlemesi gösterilir; "Oku" penceresi tam özeti ihtiyaç anında ayrıca çeker.
--
-- SECURITY INVOKER (varsayılan) olduğu için RLS aynen uygulanır.

create or replace function public.library_articles()
returns table (
  id uuid,
  user_id uuid,
  kind text,
  title text,
  authors text[],
  year int,
  journal text,
  doi text,
  pmid text,
  url text,
  abstract text,
  cover_url text,
  category text,
  metadata jsonb,
  created_at timestamptz
)
language sql
stable
as $$
  select
    s.id,
    s.user_id,
    s.kind,
    s.title,
    s.authors,
    s.year,
    s.journal,
    s.doi,
    s.pmid,
    s.url,
    null::text as abstract, -- listede gösterilmez; detay sayfası tam satırı çeker
    s.cover_url,
    s.category,
    case
      when s.metadata ? 'summary' then
        (s.metadata - 'notes') || jsonb_build_object(
          'summary',
          regexp_replace(s.metadata->>'summary', '<img[^>]*>', '', 'gi')
        )
      else s.metadata - 'notes'
    end as metadata,
    s.created_at
  from public.sources s
  where s.kind = 'article'
  order by s.created_at desc;
$$;

grant execute on function public.library_articles()
  to anon, authenticated, service_role;
