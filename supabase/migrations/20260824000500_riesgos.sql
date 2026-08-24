-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 005 · Modulo 3: Gestion de Riesgos y Oportunidades
-- =====================================================================
-- Matriz 5x5. Nivel = Probabilidad x Impacto (1 a 25).
-- Semaforo acordado con Calidad:
--   1  a  4  -> bajo
--   5  a  9  -> medio
--   10 a 14  -> alto
--   15 a 25  -> critico

create or replace function public.etiqueta_nivel_riesgo(p_nivel integer)
returns text
language sql
immutable
as $$
  select case
    when p_nivel is null then null
    when p_nivel <= 4  then 'bajo'
    when p_nivel <= 9  then 'medio'
    when p_nivel <= 14 then 'alto'
    else 'critico'
  end;
$$;

-- Periodicidad de reevaluacion segun el nivel, en dias.
create or replace function public.dias_reevaluacion_riesgo(p_nivel integer)
returns integer
language sql
immutable
as $$
  select case
    when p_nivel is null then 365
    when p_nivel <= 4  then 365
    when p_nivel <= 9  then 180
    when p_nivel <= 14 then 90
    else 30
  end;
$$;

create table public.riesgos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  codigo text not null,
  titulo text not null,
  descripcion text,
  tipo tipo_riesgo not null default 'riesgo',
  categoria text,
  proceso_id uuid references public.procesos (id) on delete set null,
  responsable_id uuid references public.usuarios (id) on delete set null,
  estado estado_riesgo not null default 'identificado',
  causas text,
  consecuencias text,
  controles_existentes text,
  tratamiento tratamiento_riesgo not null default 'mitigar',

  -- Evaluacion inicial (inherente)
  probabilidad smallint not null default 1,
  impacto smallint not null default 1,
  nivel integer generated always as (probabilidad * impacto) stored,

  -- Evaluacion residual, posterior a las acciones de tratamiento
  probabilidad_residual smallint,
  impacto_residual smallint,
  nivel_residual integer generated always as (probabilidad_residual * impacto_residual) stored,

  fecha_identificacion date not null default current_date,
  fecha_ultima_evaluacion date not null default current_date,
  fecha_proxima_revision date,
  es_demostracion boolean not null default false,
  creado_por uuid references public.usuarios (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint riesgos_codigo_formato check (codigo ~ '^R-[0-9]{4}-[0-9]{3}$'),
  constraint riesgos_probabilidad_valida check (probabilidad between 1 and 5),
  constraint riesgos_impacto_valido check (impacto between 1 and 5),
  constraint riesgos_probabilidad_residual_valida
    check (probabilidad_residual is null or probabilidad_residual between 1 and 5),
  constraint riesgos_impacto_residual_valido
    check (impacto_residual is null or impacto_residual between 1 and 5)
);

create unique index riesgos_codigo_unico on public.riesgos (empresa_id, upper(codigo));
create index riesgos_estado_idx on public.riesgos (empresa_id, estado);
create index riesgos_nivel_idx on public.riesgos (empresa_id, nivel desc);
create index riesgos_proceso_idx on public.riesgos (proceso_id);
create index riesgos_proxima_revision_idx on public.riesgos (fecha_proxima_revision)
  where estado in ('identificado', 'en_tratamiento');

alter table public.riesgos add column busqueda tsvector
  generated always as (
    to_tsvector('spanish',
      coalesce(codigo, '') || ' ' || coalesce(titulo, '') || ' ' ||
      coalesce(descripcion, '') || ' ' || coalesce(categoria, ''))
  ) stored;

create index riesgos_busqueda_idx on public.riesgos using gin (busqueda);

-- Vinculo de vuelta desde No Conformidades (declarado alli sin restriccion
-- para evitar una dependencia circular entre migraciones).
alter table public.no_conformidades
  add constraint no_conformidades_riesgo_fk
  foreign key (riesgo_id) references public.riesgos (id) on delete set null;

-- ---------------------------------------------------------------------
-- Acciones de tratamiento del riesgo
-- ---------------------------------------------------------------------
create table public.riesgo_acciones (
  id uuid primary key default gen_random_uuid(),
  riesgo_id uuid not null references public.riesgos (id) on delete cascade,
  descripcion text not null,
  tratamiento tratamiento_riesgo not null default 'mitigar',
  responsable_id uuid references public.usuarios (id) on delete set null,
  fecha_limite date,
  estado estado_accion not null default 'pendiente',
  fecha_ejecucion date,
  evidencia text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index riesgo_acciones_riesgo_idx on public.riesgo_acciones (riesgo_id);
create index riesgo_acciones_responsable_idx on public.riesgo_acciones (responsable_id, estado);

-- ---------------------------------------------------------------------
-- Historial de evaluaciones. Cada reevaluacion deja registro, de modo que
-- se pueda mostrar la evolucion del riesgo en el tiempo.
-- ---------------------------------------------------------------------
create table public.riesgo_evaluaciones (
  id uuid primary key default gen_random_uuid(),
  riesgo_id uuid not null references public.riesgos (id) on delete cascade,
  fecha date not null default current_date,
  probabilidad smallint not null,
  impacto smallint not null,
  nivel integer generated always as (probabilidad * impacto) stored,
  comentario text,
  evaluado_por uuid references public.usuarios (id) on delete set null,
  creado_en timestamptz not null default now(),

  constraint riesgo_evaluaciones_probabilidad_valida check (probabilidad between 1 and 5),
  constraint riesgo_evaluaciones_impacto_valido check (impacto between 1 and 5)
);

create index riesgo_evaluaciones_riesgo_idx on public.riesgo_evaluaciones (riesgo_id, fecha desc);

create trigger riesgos_actualizacion before update on public.riesgos
  for each row execute function public.marcar_actualizacion();
create trigger riesgo_acciones_actualizacion before update on public.riesgo_acciones
  for each row execute function public.marcar_actualizacion();

-- ---------------------------------------------------------------------
-- La fecha de proxima revision se recalcula sola segun el nivel vigente.
-- ---------------------------------------------------------------------
create or replace function public.calcular_proxima_revision_riesgo()
returns trigger
language plpgsql
as $$
declare
  v_nivel integer := coalesce(new.probabilidad_residual * new.impacto_residual,
                              new.probabilidad * new.impacto);
begin
  if tg_op = 'INSERT'
     or new.probabilidad is distinct from old.probabilidad
     or new.impacto is distinct from old.impacto
     or new.probabilidad_residual is distinct from old.probabilidad_residual
     or new.impacto_residual is distinct from old.impacto_residual
     or new.fecha_proxima_revision is null then
    new.fecha_ultima_evaluacion := current_date;
    new.fecha_proxima_revision :=
      current_date + public.dias_reevaluacion_riesgo(v_nivel);
  end if;

  return new;
end;
$$;

create trigger riesgos_proxima_revision
  before insert or update on public.riesgos
  for each row execute function public.calcular_proxima_revision_riesgo();

-- ---------------------------------------------------------------------
-- Numeracion correlativa automatica: R-2026-001.
-- ---------------------------------------------------------------------
create or replace function public.siguiente_codigo_riesgo(p_empresa_id uuid)
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
    from public.riesgos
   where empresa_id = p_empresa_id
     and codigo like 'R-' || v_anio || '-%';

  return 'R-' || v_anio || '-' || lpad(v_secuencia::text, 3, '0');
end;
$$;
