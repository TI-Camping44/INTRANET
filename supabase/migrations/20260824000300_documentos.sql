-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 003 · Modulo 1: Control de Informacion Documentada
-- =====================================================================

-- ---------------------------------------------------------------------
-- Documentos. El codigo es controlado y sigue el formato acordado con
-- Calidad: MP-SOP-01 (manuales y procedimientos) o F-COM-01-02
-- (formularios). Se valida el formato general y la unicidad por empresa.
-- ---------------------------------------------------------------------
create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  codigo text not null,
  titulo text not null,
  descripcion text,
  tipo tipo_documento not null default 'procedimiento',
  estado estado_documento not null default 'borrador',
  proceso_id uuid references public.procesos (id) on delete set null,
  norma_id uuid references public.normas (id) on delete set null,
  responsable_id uuid not null references public.usuarios (id) on delete restrict,
  elaborador_id uuid references public.usuarios (id) on delete set null,
  aprobador_id uuid references public.usuarios (id) on delete set null,
  version_actual integer not null default 0,
  fecha_aprobacion date,
  fecha_vigencia date,
  fecha_proxima_revision date,
  periodicidad_revision_meses integer not null default 12,
  es_demostracion boolean not null default false,
  creado_por uuid references public.usuarios (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint documentos_codigo_formato
    check (codigo ~ '^[A-Z]{1,4}(-[A-Z0-9]{1,4}){1,4}$'),
  constraint documentos_version_valida check (version_actual >= 0),
  constraint documentos_periodicidad_valida
    check (periodicidad_revision_meses between 1 and 60)
);

create unique index documentos_codigo_unico on public.documentos (empresa_id, upper(codigo));
create index documentos_estado_idx on public.documentos (empresa_id, estado);
create index documentos_proceso_idx on public.documentos (proceso_id);
create index documentos_responsable_idx on public.documentos (responsable_id);
create index documentos_proxima_revision_idx on public.documentos (fecha_proxima_revision)
  where estado = 'vigente';

-- Indice de texto completo en espanol para la busqueda global.
alter table public.documentos add column busqueda tsvector
  generated always as (
    to_tsvector('spanish',
      coalesce(codigo, '') || ' ' || coalesce(titulo, '') || ' ' || coalesce(descripcion, ''))
  ) stored;

create index documentos_busqueda_idx on public.documentos using gin (busqueda);

-- ---------------------------------------------------------------------
-- Versiones. El versionado es automatico: v00 es el borrador inicial y
-- cada aprobacion incrementa la version. La version anterior queda
-- consultable como historico, requisito de ISO 9001 7.5.3.
-- ---------------------------------------------------------------------
create table public.documento_versiones (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.documentos (id) on delete cascade,
  version integer not null,
  etiqueta text generated always as ('v' || lpad(version::text, 2, '0')) stored,
  estado estado_documento not null default 'borrador',
  resumen_cambios text,
  ruta_archivo text,
  nombre_archivo text,
  tamano_bytes bigint,
  tipo_mime text,
  elaborado_por uuid references public.usuarios (id) on delete set null,
  aprobado_por uuid references public.usuarios (id) on delete set null,
  fecha_aprobacion timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint documento_versiones_version_valida check (version >= 0)
);

create unique index documento_versiones_unico
  on public.documento_versiones (documento_id, version);
create index documento_versiones_documento_idx
  on public.documento_versiones (documento_id, version desc);

-- ---------------------------------------------------------------------
-- Revisores asignados a una version concreta. El flujo es
-- elaboracion -> revision (uno o mas revisores) -> aprobacion (uno).
-- ---------------------------------------------------------------------
create table public.documento_revisores (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.documento_versiones (id) on delete cascade,
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  estado estado_revision not null default 'pendiente',
  comentario text,
  fecha_respuesta timestamptz,
  creado_en timestamptz not null default now()
);

create unique index documento_revisores_unico
  on public.documento_revisores (version_id, usuario_id);
create index documento_revisores_usuario_idx
  on public.documento_revisores (usuario_id, estado);

-- ---------------------------------------------------------------------
-- Lista de difusion: usuarios alcanzados por el documento. Se les
-- notifica cada vez que se publica una version nueva.
-- ---------------------------------------------------------------------
create table public.documento_difusion (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.documentos (id) on delete cascade,
  usuario_id uuid references public.usuarios (id) on delete cascade,
  proceso_id uuid references public.procesos (id) on delete cascade,
  creado_en timestamptz not null default now(),

  -- Se alcanza a una persona o a todo un proceso, no a ambos a la vez.
  constraint documento_difusion_destino
    check (num_nonnulls(usuario_id, proceso_id) = 1)
);

create unique index documento_difusion_usuario_unico
  on public.documento_difusion (documento_id, usuario_id)
  where usuario_id is not null;
create unique index documento_difusion_proceso_unico
  on public.documento_difusion (documento_id, proceso_id)
  where proceso_id is not null;

create trigger documentos_actualizacion before update on public.documentos
  for each row execute function public.marcar_actualizacion();
create trigger documento_versiones_actualizacion before update on public.documento_versiones
  for each row execute function public.marcar_actualizacion();

-- ---------------------------------------------------------------------
-- Al aprobar una version se sincroniza la cabecera del documento:
-- version vigente, fechas y estado de las versiones anteriores.
-- ---------------------------------------------------------------------
create or replace function public.sincronizar_documento_al_aprobar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_periodicidad integer;
begin
  if new.estado = 'vigente' and (old.estado is distinct from 'vigente') then
    select periodicidad_revision_meses into v_periodicidad
      from public.documentos where id = new.documento_id;

    -- Las versiones previas pasan a obsoletas, pero siguen consultables.
    update public.documento_versiones
       set estado = 'obsoleto'
     where documento_id = new.documento_id
       and id <> new.id
       and estado <> 'obsoleto';

    update public.documentos
       set estado = 'vigente',
           version_actual = new.version,
           fecha_aprobacion = coalesce(new.fecha_aprobacion::date, current_date),
           fecha_vigencia = coalesce(new.fecha_aprobacion::date, current_date),
           fecha_proxima_revision =
             coalesce(new.fecha_aprobacion::date, current_date)
             + (coalesce(v_periodicidad, 12) || ' months')::interval,
           aprobador_id = coalesce(new.aprobado_por, aprobador_id)
     where id = new.documento_id;
  end if;

  return new;
end;
$$;

create trigger documento_versiones_aprobacion
  after update on public.documento_versiones
  for each row execute function public.sincronizar_documento_al_aprobar();
