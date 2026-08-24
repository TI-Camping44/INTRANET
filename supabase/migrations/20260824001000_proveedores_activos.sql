-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 010 · Modulos 8 y 9: Proveedores / Infraestructura y Activos
-- =====================================================================

-- ---------------------------------------------------------------------
-- Proveedores. La calificacion es el promedio ponderado de la ultima
-- evaluacion; la reevaluacion es periodica segun criticidad.
-- ---------------------------------------------------------------------
create table public.proveedores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  codigo text not null,
  razon_social text not null,
  nombre_comercial text,
  ruc text,
  rubro text,
  critico boolean not null default false,
  correo text,
  telefono text,
  ciudad text,
  pais text default 'Paraguay',
  contacto text,
  estado estado_proveedor not null default 'en_evaluacion',
  calificacion_actual numeric(5, 2),
  fecha_ultima_evaluacion date,
  fecha_proxima_evaluacion date,
  periodicidad_evaluacion_meses integer not null default 12,
  observaciones text,
  es_demostracion boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint proveedores_periodicidad_valida
    check (periodicidad_evaluacion_meses between 1 and 60)
);

create unique index proveedores_codigo_unico on public.proveedores (empresa_id, upper(codigo));
create index proveedores_estado_idx on public.proveedores (empresa_id, estado);

alter table public.proveedores add column busqueda tsvector
  generated always as (
    to_tsvector('spanish',
      coalesce(codigo, '') || ' ' || coalesce(razon_social, '') || ' ' ||
      coalesce(nombre_comercial, '') || ' ' || coalesce(rubro, '') || ' ' ||
      coalesce(ruc, ''))
  ) stored;

create index proveedores_busqueda_idx on public.proveedores using gin (busqueda);

-- Evaluacion con cinco criterios de 1 a 5; el puntaje se calcula solo.
create table public.proveedor_evaluaciones (
  id uuid primary key default gen_random_uuid(),
  proveedor_id uuid not null references public.proveedores (id) on delete cascade,
  fecha date not null default current_date,
  periodo text,
  calidad smallint not null,
  plazo_entrega smallint not null,
  precio smallint not null,
  servicio_posventa smallint not null,
  documentacion smallint not null,
  puntaje numeric(5, 2) generated always as (
    (calidad + plazo_entrega + precio + servicio_posventa + documentacion) * 4.0
  ) stored,                                  -- escala resultante: 0 a 100
  resultado estado_proveedor,
  comentario text,
  evaluado_por uuid references public.usuarios (id) on delete set null,
  creado_en timestamptz not null default now(),

  constraint proveedor_evaluaciones_calidad check (calidad between 1 and 5),
  constraint proveedor_evaluaciones_plazo check (plazo_entrega between 1 and 5),
  constraint proveedor_evaluaciones_precio check (precio between 1 and 5),
  constraint proveedor_evaluaciones_servicio check (servicio_posventa between 1 and 5),
  constraint proveedor_evaluaciones_documentacion check (documentacion between 1 and 5)
);

create index proveedor_evaluaciones_proveedor_idx
  on public.proveedor_evaluaciones (proveedor_id, fecha desc);

-- ---------------------------------------------------------------------
-- Activos e infraestructura
-- ---------------------------------------------------------------------
create table public.activos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  codigo text not null,
  nombre text not null,
  categoria text,
  descripcion text,
  sede_id uuid references public.sedes (id) on delete set null,
  ubicacion text,
  responsable_id uuid references public.usuarios (id) on delete set null,
  proveedor_id uuid references public.proveedores (id) on delete set null,
  numero_serie text,
  marca text,
  modelo text,
  estado estado_activo not null default 'operativo',
  fecha_adquisicion date,
  valor_gs bigint,                          -- guaranies, sin decimales
  requiere_mantenimiento boolean not null default false,
  frecuencia_mantenimiento_dias integer,
  fecha_ultimo_mantenimiento date,
  fecha_proximo_mantenimiento date,
  es_demostracion boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint activos_frecuencia_valida
    check (frecuencia_mantenimiento_dias is null or frecuencia_mantenimiento_dias > 0)
);

create unique index activos_codigo_unico on public.activos (empresa_id, upper(codigo));
create index activos_sede_idx on public.activos (sede_id);
create index activos_proximo_mantenimiento_idx on public.activos (fecha_proximo_mantenimiento)
  where requiere_mantenimiento;

create table public.mantenimientos (
  id uuid primary key default gen_random_uuid(),
  activo_id uuid not null references public.activos (id) on delete cascade,
  tipo tipo_mantenimiento not null default 'preventivo',
  descripcion text,
  fecha_programada date not null,
  fecha_ejecucion date,
  responsable_id uuid references public.usuarios (id) on delete set null,
  proveedor_id uuid references public.proveedores (id) on delete set null,
  estado estado_mantenimiento not null default 'programado',
  costo_gs bigint not null default 0,
  observacion text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index mantenimientos_activo_idx on public.mantenimientos (activo_id, fecha_programada desc);
create index mantenimientos_programados_idx on public.mantenimientos (fecha_programada)
  where estado = 'programado';

create trigger proveedores_actualizacion before update on public.proveedores
  for each row execute function public.marcar_actualizacion();
create trigger activos_actualizacion before update on public.activos
  for each row execute function public.marcar_actualizacion();
create trigger mantenimientos_actualizacion before update on public.mantenimientos
  for each row execute function public.marcar_actualizacion();

-- Al registrar una evaluacion se actualiza la calificacion del proveedor.
create or replace function public.sincronizar_calificacion_proveedor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_periodicidad integer;
begin
  select periodicidad_evaluacion_meses into v_periodicidad
    from public.proveedores where id = new.proveedor_id;

  update public.proveedores
     set calificacion_actual = new.puntaje,
         estado = coalesce(new.resultado, estado),
         fecha_ultima_evaluacion = new.fecha,
         fecha_proxima_evaluacion =
           new.fecha + (coalesce(v_periodicidad, 12) || ' months')::interval
   where id = new.proveedor_id;

  return new;
end;
$$;

create trigger proveedor_evaluaciones_sincronizacion
  after insert on public.proveedor_evaluaciones
  for each row execute function public.sincronizar_calificacion_proveedor();
