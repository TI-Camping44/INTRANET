-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 009 · Modulo 7: Recursos Humanos
-- =====================================================================
-- La tabla "puestos" se creo en la migracion 002 porque los usuarios la
-- referencian. Aqui se agregan competencias, capacitaciones y eficacia.

create table public.competencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  codigo text not null,
  nombre text not null,
  descripcion text,
  tipo text not null default 'tecnica',   -- tecnica | conductual | legal
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index competencias_codigo_unico on public.competencias (empresa_id, upper(codigo));

-- Matriz de competencias: nivel requerido por puesto (escala 1 a 5).
create table public.puesto_competencias (
  id uuid primary key default gen_random_uuid(),
  puesto_id uuid not null references public.puestos (id) on delete cascade,
  competencia_id uuid not null references public.competencias (id) on delete cascade,
  nivel_requerido smallint not null default 3,
  critica boolean not null default false,

  constraint puesto_competencias_nivel_valido check (nivel_requerido between 1 and 5)
);

create unique index puesto_competencias_unico
  on public.puesto_competencias (puesto_id, competencia_id);

-- Evaluacion de la persona frente a la competencia. La brecha se calcula
-- sola y alimenta el plan de capacitacion.
create table public.evaluaciones_competencia (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  competencia_id uuid not null references public.competencias (id) on delete cascade,
  nivel_actual smallint not null,
  nivel_requerido smallint not null,
  brecha smallint generated always as (nivel_requerido - nivel_actual) stored,
  fecha date not null default current_date,
  evaluado_por uuid references public.usuarios (id) on delete set null,
  observacion text,
  creado_en timestamptz not null default now(),

  constraint evaluaciones_competencia_actual_valido check (nivel_actual between 0 and 5),
  constraint evaluaciones_competencia_requerido_valido check (nivel_requerido between 1 and 5)
);

create index evaluaciones_competencia_usuario_idx
  on public.evaluaciones_competencia (usuario_id, fecha desc);

create table public.capacitaciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  codigo text not null,
  nombre text not null,
  descripcion text,
  tipo tipo_capacitacion not null default 'interna',
  proveedor_nombre text,
  instructor text,
  fecha_inicio date,
  fecha_fin date,
  horas numeric(6, 2),
  costo_gs bigint not null default 0,       -- guaranies, sin decimales
  estado estado_capacitacion not null default 'planificada',
  competencia_id uuid references public.competencias (id) on delete set null,
  es_demostracion boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index capacitaciones_codigo_unico on public.capacitaciones (empresa_id, upper(codigo));

create table public.capacitacion_participantes (
  id uuid primary key default gen_random_uuid(),
  capacitacion_id uuid not null references public.capacitaciones (id) on delete cascade,
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  asistio boolean not null default false,
  calificacion numeric(5, 2),
  eficacia resultado_eficacia not null default 'pendiente',
  fecha_evaluacion_eficacia date,
  observacion text,
  creado_en timestamptz not null default now()
);

create unique index capacitacion_participantes_unico
  on public.capacitacion_participantes (capacitacion_id, usuario_id);

create trigger competencias_actualizacion before update on public.competencias
  for each row execute function public.marcar_actualizacion();
create trigger capacitaciones_actualizacion before update on public.capacitaciones
  for each row execute function public.marcar_actualizacion();
