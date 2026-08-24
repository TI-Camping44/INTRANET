-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 002 · Tablas base: empresas, sedes, normas, procesos, puestos, usuarios
-- =====================================================================

-- ---------------------------------------------------------------------
-- Funcion utilitaria: mantiene actualizado el campo "actualizado_en".
-- ---------------------------------------------------------------------
create or replace function public.marcar_actualizacion()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Empresas. Camping 44 y Vitalica comparten el mismo espacio de trabajo
-- de Google, por eso el modelo contempla la empresa desde el inicio.
-- Hoy solo Camping 44 opera en el sistema.
-- ---------------------------------------------------------------------
create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  razon_social text not null,
  ruc text,
  activa boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index empresas_nombre_unico on public.empresas (lower(nombre));

-- ---------------------------------------------------------------------
-- Sedes / locales
-- ---------------------------------------------------------------------
create table public.sedes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nombre text not null,
  direccion text,
  ciudad text,
  telefono text,
  activa boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index sedes_empresa_idx on public.sedes (empresa_id);

-- ---------------------------------------------------------------------
-- Normas de referencia del sistema de gestion
-- ---------------------------------------------------------------------
create table public.normas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  nombre text not null,
  version text,
  descripcion text,
  vigente boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index normas_codigo_unico on public.normas (lower(codigo));

-- ---------------------------------------------------------------------
-- Procesos del mapa de procesos.
-- responsable_id se enlaza a usuarios mas abajo (referencia circular).
-- ---------------------------------------------------------------------
create table public.procesos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  codigo text not null,
  nombre text not null,
  tipo tipo_proceso not null default 'operativo',
  descripcion text,
  responsable_id uuid,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index procesos_codigo_unico on public.procesos (empresa_id, lower(codigo));
create index procesos_responsable_idx on public.procesos (responsable_id);

-- ---------------------------------------------------------------------
-- Puestos de trabajo (modulo Recursos Humanos, tambien usado por usuarios)
-- ---------------------------------------------------------------------
create table public.puestos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  codigo text not null,
  nombre text not null,
  area text,
  proceso_id uuid references public.procesos (id) on delete set null,
  mision text,
  reporta_a_puesto_id uuid references public.puestos (id) on delete set null,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index puestos_codigo_unico on public.puestos (empresa_id, lower(codigo));

-- ---------------------------------------------------------------------
-- Usuarios. El identificador es el mismo de auth.users, de modo que las
-- politicas RLS puedan comparar directamente contra auth.uid().
-- El campo "superior_id" sostiene el escalamiento de no conformidades.
-- ---------------------------------------------------------------------
create table public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  correo text not null,
  nombre_completo text not null,
  rol rol_usuario not null default 'colaborador',
  puesto_id uuid references public.puestos (id) on delete set null,
  proceso_id uuid references public.procesos (id) on delete set null,
  superior_id uuid references public.usuarios (id) on delete set null,
  telefono text,
  url_avatar text,
  activo boolean not null default true,
  ultimo_ingreso timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index usuarios_correo_unico on public.usuarios (lower(correo));
create index usuarios_empresa_idx on public.usuarios (empresa_id);
create index usuarios_superior_idx on public.usuarios (superior_id);
create index usuarios_proceso_idx on public.usuarios (proceso_id);

-- Cierre de la referencia circular procesos -> usuarios.
alter table public.procesos
  add constraint procesos_responsable_fk
  foreign key (responsable_id) references public.usuarios (id) on delete set null;

-- ---------------------------------------------------------------------
-- Clientes (usado por Satisfaccion del Cliente y No Conformidades)
-- ---------------------------------------------------------------------
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  codigo text,
  razon_social text not null,
  ruc text,
  correo text,
  telefono text,
  ciudad text,
  activo boolean not null default true,
  es_demostracion boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index clientes_empresa_idx on public.clientes (empresa_id);

-- ---------------------------------------------------------------------
-- Disparadores de actualizacion
-- ---------------------------------------------------------------------
create trigger empresas_actualizacion before update on public.empresas
  for each row execute function public.marcar_actualizacion();
create trigger sedes_actualizacion before update on public.sedes
  for each row execute function public.marcar_actualizacion();
create trigger normas_actualizacion before update on public.normas
  for each row execute function public.marcar_actualizacion();
create trigger procesos_actualizacion before update on public.procesos
  for each row execute function public.marcar_actualizacion();
create trigger puestos_actualizacion before update on public.puestos
  for each row execute function public.marcar_actualizacion();
create trigger usuarios_actualizacion before update on public.usuarios
  for each row execute function public.marcar_actualizacion();
create trigger clientes_actualizacion before update on public.clientes
  for each row execute function public.marcar_actualizacion();
