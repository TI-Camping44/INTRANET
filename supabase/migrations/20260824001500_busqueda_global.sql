-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 015 · Busqueda global
-- =====================================================================
-- Consulta unificada sobre documentos, no conformidades, riesgos y
-- proveedores. La funcion es SECURITY INVOKER a proposito: cada persona
-- solo encuentra aquello que sus politicas RLS le permiten leer.

create or replace function public.buscar_global(p_texto text, p_limite integer default 30)
returns table (
  entidad text,
  entidad_etiqueta text,
  id uuid,
  codigo text,
  titulo text,
  detalle text,
  estado text,
  enlace text,
  relevancia real
)
language sql
stable
as $$
  with consulta as (
    select
      websearch_to_tsquery('spanish', p_texto) as tsq,
      '%' || lower(unaccent(coalesce(p_texto, ''))) || '%' as patron
  )
  select * from (
    select
      'documentos'::text,
      'Documento'::text,
      d.id,
      d.codigo,
      d.titulo,
      coalesce(d.descripcion, ''),
      d.estado::text,
      '/documentos/' || d.id,
      ts_rank(d.busqueda, c.tsq) + 0.1
    from public.documentos d, consulta c
    where d.busqueda @@ c.tsq or lower(unaccent(d.codigo || ' ' || d.titulo)) like c.patron

    union all

    select
      'no_conformidades'::text,
      'No conformidad'::text,
      n.id,
      n.codigo,
      n.titulo,
      coalesce(n.descripcion, ''),
      n.estado::text,
      '/no-conformidades/' || n.id,
      ts_rank(n.busqueda, c.tsq)
    from public.no_conformidades n, consulta c
    where n.busqueda @@ c.tsq or lower(unaccent(n.codigo || ' ' || n.titulo)) like c.patron

    union all

    select
      'riesgos'::text,
      'Riesgo'::text,
      r.id,
      r.codigo,
      r.titulo,
      coalesce(r.descripcion, ''),
      r.estado::text,
      '/riesgos/' || r.id,
      ts_rank(r.busqueda, c.tsq)
    from public.riesgos r, consulta c
    where r.busqueda @@ c.tsq or lower(unaccent(r.codigo || ' ' || r.titulo)) like c.patron

    union all

    select
      'proveedores'::text,
      'Proveedor'::text,
      p.id,
      p.codigo,
      p.razon_social,
      coalesce(p.rubro, ''),
      p.estado::text,
      '/proveedores/' || p.id,
      ts_rank(p.busqueda, c.tsq)
    from public.proveedores p, consulta c
    where p.busqueda @@ c.tsq
       or lower(unaccent(p.codigo || ' ' || p.razon_social || ' ' || coalesce(p.ruc, ''))) like c.patron
  ) resultados (entidad, entidad_etiqueta, id, codigo, titulo, detalle, estado, enlace, relevancia)
  order by relevancia desc, codigo
  limit greatest(coalesce(p_limite, 30), 1);
$$;

grant execute on function public.buscar_global(text, integer) to authenticated;
