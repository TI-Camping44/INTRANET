-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 004 · Modulo 2: No Conformidades y Acciones Correctivas
-- =====================================================================

create table public.no_conformidades (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  codigo text not null,
  titulo text not null,
  descripcion text not null,
  origen origen_no_conformidad not null default 'proceso_interno',
  severidad severidad_no_conformidad not null default 'menor',
  estado estado_no_conformidad not null default 'abierta',
  proceso_id uuid references public.procesos (id) on delete set null,
  sede_id uuid references public.sedes (id) on delete set null,
  norma_id uuid references public.normas (id) on delete set null,
  cliente_id uuid references public.clientes (id) on delete set null,
  requisito_incumplido text,
  correccion_inmediata text,
  conclusion_causa_raiz text,
  detectado_por uuid references public.usuarios (id) on delete set null,
  responsable_id uuid references public.usuarios (id) on delete set null,
  fecha_deteccion date not null default current_date,
  fecha_limite_cierre date,
  fecha_cierre date,
  cerrado_por uuid references public.usuarios (id) on delete set null,
  eficacia resultado_eficacia not null default 'pendiente',
  observacion_eficacia text,
  -- Vinculo con el modulo de Riesgos cuando el analisis de causa raiz
  -- revela un riesgo que no estaba contemplado en la matriz.
  riesgo_id uuid,
  es_demostracion boolean not null default false,
  creado_por uuid references public.usuarios (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint no_conformidades_codigo_formato check (codigo ~ '^NC-[0-9]{4}-[0-9]{3}$')
);

create unique index no_conformidades_codigo_unico
  on public.no_conformidades (empresa_id, upper(codigo));
create index no_conformidades_estado_idx on public.no_conformidades (empresa_id, estado);
create index no_conformidades_proceso_idx on public.no_conformidades (proceso_id);
create index no_conformidades_responsable_idx on public.no_conformidades (responsable_id);
create index no_conformidades_riesgo_idx on public.no_conformidades (riesgo_id);

alter table public.no_conformidades add column busqueda tsvector
  generated always as (
    to_tsvector('spanish',
      coalesce(codigo, '') || ' ' || coalesce(titulo, '') || ' ' ||
      coalesce(descripcion, '') || ' ' || coalesce(requisito_incumplido, ''))
  ) stored;

create index no_conformidades_busqueda_idx on public.no_conformidades using gin (busqueda);

-- ---------------------------------------------------------------------
-- Analisis de causa raiz - 5 porques (cadena ordenada)
-- ---------------------------------------------------------------------
create table public.nc_porques (
  id uuid primary key default gen_random_uuid(),
  no_conformidad_id uuid not null references public.no_conformidades (id) on delete cascade,
  orden integer not null,
  pregunta text not null,
  respuesta text not null,
  creado_en timestamptz not null default now(),

  constraint nc_porques_orden_valido check (orden between 1 and 10)
);

create unique index nc_porques_unico on public.nc_porques (no_conformidad_id, orden);

-- ---------------------------------------------------------------------
-- Analisis de causa raiz - Ishikawa (6M)
-- ---------------------------------------------------------------------
create table public.nc_ishikawa (
  id uuid primary key default gen_random_uuid(),
  no_conformidad_id uuid not null references public.no_conformidades (id) on delete cascade,
  categoria categoria_ishikawa not null,
  causa text not null,
  es_causa_raiz boolean not null default false,
  creado_en timestamptz not null default now()
);

create index nc_ishikawa_nc_idx on public.nc_ishikawa (no_conformidad_id, categoria);

-- ---------------------------------------------------------------------
-- Plan de accion. El escalamiento se apoya en "nivel_escalamiento":
-- 0 sin escalar, 1 notificado el superior, 2 notificado el nivel siguiente.
-- ---------------------------------------------------------------------
create table public.nc_acciones (
  id uuid primary key default gen_random_uuid(),
  no_conformidad_id uuid not null references public.no_conformidades (id) on delete cascade,
  tipo tipo_accion not null default 'accion_correctiva',
  descripcion text not null,
  responsable_id uuid references public.usuarios (id) on delete set null,
  fecha_limite date not null,
  estado estado_accion not null default 'pendiente',
  fecha_ejecucion date,
  evidencia text,
  verificado_por uuid references public.usuarios (id) on delete set null,
  fecha_verificacion date,
  nivel_escalamiento smallint not null default 0,
  fecha_ultima_alerta timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint nc_acciones_escalamiento_valido check (nivel_escalamiento between 0 and 3)
);

create index nc_acciones_nc_idx on public.nc_acciones (no_conformidad_id);
create index nc_acciones_responsable_idx on public.nc_acciones (responsable_id, estado);
create index nc_acciones_vencimiento_idx on public.nc_acciones (fecha_limite)
  where estado in ('pendiente', 'en_curso');

create trigger no_conformidades_actualizacion before update on public.no_conformidades
  for each row execute function public.marcar_actualizacion();
create trigger nc_acciones_actualizacion before update on public.nc_acciones
  for each row execute function public.marcar_actualizacion();

-- ---------------------------------------------------------------------
-- Numeracion correlativa automatica: NC-2026-001.
-- ---------------------------------------------------------------------
create or replace function public.siguiente_codigo_no_conformidad(p_empresa_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anio text := to_char(now() at time zone 'America/Asuncion', 'YYYY');
  v_secuencia integer;
begin
  select coalesce(max(split_part(codigo, '-', 3)::integer), 0) + 1
    into v_secuencia
    from public.no_conformidades
   where empresa_id = p_empresa_id
     and codigo like 'NC-' || v_anio || '-%';

  return 'NC-' || v_anio || '-' || lpad(v_secuencia::text, 3, '0');
end;
$$;
