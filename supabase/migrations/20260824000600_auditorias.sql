-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 006 · Modulo 4: Auditorias Internas
-- =====================================================================
-- Esquema completo. La interfaz de este modulo se construye despues del
-- 31/08/2026; por ahora la pantalla es de consulta.

create table public.programas_auditoria (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  anio integer not null,
  nombre text not null,
  objetivo text,
  estado estado_auditoria not null default 'planificada',
  aprobado_por uuid references public.usuarios (id) on delete set null,
  fecha_aprobacion date,
  es_demostracion boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint programas_auditoria_anio_valido check (anio between 2000 and 2100)
);

create unique index programas_auditoria_unico on public.programas_auditoria (empresa_id, anio);

create table public.auditorias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  programa_id uuid references public.programas_auditoria (id) on delete set null,
  codigo text not null,
  tipo tipo_auditoria not null default 'interna',
  proceso_id uuid references public.procesos (id) on delete set null,
  norma_id uuid references public.normas (id) on delete set null,
  sede_id uuid references public.sedes (id) on delete set null,
  auditor_lider_id uuid references public.usuarios (id) on delete set null,
  objetivo text,
  alcance text,
  criterios text,
  fecha_planificada date,
  fecha_inicio date,
  fecha_fin date,
  estado estado_auditoria not null default 'planificada',
  conclusiones text,
  es_demostracion boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index auditorias_codigo_unico on public.auditorias (empresa_id, upper(codigo));
create index auditorias_programa_idx on public.auditorias (programa_id);
create index auditorias_estado_idx on public.auditorias (empresa_id, estado);

create table public.auditoria_equipo (
  id uuid primary key default gen_random_uuid(),
  auditoria_id uuid not null references public.auditorias (id) on delete cascade,
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  rol_equipo text not null default 'auditor',
  creado_en timestamptz not null default now()
);

create unique index auditoria_equipo_unico on public.auditoria_equipo (auditoria_id, usuario_id);

-- Los hallazgos pueden generar automaticamente una No Conformidad.
create table public.auditoria_hallazgos (
  id uuid primary key default gen_random_uuid(),
  auditoria_id uuid not null references public.auditorias (id) on delete cascade,
  codigo text,
  tipo tipo_hallazgo not null default 'observacion',
  requisito text,
  descripcion text not null,
  evidencia text,
  proceso_id uuid references public.procesos (id) on delete set null,
  no_conformidad_id uuid references public.no_conformidades (id) on delete set null,
  registrado_por uuid references public.usuarios (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index auditoria_hallazgos_auditoria_idx on public.auditoria_hallazgos (auditoria_id);
create index auditoria_hallazgos_nc_idx on public.auditoria_hallazgos (no_conformidad_id);

create trigger programas_auditoria_actualizacion before update on public.programas_auditoria
  for each row execute function public.marcar_actualizacion();
create trigger auditorias_actualizacion before update on public.auditorias
  for each row execute function public.marcar_actualizacion();
create trigger auditoria_hallazgos_actualizacion before update on public.auditoria_hallazgos
  for each row execute function public.marcar_actualizacion();
