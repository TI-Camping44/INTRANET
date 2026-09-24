-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- El texto de los documentos, para poder buscar adentro
-- =====================================================================
-- Hoy el buscador encuentra por codigo, titulo y descripcion. No lee lo
-- que dice ADENTRO del archivo. Si alguien pregunta donde dice cuanto
-- tiempo se conservan los registros de venta, la respuesta esta en la
-- pagina 4 de un procedimiento y el buscador no la encuentra.
--
-- Se guarda el texto extraido en una tabla aparte y no en una columna de
-- `documentos` a proposito: son miles de caracteres por fila, y
-- `documentos` se consulta entera en cada listado. Metido ahi, cada vez
-- que alguien abre la lista maestra viajarian 58 documentos completos
-- para mostrar una tabla de titulos.
--
-- Una fila por documento, no por version. Lo que se busca es lo que
-- rige; el historial de versiones sigue estando donde estaba.
--
-- NO ES LA FUENTE DE VERDAD. El archivo manda. Esta tabla es un indice
-- que se puede borrar y volver a generar sin perder nada.

create table public.documento_texto (
  documento_id uuid primary key references public.documentos (id) on delete cascade,
  -- De que archivo salio. Si se reemplaza el archivo, se reextrae; si se
  -- borra el adjunto, la fila queda como estaba hasta la reextraccion,
  -- que es mejor que dejar al documento sin texto de golpe.
  adjunto_id uuid references public.adjuntos (id) on delete set null,
  texto text not null,
  paginas integer,
  extraido_en timestamptz not null default now(),

  busqueda tsvector generated always as (to_tsvector('spanish', texto)) stored,

  constraint documento_texto_no_vacio check (length(btrim(texto)) > 0)
);

create index documento_texto_busqueda_idx on public.documento_texto using gin (busqueda);

comment on table public.documento_texto is
  'Texto extraido del archivo de cada documento, para buscar dentro del '
  'contenido. Es un indice regenerable, no la fuente de verdad.';

-- ---------------------------------------------------------------------
-- RLS. Se ve el texto de un documento si se ve el documento, y se
-- escribe si se lo puede gestionar. Las dos condiciones son las mismas
-- que ya usan `documento_versiones` y `documento_difusion`, y viven en
-- funciones SECURITY DEFINER para no repetirlas ni provocar recursion.
-- ---------------------------------------------------------------------
alter table public.documento_texto enable row level security;

create policy "documento_texto_lectura" on public.documento_texto
  for select to authenticated
  using (public.puede_ver_documento(documento_id));

create policy "documento_texto_alta" on public.documento_texto
  for insert to authenticated
  with check (public.puede_gestionar_documento(documento_id));

create policy "documento_texto_edicion" on public.documento_texto
  for update to authenticated
  using (public.puede_gestionar_documento(documento_id))
  with check (public.puede_gestionar_documento(documento_id));

create policy "documento_texto_baja" on public.documento_texto
  for delete to authenticated
  using (public.puede_gestionar_documento(documento_id));

-- El grant explicito: la tabla es nueva y el bucle de la migracion 013 ya
-- corrio. Sin esto PostgreSQL corta antes de evaluar las politicas y la
-- pantalla queda vacia sin decir por que.
revoke all on public.documento_texto from anon;
grant select, insert, update, delete on public.documento_texto to authenticated;

-- ---------------------------------------------------------------------
-- La busqueda global ahora mira tambien dentro del contenido.
-- ---------------------------------------------------------------------
-- Se rehace la rama de documentos con un LEFT JOIN en vez de agregar una
-- rama nueva al UNION. Con una rama aparte, un documento que coincide por
-- titulo Y por contenido aparecia dos veces en la lista.
--
-- El detalle que se muestra cambia segun donde este la coincidencia: si
-- esta en el contenido se devuelve el fragmento del documento con la
-- palabra buscada, que es lo que la persona necesita leer; si no, la
-- descripcion, como antes.
--
-- El contenido pesa menos que el titulo en la relevancia. Un documento
-- que se LLAMA «Politica de garantia» tiene que salir antes que uno que
-- menciona la garantia al pasar en un parrafo.

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
      case
        when t.busqueda @@ c.tsq then
          ts_headline(
            'spanish',
            t.texto,
            c.tsq,
            -- Sin StartSel ni StopSel: el fragmento sale como TEXTO PLANO.
            -- Por defecto `ts_headline` envuelve la palabra encontrada en
            -- <b>…</b>, y la pantalla muestra el detalle como texto: se
            -- leerian las etiquetas escritas. Renderizarlo como HTML no es
            -- opcion: ese texto sale de un archivo que subio alguien, y
            -- pintar HTML de origen externo es abrir una puerta que no
            -- hace falta abrir para mostrar un fragmento.
            'MaxWords=32, MinWords=12, ShortWord=3, MaxFragments=1, '
              || 'FragmentDelimiter=" … ", StartSel="", StopSel=""'
          )
        else coalesce(d.descripcion, '')
      end,
      d.estado::text,
      '/documentos/' || d.id,
      ts_rank(d.busqueda, c.tsq) + 0.1
        + coalesce(ts_rank(t.busqueda, c.tsq), 0) * 0.3
    from public.documentos d
    left join public.documento_texto t on t.documento_id = d.id
    cross join consulta c
    where d.busqueda @@ c.tsq
       or t.busqueda @@ c.tsq
       or lower(unaccent(coalesce(d.codigo, '') || ' ' || d.titulo)) like c.patron

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
  order by relevancia desc, codigo nulls last
  limit greatest(coalesce(p_limite, 30), 1);
$$;

grant execute on function public.buscar_global(text, integer) to authenticated;
