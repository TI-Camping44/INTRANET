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
create type public.tipo_publicacion as enum (
  'anuncio',          -- comunicado interno
  'novedad_producto', -- lanzamientos, para que comercial se entere antes
  'logro',            -- licitaciones ganadas, records, certificaciones
  'reconocimiento',   -- a una persona o a un area
  'bienvenida',       -- nuevos ingresos
  'evento'            -- ferias, feriados, fechas de cierre
);

create type public.estado_publicacion as enum ('borrador', 'publicada', 'archivada');

create table public.publicaciones (
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

create index publicaciones_muro_idx
  on public.publicaciones (empresa_id, estado, fecha_publicacion desc);
create index publicaciones_tipo_idx on public.publicaciones (empresa_id, tipo);

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
