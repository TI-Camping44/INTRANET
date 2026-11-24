-- ---------------------------------------------------------------------
-- Informática · Seguimiento de tickets, y lo que le faltaba al registro
-- de avances
--
-- «AVANCES Y CAMBIOS» GUARDA EL NÚMERO DE TICKET PERO NO MUESTRA EL
-- TICKET. Qué se pidió, qué se hizo y el historial de comentarios viven
-- en la ticketera de TI —la planilla «TICKETS - BASE», que se alimenta
-- del formulario de Apps Script— y solo los abre el Responsable de TI.
-- Esta migración trae la ticketera a la intranet como ESPEJO de solo
-- lectura y le suma al registro de avances cuatro datos que pide un
-- cambio en un sistema y no tenía dónde quedar: en qué entorno se hizo,
-- quién lo pidió o lo aprobó, cómo se vuelve atrás y cómo se verificó.
--
--   tickets_ti              espejo de la ticketera. NO SE CARGA ACÁ: la
--                           base sigue siendo la planilla.
--   ticket_ti_comentarios   espejo de la pestaña Comentarios.
--   avances_ti              cuatro columnas nuevas, todas opcionales
--                           salvo el entorno, que arranca en producción.
--
-- LA SINCRONIZACIÓN LA EMPUJA LA PLANILLA, NO LA TIRA LA INTRANET. La
-- ticketera tiene correos y descripciones de pedidos internos, así que
-- publicarla en la web como CSV —que es como se lee la planilla de
-- ventas— la dejaría abierta a cualquiera con el enlace. En cambio, un
-- Apps Script de la propia ticketera llama a `recibir_ticketera()` con
-- un secreto. La función es `SECURITY DEFINER` y se habilita a `anon`
-- porque quien llama no tiene sesión; lo que la protege es el secreto,
-- que en la base se guarda solo como hash (`secretos_de_integracion`).
--
-- Las tablas espejo NO van a la bitácora: no son el registro, son una
-- copia de la planilla que se reescribe en cada sincronización.
--
-- Y SE BORRA `cambios_ti`. Se armó el mismo 24 de noviembre como un
-- segundo registro de cambios, en paralelo a `avances_ti`, sin saber que
-- ese ya existía; se descartó antes de publicarse, vacío, y lo que tenía
-- de distinto son justamente las cuatro columnas que pasan a `avances_ti`.
--
-- Módulo `informatica`, el mismo de los controles y los avances.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1. Secretos de las integraciones
--
-- Una fila por integración, con el hash SHA-256 del secreto. RLS activo
-- y sin políticas ni grant: solo la leen las funciones SECURITY DEFINER.
-- ---------------------------------------------------------------------

create table if not exists public.secretos_de_integracion (
  nombre text primary key,
  hash_secreto text not null,
  descripcion text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table public.secretos_de_integracion enable row level security;
revoke all on public.secretos_de_integracion from anon, authenticated;

comment on table public.secretos_de_integracion is
  'Hash SHA-256 de los secretos con que se identifican las integraciones '
  'externas (por ejemplo, la ticketera de TI). Sin políticas: solo la leen '
  'funciones SECURITY DEFINER.';

-- ---------------------------------------------------------------------
-- 2. Los tickets
-- ---------------------------------------------------------------------

create table if not exists public.tickets_ti (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  numero text not null,
  fecha_solicitud timestamptz,
  solicitante_correo text,
  area text,
  tipo_solicitud text,
  categoria text,
  prioridad text,
  descripcion text,
  adjunto text,
  impacto text,
  estado text,
  responsable_correo text,
  fecha_inicio date,
  fecha_cierre date,
  fecha_comprometida date,
  observaciones text,
  avance smallint,
  sincronizado_en timestamptz not null default now(),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index if not exists tickets_ti_numero_unico
  on public.tickets_ti (empresa_id, numero);

alter table public.tickets_ti drop constraint if exists tickets_ti_avance;
alter table public.tickets_ti add constraint tickets_ti_avance
  check (avance is null or avance between 0 and 100);

comment on table public.tickets_ti is
  'Espejo de la ticketera de TI (planilla TICKETS - BASE). Lo escribe '
  'solo recibir_ticketera(); la base es la planilla.';

create table if not exists public.ticket_ti_comentarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  numero_ticket text not null,
  fecha timestamptz,
  autor_correo text,
  mensaje text not null,
  -- Identifica la fila de la planilla para no duplicarla: el IdMensaje
  -- si lo tiene, y si no, un hash de fecha, ticket y mensaje.
  clave text not null,
  sincronizado_en timestamptz not null default now(),
  creado_en timestamptz not null default now()
);

create unique index if not exists ticket_ti_comentarios_clave_unica
  on public.ticket_ti_comentarios (empresa_id, clave);

create index if not exists ticket_ti_comentarios_por_ticket
  on public.ticket_ti_comentarios (empresa_id, numero_ticket, fecha);

comment on table public.ticket_ti_comentarios is
  'Espejo de la pestaña Comentarios de la ticketera de TI: lo que se hizo '
  'en cada ticket, con su fecha.';

-- Estado de la última sincronización, para que la pantalla diga de
-- cuándo es el dato y si el último intento falló.
create table if not exists public.ticketera_sincronizacion (
  empresa_id uuid primary key references public.empresas (id) on delete cascade,
  tickets integer not null default 0,
  comentarios integer not null default 0,
  actualizado_en timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. Disparadores
-- ---------------------------------------------------------------------

-- `tickets_ti` NO lleva `marcar_actualizacion()`: la sincronización
-- toca todas las filas para marcarlas como vistas, y con el disparador
-- `actualizado_en` diría cuándo corrió la sincronización y no cuándo
-- cambió el ticket. Lo escribe `recibir_ticketera()`, solo si algo cambió.


-- ---------------------------------------------------------------------
-- 4. RLS y grant
--
-- Las tablas espejo son de solo lectura para la interfaz: las escribe
-- únicamente `recibir_ticketera()`. Por eso a `authenticated` se le da
-- solo `select`.
-- ---------------------------------------------------------------------

alter table public.tickets_ti enable row level security;
alter table public.ticket_ti_comentarios enable row level security;
alter table public.ticketera_sincronizacion enable row level security;

revoke all on public.tickets_ti from anon;
revoke all on public.ticket_ti_comentarios from anon;
revoke all on public.ticketera_sincronizacion from anon;

grant select on public.tickets_ti to authenticated;
grant select on public.ticket_ti_comentarios to authenticated;
grant select on public.ticketera_sincronizacion to authenticated;

drop policy if exists tickets_ti_lectura on public.tickets_ti;
create policy tickets_ti_lectura on public.tickets_ti
  for select to authenticated
  using (public.misma_empresa(empresa_id) and public.puede_ver('informatica'));

drop policy if exists ticket_ti_comentarios_lectura on public.ticket_ti_comentarios;
create policy ticket_ti_comentarios_lectura on public.ticket_ti_comentarios
  for select to authenticated
  using (public.misma_empresa(empresa_id) and public.puede_ver('informatica'));

drop policy if exists ticketera_sincronizacion_lectura on public.ticketera_sincronizacion;
create policy ticketera_sincronizacion_lectura on public.ticketera_sincronizacion
  for select to authenticated
  using (public.misma_empresa(empresa_id) and public.puede_ver('informatica'));


-- ---------------------------------------------------------------------
-- 5. La recepción de la ticketera
--
-- La llama el Apps Script de la planilla con todas las filas. Deja el
-- espejo igual a la planilla: inserta lo nuevo, actualiza lo que cambió
-- y borra lo que ya no está. ES REINTENTABLE: llamarla dos veces seguidas
-- con lo mismo no duplica ni cambia nada.
--
-- Solo actualiza una fila si algo cambió (`is distinct from`), así
-- `actualizado_en` dice cuándo cambió el ticket y no cuándo corrió la
-- sincronización.
-- ---------------------------------------------------------------------

create or replace function public.recibir_ticketera(
  p_secreto text,
  p_tickets jsonb,
  p_comentarios jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_empresa uuid;
  v_marca timestamptz := now();
  v_tickets integer;
  v_comentarios integer;
begin
  select hash_secreto into v_hash
    from public.secretos_de_integracion
   where nombre = 'ticketera_ti';

  if v_hash is null
     or p_secreto is null
     or encode(sha256(convert_to(p_secreto, 'UTF8')), 'hex') <> v_hash then
    raise exception 'Secreto de integración inválido.' using errcode = '28000';
  end if;

  if jsonb_typeof(p_tickets) <> 'array' or jsonb_typeof(p_comentarios) <> 'array' then
    raise exception 'Se esperaban dos listas: tickets y comentarios.';
  end if;

  -- La ticketera es de Camping 44: el inquilino de toda la intranet.
  select id into v_empresa from public.empresas order by creado_en limit 1;

  -- Tickets: una fila por número. Las filas sin número —las que el
  -- formulario todavía no numeró— no entran.
  with entrada as (
    select distinct on (trim(t->>'numero'))
      trim(t->>'numero') as numero,
      nullif(t->>'fecha_solicitud', '')::timestamptz as fecha_solicitud,
      nullif(trim(t->>'solicitante_correo'), '') as solicitante_correo,
      nullif(trim(t->>'area'), '') as area,
      nullif(trim(t->>'tipo_solicitud'), '') as tipo_solicitud,
      nullif(trim(t->>'categoria'), '') as categoria,
      nullif(trim(t->>'prioridad'), '') as prioridad,
      nullif(trim(t->>'descripcion'), '') as descripcion,
      nullif(trim(t->>'adjunto'), '') as adjunto,
      nullif(trim(t->>'impacto'), '') as impacto,
      nullif(trim(t->>'estado'), '') as estado,
      nullif(trim(t->>'responsable_correo'), '') as responsable_correo,
      nullif(t->>'fecha_inicio', '')::date as fecha_inicio,
      nullif(t->>'fecha_cierre', '')::date as fecha_cierre,
      nullif(t->>'fecha_comprometida', '')::date as fecha_comprometida,
      nullif(t->>'observaciones', '') as observaciones,
      case
        when (t->>'avance') ~ '^[0-9]+(\.[0-9]+)?$'
          then least(greatest(round((t->>'avance')::numeric), 0), 100)::smallint
        else null
      end as avance
    from jsonb_array_elements(p_tickets) as t
    where coalesce(trim(t->>'numero'), '') <> ''
    order by trim(t->>'numero')
  )
  insert into public.tickets_ti as d (
    empresa_id, numero, fecha_solicitud, solicitante_correo, area, tipo_solicitud,
    categoria, prioridad, descripcion, adjunto, impacto, estado, responsable_correo,
    fecha_inicio, fecha_cierre, fecha_comprometida, observaciones, avance, sincronizado_en
  )
  select v_empresa, numero, fecha_solicitud, solicitante_correo, area, tipo_solicitud,
         categoria, prioridad, descripcion, adjunto, impacto, estado, responsable_correo,
         fecha_inicio, fecha_cierre, fecha_comprometida, observaciones, avance, v_marca
    from entrada
  on conflict (empresa_id, numero) do update set
    fecha_solicitud = excluded.fecha_solicitud,
    solicitante_correo = excluded.solicitante_correo,
    area = excluded.area,
    tipo_solicitud = excluded.tipo_solicitud,
    categoria = excluded.categoria,
    prioridad = excluded.prioridad,
    descripcion = excluded.descripcion,
    adjunto = excluded.adjunto,
    impacto = excluded.impacto,
    estado = excluded.estado,
    responsable_correo = excluded.responsable_correo,
    fecha_inicio = excluded.fecha_inicio,
    fecha_cierre = excluded.fecha_cierre,
    fecha_comprometida = excluded.fecha_comprometida,
    observaciones = excluded.observaciones,
    avance = excluded.avance,
    sincronizado_en = excluded.sincronizado_en,
    actualizado_en = v_marca
  where (d.fecha_solicitud, d.solicitante_correo, d.area, d.tipo_solicitud, d.categoria,
         d.prioridad, d.descripcion, d.adjunto, d.impacto, d.estado, d.responsable_correo,
         d.fecha_inicio, d.fecha_cierre, d.fecha_comprometida, d.observaciones, d.avance)
        is distinct from
        (excluded.fecha_solicitud, excluded.solicitante_correo, excluded.area,
         excluded.tipo_solicitud, excluded.categoria, excluded.prioridad, excluded.descripcion,
         excluded.adjunto, excluded.impacto, excluded.estado, excluded.responsable_correo,
         excluded.fecha_inicio, excluded.fecha_cierre, excluded.fecha_comprometida,
         excluded.observaciones, excluded.avance);

  -- Las que no cambiaron igual quedan marcadas como vistas en esta
  -- vuelta, para no borrarlas abajo.
  update public.tickets_ti
     set sincronizado_en = v_marca
   where empresa_id = v_empresa
     and numero in (
       select trim(t->>'numero') from jsonb_array_elements(p_tickets) as t
        where coalesce(trim(t->>'numero'), '') <> ''
     )
     and sincronizado_en <> v_marca;

  -- Lo que ya no está en la planilla se borra: un ticket que se eliminó
  -- allá no puede seguir apareciendo acá como si existiera.
  delete from public.tickets_ti
   where empresa_id = v_empresa and sincronizado_en < v_marca;

  -- Comentarios: se identifican por su clave.
  with entrada as (
    select distinct on (clave) *
    from (
      select
        trim(c->>'numero_ticket') as numero_ticket,
        nullif(c->>'fecha', '')::timestamptz as fecha,
        nullif(trim(c->>'autor_correo'), '') as autor_correo,
        c->>'mensaje' as mensaje,
        coalesce(
          nullif(trim(c->>'id_mensaje'), ''),
          md5(coalesce(c->>'fecha', '') || '|' || coalesce(c->>'numero_ticket', '') || '|' ||
              coalesce(c->>'mensaje', ''))
        ) as clave
      from jsonb_array_elements(p_comentarios) as c
      where coalesce(trim(c->>'numero_ticket'), '') <> ''
        and coalesce(trim(c->>'mensaje'), '') <> ''
    ) as filas
    order by clave
  )
  insert into public.ticket_ti_comentarios as d (
    empresa_id, numero_ticket, fecha, autor_correo, mensaje, clave, sincronizado_en
  )
  select v_empresa, numero_ticket, fecha, autor_correo, mensaje, clave, v_marca
    from entrada
  on conflict (empresa_id, clave) do update set
    numero_ticket = excluded.numero_ticket,
    fecha = excluded.fecha,
    autor_correo = excluded.autor_correo,
    mensaje = excluded.mensaje,
    sincronizado_en = excluded.sincronizado_en;

  delete from public.ticket_ti_comentarios
   where empresa_id = v_empresa and sincronizado_en < v_marca;

  select count(*) into v_tickets from public.tickets_ti where empresa_id = v_empresa;
  select count(*) into v_comentarios from public.ticket_ti_comentarios where empresa_id = v_empresa;

  insert into public.ticketera_sincronizacion (empresa_id, tickets, comentarios, actualizado_en)
  values (v_empresa, v_tickets, v_comentarios, v_marca)
  on conflict (empresa_id) do update set
    tickets = excluded.tickets,
    comentarios = excluded.comentarios,
    actualizado_en = excluded.actualizado_en;

  return jsonb_build_object('tickets', v_tickets, 'comentarios', v_comentarios, 'en', v_marca);
end;
$$;

revoke all on function public.recibir_ticketera(text, jsonb, jsonb) from public;
grant execute on function public.recibir_ticketera(text, jsonb, jsonb) to anon, authenticated;

comment on function public.recibir_ticketera(text, jsonb, jsonb) is
  'La llama el Apps Script de la ticketera de TI para dejar el espejo igual '
  'a la planilla. Protegida por el secreto ticketera_ti.';

-- ---------------------------------------------------------------------
-- 6. Lo que le faltaba al registro de avances
--
-- Las cuatro son de quien registra el cambio, no se calculan. El entorno
-- arranca en producción porque es donde pasa casi todo lo que vale la
-- pena registrar; los registros viejos quedan en producción, que es lo
-- que eran.
-- ---------------------------------------------------------------------

alter table public.avances_ti add column if not exists entorno text not null default 'produccion';
alter table public.avances_ti add column if not exists aprobado_por text;
alter table public.avances_ti add column if not exists como_revertir text;
alter table public.avances_ti add column if not exists verificacion text;

alter table public.avances_ti drop constraint if exists avances_ti_entorno;
alter table public.avances_ti add constraint avances_ti_entorno
  check (entorno in ('produccion', 'pruebas'));

comment on column public.avances_ti.aprobado_por is
  'Quién pidió o aprobó el cambio, y por qué medio. Texto libre: puede no '
  'tener usuario en la intranet.';
comment on column public.avances_ti.como_revertir is
  'Qué hay que hacer para volver atrás y dónde está el respaldo.';
comment on column public.avances_ti.verificacion is
  'Cómo se comprobó que el cambio quedó bien.';

-- ---------------------------------------------------------------------
-- 7. El registro paralelo que se descartó
-- ---------------------------------------------------------------------

drop function if exists public.siguiente_codigo_cambio_ti(uuid);
drop table if exists public.cambios_ti;
