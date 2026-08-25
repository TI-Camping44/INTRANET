-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- ACTUALIZACION · 1 de 2 · ESQUEMA
-- =====================================================================
--
-- Generado por scripts/generar-actualizacion.sh. No editar a mano.
--
-- Pegar entero en el editor SQL de Supabase y correr. Despues, y solo
-- despues, correr actualizacion-2-datos.sql.
--
-- Van separados porque un valor nuevo de un tipo enumerado no se puede
-- usar en la misma transaccion en que se agrega.
--
-- Es idempotente: cada migracion se saltea sola si ya esta aplicada.
-- =====================================================================


-- =====================================================================
-- MIGRACION: 20260825000100_reclamos_desde_satisfaccion.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 020 · Satisfaccion del cliente: del detractor al reclamo formal
-- =====================================================================
-- Medir el NPS sin actuar sobre los detractores no cierra ningun ciclo.
-- Esta migracion agrega el vinculo entre una respuesta de encuesta y la
-- no conformidad que origina, con la misma logica que ya usa el modulo
-- de auditorias: la regla vive en la base y no en la aplicacion, para
-- que valga tambien si la escritura viene de un script o del panel de
-- Supabase.
--
-- Agrega ademas el correlativo de encuestas, que hasta ahora se cargaba
-- a mano en el seed.

alter table public.encuesta_respuestas
  add column if not exists no_conformidad_id uuid
    references public.no_conformidades (id) on delete set null;

create index if not exists encuesta_respuestas_nc_idx
  on public.encuesta_respuestas (no_conformidad_id)
  where no_conformidad_id is not null;

-- ---------------------------------------------------------------------
-- Correlativo de encuestas: ENC-01, ENC-02, ...
-- ---------------------------------------------------------------------
create or replace function public.siguiente_codigo_encuesta(p_empresa_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select 'ENC-' || lpad((coalesce(max(
           nullif(regexp_replace(codigo, '^ENC-', ''), '')::int
         ), 0) + 1)::text, 2, '0')
    from public.encuestas
   where empresa_id = p_empresa_id
     and codigo ~ '^ENC-[0-9]+$';
$$;

-- ---------------------------------------------------------------------
-- Genera la no conformidad a partir de una respuesta de encuesta.
--
-- Solo se admite para detractores: un puntaje de 7 o mas es una opinion
-- a tener en cuenta, no un incumplimiento. El comentario del cliente se
-- copia literal al cuerpo de la no conformidad, porque es la evidencia
-- objetiva del reclamo y reescribirlo la debilita.
-- ---------------------------------------------------------------------
create or replace function public.generar_no_conformidad_desde_respuesta(
  p_respuesta_id uuid,
  p_responsable_id uuid default null,
  p_fecha_limite date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_respuesta public.encuesta_respuestas%rowtype;
  v_encuesta  public.encuestas%rowtype;
  v_cliente   text;
  v_codigo    text;
  v_titulo    text;
  v_nc_id     uuid;
begin
  select * into v_respuesta from public.encuesta_respuestas where id = p_respuesta_id;
  if not found then
    raise exception 'La respuesta indicada no existe';
  end if;

  if v_respuesta.no_conformidad_id is not null then
    raise exception 'La respuesta ya generó la no conformidad %',
      (select codigo from public.no_conformidades where id = v_respuesta.no_conformidad_id);
  end if;

  if v_respuesta.categoria_nps <> 'detractor' then
    raise exception 'Solo las respuestas de clientes detractores (puntaje 0 a 6) generan una no conformidad';
  end if;

  if coalesce(btrim(v_respuesta.comentario), '') = '' then
    raise exception 'La respuesta no tiene comentario: sin el motivo del cliente no hay reclamo que tratar';
  end if;

  select * into v_encuesta from public.encuestas where id = v_respuesta.encuesta_id;

  select razon_social into v_cliente
    from public.clientes where id = v_respuesta.cliente_id;

  v_codigo := public.siguiente_codigo_no_conformidad(v_encuesta.empresa_id);

  -- El origen y el cliente ya tienen su columna en el listado: el titulo
  -- se reserva para lo unico que no se ve ahi, que es el motivo.
  v_titulo := 'Reclamo de ' || coalesce(v_cliente, 'cliente anónimo') || ': ' ||
              left(v_respuesta.comentario, 80) ||
              case when length(v_respuesta.comentario) > 80 then '…' else '' end;

  insert into public.no_conformidades (
    empresa_id, codigo, titulo, descripcion, origen, severidad, estado,
    sede_id, cliente_id, responsable_id, fecha_deteccion, fecha_limite_cierre,
    creado_por
  ) values (
    v_encuesta.empresa_id,
    v_codigo,
    v_titulo,
    'Comentario del cliente en la encuesta ' || v_encuesta.codigo ||
      ' (' || v_encuesta.nombre || '), puntaje ' || v_respuesta.puntaje || ' de 10:' ||
      E'\n\n«' || v_respuesta.comentario || '»' ||
      case when v_cliente is not null then E'\n\nCliente: ' || v_cliente else '' end ||
      case when v_respuesta.canal is not null then E'\nCanal de respuesta: ' || v_respuesta.canal else '' end,
    'reclamo_cliente',
    -- Un 0 a 3 es un cliente perdido; de 4 a 6, insatisfecho.
    case when v_respuesta.puntaje <= 3 then 'mayor'::severidad_no_conformidad
         else 'menor'::severidad_no_conformidad end,
    'abierta',
    v_respuesta.sede_id,
    v_respuesta.cliente_id,
    p_responsable_id,
    v_respuesta.fecha,
    coalesce(p_fecha_limite, current_date + 30),
    auth.uid()
  )
  returning id into v_nc_id;

  update public.encuesta_respuestas
     set no_conformidad_id = v_nc_id
   where id = p_respuesta_id;

  return v_nc_id;
end;
$$;

comment on function public.generar_no_conformidad_desde_respuesta is
  'Convierte el comentario de un cliente detractor en una no conformidad de origen reclamo_cliente.';


-- =====================================================================
-- MIGRACION: 20260825000200_intranet_publicaciones.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 021 · Publicaciones internas, directorio y organigrama
-- =====================================================================
-- Hasta aca el sistema era un SGC: nueve modulos de calidad. Direccion
-- pidio que la intranet abra con los anuncios internos y que la gente
-- pueda encontrarse entre si. Esta migracion agrega esa capa.
--
-- Una sola tabla cubre seis pedidos distintos —anuncios, novedades de
-- producto, logros, reconocimientos, bienvenidas y cumpleanos— porque
-- todos son lo mismo: algo que alguien publica, con fecha, para que el
-- resto lo lea. Separarlos en seis tablas seria repetir seis veces la
-- misma estructura y seis veces las mismas politicas.
--
-- Los cumpleanos y aniversarios no se publican a mano: salen de dos
-- fechas del legajo, que se agregan aca.

-- ---------------------------------------------------------------------
-- Fechas del legajo, para cumpleanos y aniversarios de ingreso
-- ---------------------------------------------------------------------
alter table public.usuarios
  add column if not exists fecha_nacimiento date,
  add column if not exists fecha_ingreso date;

comment on column public.usuarios.fecha_nacimiento is
  'Solo dia y mes se muestran en la intranet; el ano queda reservado.';

-- ---------------------------------------------------------------------
-- Tipos de publicacion
-- ---------------------------------------------------------------------
-- PostgreSQL no admite "create type if not exists", y este archivo tiene
-- que poder aplicarse sobre una base que ya lo tenga.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_publicacion') then
    create type public.tipo_publicacion as enum (
      'anuncio',          -- comunicado interno
      'novedad_producto', -- lanzamientos, para que comercial se entere antes
      'logro',            -- licitaciones ganadas, records, certificaciones
      'reconocimiento',   -- a una persona o a un area
      'bienvenida',       -- nuevos ingresos
      'evento'            -- ferias, feriados, fechas de cierre
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'estado_publicacion') then
    create type public.estado_publicacion as enum ('borrador', 'publicada', 'archivada');
  end if;
end;
$$;

create table if not exists public.publicaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  tipo tipo_publicacion not null default 'anuncio',
  titulo text not null,
  cuerpo text not null,
  -- Resumen corto para la tarjeta del inicio. Si no se carga, se recorta
  -- el cuerpo al vuelo.
  resumen text,
  estado estado_publicacion not null default 'borrador',
  -- Fijada arriba de todo. Se usa con cuentagotas: si todo esta fijado,
  -- nada esta fijado.
  fijada boolean not null default false,
  fecha_publicacion timestamptz,
  -- Pasada esta fecha deja de aparecer en el inicio, sin borrarse.
  fecha_vencimiento date,
  -- Persona o area a la que refiere: el reconocimiento y la bienvenida
  -- son sobre alguien.
  usuario_referido_id uuid references public.usuarios (id) on delete set null,
  proceso_id uuid references public.procesos (id) on delete set null,
  url_imagen text,
  es_demostracion boolean not null default false,
  creado_por uuid references public.usuarios (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint publicaciones_titulo_minimo check (char_length(btrim(titulo)) >= 5),
  constraint publicaciones_cuerpo_minimo check (char_length(btrim(cuerpo)) >= 10),
  -- Una publicacion publicada necesita fecha: es lo que ordena el muro.
  constraint publicaciones_publicada_con_fecha
    check (estado <> 'publicada' or fecha_publicacion is not null)
);

create index if not exists publicaciones_muro_idx
  on public.publicaciones (empresa_id, estado, fecha_publicacion desc);
create index if not exists publicaciones_tipo_idx on public.publicaciones (empresa_id, tipo);

drop trigger if exists publicaciones_actualizacion on public.publicaciones;
create trigger publicaciones_actualizacion before update on public.publicaciones
  for each row execute function public.marcar_actualizacion();

-- ---------------------------------------------------------------------
-- Al publicar se sella la fecha, y al volver a borrador se suelta.
-- Se hace en la base y no en la aplicacion para que valga tambien si la
-- escritura viene del panel de Supabase o de un script.
-- ---------------------------------------------------------------------
create or replace function public.sellar_fecha_publicacion()
returns trigger
language plpgsql
as $$
begin
  if new.estado = 'publicada' and new.fecha_publicacion is null then
    new.fecha_publicacion := now();
  end if;

  if new.estado = 'borrador' then
    new.fecha_publicacion := null;
    new.fijada := false;
  end if;

  return new;
end;
$$;

drop trigger if exists publicaciones_sellar_fecha on public.publicaciones;
create trigger publicaciones_sellar_fecha
  before insert or update on public.publicaciones
  for each row execute function public.sellar_fecha_publicacion();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.publicaciones enable row level security;

-- Todos leen lo publicado de su empresa. El borrador solo lo ve quien lo
-- escribe y quien gestiona: un comunicado a medio redactar no debe
-- aparecer en el inicio de cuarenta y nueve personas.
drop policy if exists "publicaciones_lectura" on public.publicaciones;
create policy "publicaciones_lectura" on public.publicaciones
  for select to authenticated
  using (
    public.misma_empresa(empresa_id)
    and (
      estado = 'publicada'
      or creado_por = auth.uid()
      or public.puede_gestionar()
      or public.es_direccion()
    )
  );

drop policy if exists "publicaciones_gestion" on public.publicaciones;
create policy "publicaciones_gestion" on public.publicaciones
  for all to authenticated
  using (public.puede_gestionar() and public.misma_empresa(empresa_id))
  with check (public.puede_gestionar() and public.misma_empresa(empresa_id));

-- Los permisos de tabla van aparte de las politicas: sin el grant,
-- PostgreSQL corta antes de llegar a evaluarlas y la pantalla queda
-- vacia sin decir por que.
grant select, insert, update, delete on public.publicaciones to authenticated;

-- ---------------------------------------------------------------------
-- Trazabilidad: quien publico que y cuando es informacion sensible en
-- una comunicacion interna.
-- ---------------------------------------------------------------------
drop trigger if exists bitacora_publicaciones on public.publicaciones;
create trigger bitacora_publicaciones
  after insert or update or delete on public.publicaciones
  for each row execute function public.registrar_bitacora();

-- ---------------------------------------------------------------------
-- Cumpleanos y aniversarios del mes.
--
-- No son publicaciones: se calculan del legajo. La vista devuelve el dia
-- del mes para poder ordenarlos, y los anos cumplidos en la empresa.
--
-- security_invoker deja que se apliquen las politicas de "usuarios": la
-- vista no puede mostrar mas de lo que la persona ya podria consultar.
-- ---------------------------------------------------------------------
create or replace view public.vista_efemerides
with (security_invoker = on)
as
select
  u.id,
  u.nombre_completo,
  u.url_avatar,
  u.empresa_id,
  p.nombre           as puesto,
  'cumpleanos'::text as motivo,
  extract(month from u.fecha_nacimiento)::int as mes,
  extract(day   from u.fecha_nacimiento)::int as dia,
  null::int          as anos
from public.usuarios u
left join public.puestos p on p.id = u.puesto_id
where u.activo and u.fecha_nacimiento is not null

union all

select
  u.id,
  u.nombre_completo,
  u.url_avatar,
  u.empresa_id,
  p.nombre         as puesto,
  'aniversario'::text,
  extract(month from u.fecha_ingreso)::int,
  extract(day   from u.fecha_ingreso)::int,
  -- Aniversario cero no se festeja: quien entro este ano no aparece.
  nullif(extract(year from current_date) - extract(year from u.fecha_ingreso), 0)::int
from public.usuarios u
left join public.puestos p on p.id = u.puesto_id
where u.activo
  and u.fecha_ingreso is not null
  and extract(year from current_date) > extract(year from u.fecha_ingreso);

grant select on public.vista_efemerides to authenticated;

comment on view public.vista_efemerides is
  'Cumpleanos y aniversarios de ingreso del personal activo, para el inicio de la intranet.';


-- =====================================================================
-- MIGRACION: 20260825000300_perfiles_de_puesto.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 022 · Perfil, competencia y funciones del puesto (formulario R-02-01)
-- =====================================================================
-- La tabla "puestos" nacio con lo minimo: codigo, nombre, area y mision.
-- Alcanzaba para la matriz de competencias, pero no para lo que pidio
-- Direccion: que cada persona pueda leer su perfil y el de los demas.
--
-- Los campos que se agregan no son una invencion: son los del formulario
-- R-02-01 que Camping 44 ya usa, uno por uno. Modelar otra cosa
-- obligaria a Calidad a mantener dos versiones del mismo perfil.
--
-- "url_documento" guarda el enlace al archivo original en Drive. La
-- intranet no reemplaza ese archivo: lo muestra y enlaza. Duplicar el
-- contenido garantiza que en dos meses haya dos versiones y nadie sepa
-- cual rige, que es justamente el problema a resolver.

alter table public.puestos
  -- Identificacion del formulario, para que la ficha se lea igual que el papel.
  add column if not exists codigo_formulario text not null default 'R-02-01',
  add column if not exists revision smallint not null default 0,

  -- Linea de reporte declarada en el perfil. Es texto y no una referencia
  -- a otro puesto a proposito: el documento dice "Gerente Administrativo
  -- y Financiero" aunque ese puesto todavia no este cargado, y perder esa
  -- informacion por no tener a donde apuntarla seria peor.
  add column if not exists supervisado_por text,
  add column if not exists reemplazado_por text,

  add column if not exists responsabilidades_generales text,
  -- Una funcion por elemento: asi se listan, se cuentan y se comparan
  -- entre puestos sin tener que partir un parrafo.
  add column if not exists funciones text[] not null default '{}',

  add column if not exists formacion_academica text,
  add column if not exists formacion_complementaria text,
  add column if not exists experiencia text,

  -- "Otros requerimientos" del formulario. Son casilleros de si o no.
  add column if not exists requiere_registro_conducir boolean not null default false,
  add column if not exists requiere_movilidad_propia boolean not null default false,
  add column if not exists requiere_viajes_interior boolean not null default false,
  add column if not exists requiere_viajes_exterior boolean not null default false,
  add column if not exists requiere_horario_extendido boolean not null default false,

  -- Enlace al documento original. La intranet muestra, no reemplaza.
  add column if not exists url_documento text;

comment on column public.puestos.funciones is
  'Funciones propias del puesto, una por elemento, tal como figuran en el R-02-01.';
comment on column public.puestos.supervisado_por is
  'Puesto del que depende, en el texto del perfil. La jerarquia operativa vive en usuarios.superior_id.';
comment on column public.puestos.url_documento is
  'Enlace al R-02-01 original. La intranet enlaza el archivo vigente en lugar de duplicarlo.';

create index if not exists puestos_area_idx on public.puestos (empresa_id, area);


-- =====================================================================
-- MIGRACION: 20260825000400_documentos_enlazados.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 023 · Documentos: enlace al archivo vigente y tipo "plan"
-- =====================================================================
-- Direccion pidio un repositorio de procedimientos vigentes con numero de
-- version y fecha, para que nadie use la version equivocada.
--
-- La forma barata de resolverlo mal seria subir una copia de cada archivo
-- a la intranet. En dos meses habria dos versiones de cada documento y
-- nadie sabria cual rige, que es exactamente el problema a evitar.
--
-- La intranet es el indice: codigo, titulo, version, fecha y estado. El
-- archivo sigue viviendo donde ya vive, y se enlaza. Cuando Calidad lo
-- actualiza ahi, la intranet muestra lo nuevo sin hacer nada.

alter table public.documentos
  add column if not exists url_documento text;

comment on column public.documentos.url_documento is
  'Enlace al archivo vigente. La intranet indexa y enlaza; no duplica el contenido.';

-- El juego documental de Camping 44 incluye planes, que el enum no
-- contemplaba: el "PLAN-IT-04 Plan de Contingencia Informatica" no es un
-- procedimiento ni un manual.
alter type public.tipo_documento add value if not exists 'plan';


-- =====================================================================
-- MIGRACION: 20260825000500_documentos_sin_codigo.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- Documentos sin codigo controlado
-- =====================================================================
-- Al cargar la unidad compartida del SGC aparecio un caso que el esquema
-- no contemplaba: no todos los documentos vigentes tienen codigo.
--
-- Los manuales de proceso, los formularios y los protocolos si lo tienen
-- (MP-SOP-01, F-SOP-05-01, P-SOP-01-01). En cambio la Matriz FODA, la
-- Matriz de Partes Interesadas, el Alcance del SGC, la Politica de
-- Calidad, el Proposito, Mision y Vision, los Valores Institucionales,
-- la Politica de Garantia y la Estructura Organizacional no lo llevan:
-- el documento se identifica por su titulo, su version y su vigencia.
-- Se verifico abriendo los archivos, no suponiendolo por el nombre.
--
-- Antes que inventarles un codigo -- que despues circularia como si
-- fuera el oficial -- se permite que la columna quede vacia. Cuando
-- Calidad los codifique, se completa y el formato vuelve a exigirse.
--
-- El alta desde la interfaz sigue pidiendo codigo: un documento nuevo
-- nace codificado. La columna vacia es para lo que ya existe asi.

alter table public.documentos
  alter column codigo drop not null;

-- El formato se sigue exigiendo cuando hay codigo. El indice unico ya
-- trata los nulos como distintos entre si, de modo que varios
-- documentos sin codigo conviven sin chocar.
alter table public.documentos
  drop constraint if exists documentos_codigo_formato;

alter table public.documentos
  add constraint documentos_codigo_formato
  check (codigo is null or codigo ~ '^[A-Z]{1,4}(-[A-Z0-9]{1,4}){1,4}$')
  not valid;

-- Se valida aparte para que la migracion se pueda volver a correr sin
-- chocar: el `drop constraint if exists` de arriba la quita primero.
alter table public.documentos validate constraint documentos_codigo_formato;


-- =====================================================================
-- MIGRACION: 20260825000600_busqueda_documentos_sin_codigo.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- Busqueda global: documentos sin codigo controlado
-- =====================================================================
-- La busqueda por subcadena concatenaba codigo y titulo. Con un codigo
-- vacio la concatenacion entera es null, la comparacion tambien, y el
-- documento solo aparecia si acertaba el tsquery: buscar "garant" no
-- encontraba la Politica de Garantia, aunque buscar "garantia" si.
--
-- Se rehace la funcion con coalesce sobre el codigo. Es lo unico que
-- cambia respecto de 20260824001500_busqueda_global.sql.

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
    where d.busqueda @@ c.tsq or lower(unaccent(coalesce(d.codigo, '') || ' ' || d.titulo)) like c.patron

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


-- =====================================================================
-- MIGRACION: 20260825000700_evaluacion_proveedores_segun_formulario.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- Evaluacion de proveedores segun el formulario F-SOP-08-01
-- =====================================================================
-- La evaluacion se habia construido con cinco criterios inventados
-- (calidad, plazo de entrega, precio, servicio de posventa y
-- documentacion) porque todavia no se conocia el formulario real.
--
-- El formulario vigente, F-SOP-08-01 "Evaluacion de Asociados de Negocio
-- y Proveedores" Ver. 00 del 25/05/2026, usa cuatro:
--
--   Calidad · Logistica · Legal · Servicio
--
-- Se alinea el sistema al formulario. Con cuatro criterios de 1 a 5 el
-- maximo es 20, asi que el factor de escala a la nota de 0 a 100 pasa de
-- 4 a 5. Los cortes 80 / 60 no cambian.
--
-- Los criterios viejos se traducen a los nuevos para no perder las
-- evaluaciones ya cargadas:
--
--   calidad          → calidad     (se queda como esta)
--   plazo_entrega    → logistica   (el plazo es la parte medible de la logistica)
--   documentacion    → legal       (documentacion y cumplimiento formal)
--   servicio_posventa→ servicio    (posventa es servicio)
--   precio           → se pierde   (el formulario no lo evalua)
--
-- El formulario ademas pregunta "¿De que manera afecta a la calidad de
-- los articulos/servicios de la empresa?" por cada proveedor. Es una
-- columna propia y no una observacion suelta: es el fundamento de por
-- que ese proveedor se evalua.

-- ---------------------------------------------------------------------
-- 1 · Columnas nuevas, con el valor traducido del criterio viejo
-- ---------------------------------------------------------------------
alter table public.proveedor_evaluaciones
  add column if not exists logistica smallint,
  add column if not exists legal smallint,
  add column if not exists servicio smallint;

-- La traduccion solo tiene sentido mientras existan las columnas
-- viejas. En una base ya migrada esto no hace nada, que es lo que
-- permite volver a correr el archivo entero sin romperlo.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'proveedor_evaluaciones'
       and column_name = 'plazo_entrega'
  ) then
    update public.proveedor_evaluaciones set
      logistica = coalesce(logistica, plazo_entrega),
      legal     = coalesce(legal, documentacion),
      servicio  = coalesce(servicio, servicio_posventa);
  end if;
end;
$$;

alter table public.proveedor_evaluaciones
  alter column logistica set not null,
  alter column legal set not null,
  alter column servicio set not null;

-- ---------------------------------------------------------------------
-- 2 · El puntaje se recalcula sobre los cuatro criterios
-- ---------------------------------------------------------------------
-- Una columna generada no se puede redefinir: se quita y se vuelve a
-- crear. El disparador que copia el puntaje al proveedor no cambia.
--
-- Se hace solo si todavia esta la formula vieja, para que volver a
-- correr la migracion no tire la columna buena.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'proveedor_evaluaciones'
       and column_name = 'plazo_entrega'
  ) then
    alter table public.proveedor_evaluaciones drop column puntaje;

    alter table public.proveedor_evaluaciones
      add column puntaje numeric(5, 2) generated always as (
        (calidad + logistica + legal + servicio) * 5.0
      ) stored;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 3 · Fuera los criterios que el formulario no usa
-- ---------------------------------------------------------------------
alter table public.proveedor_evaluaciones
  drop constraint if exists proveedor_evaluaciones_plazo,
  drop constraint if exists proveedor_evaluaciones_precio,
  drop constraint if exists proveedor_evaluaciones_servicio,
  drop constraint if exists proveedor_evaluaciones_documentacion;

alter table public.proveedor_evaluaciones
  drop column if exists plazo_entrega,
  drop column if exists precio,
  drop column if exists servicio_posventa,
  drop column if exists documentacion;

-- Se quitan antes de agregarlas: asi la migracion se puede repetir.
alter table public.proveedor_evaluaciones
  drop constraint if exists proveedor_evaluaciones_logistica,
  drop constraint if exists proveedor_evaluaciones_legal,
  drop constraint if exists proveedor_evaluaciones_servicio;

alter table public.proveedor_evaluaciones
  add constraint proveedor_evaluaciones_logistica check (logistica between 1 and 5),
  add constraint proveedor_evaluaciones_legal     check (legal between 1 and 5),
  add constraint proveedor_evaluaciones_servicio  check (servicio between 1 and 5);

-- ---------------------------------------------------------------------
-- 4 · El impacto del proveedor sobre la calidad
-- ---------------------------------------------------------------------
alter table public.proveedores
  add column if not exists impacto_en_calidad text;

comment on column public.proveedores.impacto_en_calidad is
  'Respuesta a "¿De que manera afecta a la calidad de los articulos/servicios '
  'de la empresa?" del formulario F-SOP-08-01.';

-- ---------------------------------------------------------------------
-- 5 · Reconciliar lo que dependia del puntaje viejo
-- ---------------------------------------------------------------------
-- El resultado y la calificacion del proveedor son valores guardados,
-- no calculados: quedaron con la nota de cinco criterios. Se recalculan
-- con la escala del formulario, la misma que aplica `resultadoSugerido`
-- en `lib/proveedores.ts`.

update public.proveedor_evaluaciones set
  resultado = case
    when puntaje >= 80 then 'aprobado'::public.estado_proveedor
    when puntaje >= 60 then 'condicional'::public.estado_proveedor
    else 'rechazado'::public.estado_proveedor
  end;

update public.proveedores p set
  calificacion_actual = e.puntaje,
  estado = e.resultado
 from (
   select distinct on (proveedor_id) proveedor_id, puntaje, resultado
     from public.proveedor_evaluaciones
    order by proveedor_id, fecha desc, creado_en desc
 ) e
 where e.proveedor_id = p.id;

