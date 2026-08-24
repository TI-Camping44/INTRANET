-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 007 · Modulo 5: Indicadores (KPI) y Objetivos
-- =====================================================================
-- Las mediciones se exponen mediante la vista publica
-- "vista_indicadores_looker" para su consumo desde Looker Studio.

create table public.indicadores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  codigo text not null,
  nombre text not null,
  descripcion text,
  proceso_id uuid references public.procesos (id) on delete set null,
  responsable_id uuid references public.usuarios (id) on delete set null,
  formula text,
  unidad text not null default '%',
  frecuencia frecuencia_medicion not null default 'mensual',
  sentido sentido_indicador not null default 'mayor_mejor',
  meta numeric(14, 2),
  meta_minima numeric(14, 2),
  meta_maxima numeric(14, 2),
  activo boolean not null default true,
  es_demostracion boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index indicadores_codigo_unico on public.indicadores (empresa_id, upper(codigo));
create index indicadores_proceso_idx on public.indicadores (proceso_id);

create table public.indicador_mediciones (
  id uuid primary key default gen_random_uuid(),
  indicador_id uuid not null references public.indicadores (id) on delete cascade,
  periodo date not null,             -- primer dia del periodo medido
  valor_real numeric(14, 2) not null,
  meta_periodo numeric(14, 2),
  observacion text,
  cargado_por uuid references public.usuarios (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index indicador_mediciones_unico on public.indicador_mediciones (indicador_id, periodo);
create index indicador_mediciones_periodo_idx on public.indicador_mediciones (periodo desc);

create table public.objetivos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  codigo text not null,
  nombre text not null,
  descripcion text,
  proceso_id uuid references public.procesos (id) on delete set null,
  responsable_id uuid references public.usuarios (id) on delete set null,
  anio integer not null,
  meta text,
  avance_porcentaje numeric(5, 2) not null default 0,
  estado text not null default 'en_curso',
  es_demostracion boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint objetivos_avance_valido check (avance_porcentaje between 0 and 100)
);

create unique index objetivos_codigo_unico on public.objetivos (empresa_id, upper(codigo));

create table public.objetivo_indicadores (
  id uuid primary key default gen_random_uuid(),
  objetivo_id uuid not null references public.objetivos (id) on delete cascade,
  indicador_id uuid not null references public.indicadores (id) on delete cascade
);

create unique index objetivo_indicadores_unico
  on public.objetivo_indicadores (objetivo_id, indicador_id);

create trigger indicadores_actualizacion before update on public.indicadores
  for each row execute function public.marcar_actualizacion();
create trigger indicador_mediciones_actualizacion before update on public.indicador_mediciones
  for each row execute function public.marcar_actualizacion();
create trigger objetivos_actualizacion before update on public.objetivos
  for each row execute function public.marcar_actualizacion();

-- ---------------------------------------------------------------------
-- Vista de consumo para Looker Studio. Entrega la medicion ya comparada
-- contra la meta, para no repetir la logica del semaforo fuera del SGC.
-- ---------------------------------------------------------------------
-- security_invoker: la vista respeta las politicas RLS de quien consulta.
create or replace view public.vista_indicadores_looker
  with (security_invoker = on) as
select
  m.id                                as medicion_id,
  i.empresa_id,
  e.nombre                            as empresa,
  i.codigo                            as indicador_codigo,
  i.nombre                            as indicador,
  p.nombre                            as proceso,
  i.unidad,
  i.frecuencia::text                  as frecuencia,
  i.sentido::text                     as sentido,
  m.periodo,
  extract(year from m.periodo)::int   as anio,
  extract(month from m.periodo)::int  as mes,
  m.valor_real,
  coalesce(m.meta_periodo, i.meta)    as meta,
  case
    when coalesce(m.meta_periodo, i.meta) is null then null
    when i.sentido = 'mayor_mejor' then m.valor_real >= coalesce(m.meta_periodo, i.meta)
    when i.sentido = 'menor_mejor' then m.valor_real <= coalesce(m.meta_periodo, i.meta)
    else m.valor_real between coalesce(i.meta_minima, '-Infinity'::numeric)
                          and coalesce(i.meta_maxima, 'Infinity'::numeric)
  end                                 as cumple_meta,
  m.observacion
from public.indicador_mediciones m
join public.indicadores i on i.id = m.indicador_id
join public.empresas e on e.id = i.empresa_id
left join public.procesos p on p.id = i.proceso_id;
