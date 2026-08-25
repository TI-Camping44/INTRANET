-- =====================================================================
-- Intranet SGC · Camping 44 S.A.
-- INSTALACION COMPLETA EN UN SOLO ARCHIVO
-- =====================================================================
-- Este archivo se genera con scripts/generar-instalacion.sh y reune, en
-- orden, todas las migraciones de supabase/migrations/ mas el seed de
-- datos de demostracion.
--
-- Para que sirve: montar una instancia nueva de Supabase de una sola
-- pegada en el editor SQL, sin instalar la CLI ni tener acceso directo a
-- la base. Es lo que se usa para la demostracion.
--
-- COMO SE USA
--   1. Panel de Supabase → SQL Editor → New query.
--   2. Pegue TODO este archivo y ejecute (Run).
--   3. Deberia terminar con el aviso "Datos de demostracion cargados".
--
-- ADVERTENCIA
--   Carga datos de demostracion, marcados con es_demostracion = true.
--   Para borrarlos mas adelante, vea la seccion correspondiente del
--   README. Para una instancia de produccion sin datos de ejemplo,
--   corte este archivo antes del bloque "SEED".
--
-- El archivo NO se edita a mano: se regenera.
-- =====================================================================


-- =====================================================================
-- MIGRACION: 20260824000100_extensiones_y_tipos.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 001 · Extensiones y tipos enumerados
-- =====================================================================
-- Todo el esquema esta en espanol: nombres de tablas, columnas y tipos.
-- Zona horaria de referencia del negocio: America/Asuncion.

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "unaccent";

-- ---------------------------------------------------------------------
-- Roles del sistema. Los permisos se resuelven en RLS, no en la interfaz.
-- ---------------------------------------------------------------------
create type public.rol_usuario as enum (
  'administrador_sgc',    -- Calidad. Control total del sistema.
  'responsable_proceso',  -- Escribe sobre los procesos a su cargo.
  'colaborador',          -- Lee documentacion vigente y registra desviaciones.
  'auditor',              -- Lectura amplia y escritura sobre auditorias.
  'direccion'             -- Solo lectura, orientado a indicadores.
);

-- ---------------------------------------------------------------------
-- Control de informacion documentada
-- ---------------------------------------------------------------------
create type public.tipo_documento as enum (
  'manual',
  'procedimiento',
  'instructivo',
  'formulario',
  'politica',
  'registro',
  'externo'
);

create type public.estado_documento as enum (
  'borrador',
  'en_revision',
  'vigente',
  'obsoleto'
);

create type public.estado_revision as enum (
  'pendiente',
  'aprobado',
  'rechazado'
);

-- ---------------------------------------------------------------------
-- No conformidades y acciones
-- ---------------------------------------------------------------------
create type public.origen_no_conformidad as enum (
  'auditoria_interna',
  'auditoria_externa',
  'reclamo_cliente',
  'proceso_interno',
  'proveedor',
  'inspeccion',
  'requisito_legal',
  'otro'
);

create type public.severidad_no_conformidad as enum ('menor', 'mayor', 'critica');

create type public.estado_no_conformidad as enum (
  'abierta',
  'en_analisis',
  'en_tratamiento',
  'en_verificacion',
  'cerrada',
  'anulada'
);

create type public.tipo_accion as enum (
  'correccion',
  'accion_correctiva',
  'accion_preventiva',
  'mejora'
);

create type public.estado_accion as enum (
  'pendiente',
  'en_curso',
  'ejecutada',
  'verificada',
  'cancelada'
);

-- Categorias del diagrama de Ishikawa (6M).
create type public.categoria_ishikawa as enum (
  'metodo',
  'maquina',
  'mano_de_obra',
  'material',
  'medicion',
  'medio_ambiente'
);

-- ---------------------------------------------------------------------
-- Riesgos y oportunidades
-- ---------------------------------------------------------------------
create type public.tipo_riesgo as enum ('riesgo', 'oportunidad');

create type public.estado_riesgo as enum (
  'identificado',
  'en_tratamiento',
  'controlado',
  'materializado',
  'cerrado'
);

create type public.tratamiento_riesgo as enum (
  'evitar',
  'mitigar',
  'transferir',
  'aceptar',
  'explotar'   -- aplica a oportunidades
);

-- ---------------------------------------------------------------------
-- Auditorias
-- ---------------------------------------------------------------------
create type public.tipo_auditoria as enum ('interna', 'externa', 'proveedor', 'seguimiento');

create type public.estado_auditoria as enum (
  'planificada',
  'en_ejecucion',
  'informe_pendiente',
  'cerrada',
  'cancelada'
);

create type public.tipo_hallazgo as enum (
  'no_conformidad_mayor',
  'no_conformidad_menor',
  'observacion',
  'oportunidad_mejora',
  'fortaleza'
);

-- ---------------------------------------------------------------------
-- Indicadores
-- ---------------------------------------------------------------------
create type public.frecuencia_medicion as enum (
  'diaria',
  'semanal',
  'mensual',
  'bimestral',
  'trimestral',
  'semestral',
  'anual'
);

-- Define si un valor alto es bueno (ventas) o malo (reclamos).
create type public.sentido_indicador as enum ('mayor_mejor', 'menor_mejor', 'rango');

-- ---------------------------------------------------------------------
-- Satisfaccion del cliente
-- ---------------------------------------------------------------------
create type public.tipo_encuesta as enum ('nps', 'csat', 'ces', 'personalizada');

-- ---------------------------------------------------------------------
-- Recursos humanos
-- ---------------------------------------------------------------------
create type public.tipo_capacitacion as enum ('interna', 'externa', 'en_linea', 'induccion');

create type public.estado_capacitacion as enum ('planificada', 'en_curso', 'finalizada', 'cancelada');

create type public.resultado_eficacia as enum ('eficaz', 'parcialmente_eficaz', 'no_eficaz', 'pendiente');

-- ---------------------------------------------------------------------
-- Proveedores
-- ---------------------------------------------------------------------
create type public.estado_proveedor as enum (
  'en_evaluacion',
  'aprobado',
  'condicional',
  'rechazado',
  'inactivo'
);

-- ---------------------------------------------------------------------
-- Infraestructura y activos
-- ---------------------------------------------------------------------
create type public.estado_activo as enum (
  'operativo',
  'en_mantenimiento',
  'fuera_de_servicio',
  'dado_de_baja'
);

create type public.tipo_mantenimiento as enum ('preventivo', 'correctivo', 'calibracion', 'verificacion');

create type public.estado_mantenimiento as enum ('programado', 'en_curso', 'ejecutado', 'vencido', 'cancelado');

-- ---------------------------------------------------------------------
-- Transversales
-- ---------------------------------------------------------------------
create type public.tipo_proceso as enum ('estrategico', 'operativo', 'apoyo');

create type public.accion_bitacora as enum ('creacion', 'edicion', 'eliminacion');

create type public.tipo_notificacion as enum (
  'documento_publicado',
  'documento_por_revisar',
  'revision_solicitada',
  'no_conformidad_asignada',
  'accion_por_vencer',
  'accion_vencida',
  'escalamiento',
  'riesgo_por_reevaluar',
  'auditoria_programada',
  'indicador_fuera_de_meta',
  'mantenimiento_programado',
  'general'
);


-- =====================================================================
-- MIGRACION: 20260824000200_tablas_base.sql
-- =====================================================================
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


-- =====================================================================
-- MIGRACION: 20260824000300_documentos.sql
-- =====================================================================
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


-- =====================================================================
-- MIGRACION: 20260824000400_no_conformidades.sql
-- =====================================================================
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


-- =====================================================================
-- MIGRACION: 20260824000500_riesgos.sql
-- =====================================================================
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


-- =====================================================================
-- MIGRACION: 20260824000600_auditorias.sql
-- =====================================================================
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


-- =====================================================================
-- MIGRACION: 20260824000700_indicadores.sql
-- =====================================================================
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


-- =====================================================================
-- MIGRACION: 20260824000800_satisfaccion.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 008 · Modulo 6: Satisfaccion del Cliente
-- =====================================================================
-- Camping 44 ya cuenta con un panel de NPS propio (Apps Script +
-- GitHub Pages). Este modulo NO lo reemplaza: el esquema esta preparado
-- para ingerir esas respuestas mas adelante mediante los campos
-- "fuente_externa" y "referencia_externa".

create table public.encuestas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  codigo text not null,
  nombre text not null,
  tipo tipo_encuesta not null default 'nps',
  descripcion text,
  fecha_inicio date,
  fecha_fin date,
  activa boolean not null default true,
  fuente_externa text,             -- identificador del sistema de origen
  es_demostracion boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index encuestas_codigo_unico on public.encuestas (empresa_id, upper(codigo));

create table public.encuesta_respuestas (
  id uuid primary key default gen_random_uuid(),
  encuesta_id uuid not null references public.encuestas (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete set null,
  fecha date not null default current_date,
  puntaje smallint not null,
  categoria_nps text generated always as (
    case
      when puntaje >= 9 then 'promotor'
      when puntaje >= 7 then 'pasivo'
      else 'detractor'
    end
  ) stored,
  comentario text,
  canal text,
  sede_id uuid references public.sedes (id) on delete set null,
  referencia_externa text,         -- identificador del registro de origen
  creado_en timestamptz not null default now(),

  constraint encuesta_respuestas_puntaje_valido check (puntaje between 0 and 10)
);

create index encuesta_respuestas_encuesta_idx on public.encuesta_respuestas (encuesta_id, fecha desc);
create unique index encuesta_respuestas_externa_unica
  on public.encuesta_respuestas (encuesta_id, referencia_externa)
  where referencia_externa is not null;

create trigger encuestas_actualizacion before update on public.encuestas
  for each row execute function public.marcar_actualizacion();


-- =====================================================================
-- MIGRACION: 20260824000900_recursos_humanos.sql
-- =====================================================================
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


-- =====================================================================
-- MIGRACION: 20260824001000_proveedores_activos.sql
-- =====================================================================
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


-- =====================================================================
-- MIGRACION: 20260824001100_transversales.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 011 · Transversales: adjuntos, notificaciones y bitacora
-- =====================================================================

-- ---------------------------------------------------------------------
-- Adjuntos. Los archivos viven en Supabase Storage; aqui queda el
-- registro con su entidad de origen para el control de acceso.
-- ---------------------------------------------------------------------
create table public.adjuntos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  entidad text not null,             -- 'documentos', 'no_conformidades', 'riesgos', ...
  entidad_id uuid not null,
  nombre_archivo text not null,
  ruta text not null,                -- ruta dentro del bucket
  bucket text not null default 'adjuntos-sgc',
  tamano_bytes bigint not null default 0,
  tipo_mime text,
  descripcion text,
  subido_por uuid references public.usuarios (id) on delete set null,
  creado_en timestamptz not null default now(),

  -- Limite acordado: 20 MB por archivo.
  constraint adjuntos_tamano_maximo check (tamano_bytes <= 20971520)
);

create index adjuntos_entidad_idx on public.adjuntos (entidad, entidad_id);
create unique index adjuntos_ruta_unica on public.adjuntos (bucket, ruta);

-- ---------------------------------------------------------------------
-- Centro de notificaciones dentro de la aplicacion. El envio por correo
-- se marca aparte para no reenviar en cada corrida del job programado.
-- ---------------------------------------------------------------------
create table public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  tipo tipo_notificacion not null default 'general',
  titulo text not null,
  mensaje text not null,
  enlace text,
  entidad text,
  entidad_id uuid,
  leida boolean not null default false,
  leida_en timestamptz,
  requiere_correo boolean not null default true,
  correo_enviado boolean not null default false,
  correo_enviado_en timestamptz,
  -- Evita duplicar la misma alerta en corridas sucesivas del job.
  clave_unicidad text,
  creado_en timestamptz not null default now()
);

create index notificaciones_usuario_idx on public.notificaciones (usuario_id, leida, creado_en desc);
create index notificaciones_pendientes_correo_idx on public.notificaciones (correo_enviado)
  where requiere_correo and not correo_enviado;
create unique index notificaciones_clave_unica on public.notificaciones (usuario_id, clave_unicidad)
  where clave_unicidad is not null;

-- ---------------------------------------------------------------------
-- Bitacora de trazabilidad. Requisito de auditoria ISO 9001: toda
-- creacion, edicion, aprobacion y cambio de estado queda registrada con
-- usuario, fecha/hora y valores anterior y nuevo.
--
-- Se alimenta por disparador a nivel de base de datos, no desde la
-- aplicacion: de ese modo ningun camino de escritura puede evadirla.
-- ---------------------------------------------------------------------
create table public.bitacora (
  id bigint generated always as identity primary key,
  tabla text not null,
  registro_id uuid,
  accion accion_bitacora not null,
  usuario_id uuid,
  usuario_correo text,
  campos_modificados text[],
  valores_anteriores jsonb,
  valores_nuevos jsonb,
  empresa_id uuid,
  creado_en timestamptz not null default now()
);

create index bitacora_tabla_registro_idx on public.bitacora (tabla, registro_id, creado_en desc);
create index bitacora_usuario_idx on public.bitacora (usuario_id, creado_en desc);
create index bitacora_fecha_idx on public.bitacora (creado_en desc);


-- =====================================================================
-- MIGRACION: 20260824001200_funciones_rls.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 012 · Funciones de apoyo para las politicas RLS
-- =====================================================================
-- Todas son SECURITY DEFINER para poder consultar "usuarios" sin quedar
-- atrapadas en la propia politica de esa tabla (recursion infinita).

create or replace function public.rol_actual()
returns rol_usuario
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.usuarios where id = auth.uid() and activo;
$$;

create or replace function public.empresa_actual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select empresa_id from public.usuarios where id = auth.uid() and activo;
$$;

create or replace function public.es_admin_sgc()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.rol_actual() = 'administrador_sgc', false);
$$;

create or replace function public.es_auditor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.rol_actual() = 'auditor', false);
$$;

create or replace function public.es_direccion()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.rol_actual() = 'direccion', false);
$$;

-- Puede escribir sobre el sistema: Calidad y los responsables de proceso.
create or replace function public.puede_gestionar()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.rol_actual() in ('administrador_sgc', 'responsable_proceso'), false);
$$;

-- Verifica si el usuario actual es responsable del proceso indicado.
create or replace function public.es_responsable_de_proceso(p_proceso_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.procesos
     where id = p_proceso_id
       and responsable_id = auth.uid()
  );
$$;

-- Pertenencia a la misma empresa que el registro consultado.
create or replace function public.misma_empresa(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_empresa_id = public.empresa_actual();
$$;

-- ---------------------------------------------------------------------
-- Alta automatica del perfil en el primer ingreso con Google.
-- Valida el dominio del lado del servidor: aunque alguien evada la
-- interfaz, la base rechaza cualquier correo fuera de camping44.com.py.
-- ---------------------------------------------------------------------
create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa_id uuid;
  v_nombre text;
begin
  if new.email is null or lower(split_part(new.email, '@', 2)) <> 'camping44.com.py' then
    raise exception 'Dominio de correo no autorizado: %', coalesce(new.email, '(sin correo)')
      using errcode = '42501';
  end if;

  -- Empresa por defecto del sistema: Camping 44 S.A.
  select id into v_empresa_id
    from public.empresas
   where activa
   order by creado_en
   limit 1;

  if v_empresa_id is null then
    raise exception 'No hay ninguna empresa registrada. Ejecute el seed inicial.';
  end if;

  v_nombre := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(new.email, '@', 1)
  );

  insert into public.usuarios (id, empresa_id, correo, nombre_completo, rol, url_avatar)
  values (
    new.id,
    v_empresa_id,
    lower(new.email),
    v_nombre,
    'colaborador',                      -- el Administrador SGC ajusta el rol
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set nombre_completo = excluded.nombre_completo,
        url_avatar = coalesce(excluded.url_avatar, public.usuarios.url_avatar),
        ultimo_ingreso = now();

  return new;
end;
$$;

create trigger al_crear_usuario_auth
  after insert on auth.users
  for each row execute function public.crear_perfil_usuario();

-- Refuerzo adicional: la tabla de perfiles tampoco admite otro dominio.
create or replace function public.validar_dominio_usuario()
returns trigger
language plpgsql
as $$
begin
  if lower(split_part(new.correo, '@', 2)) <> 'camping44.com.py' then
    raise exception 'Solo se admiten cuentas del dominio camping44.com.py'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger usuarios_validar_dominio
  before insert or update of correo on public.usuarios
  for each row execute function public.validar_dominio_usuario();

-- ---------------------------------------------------------------------
-- Funciones de visibilidad del modulo de documentos.
--
-- Las politicas de "documentos" y de sus tablas hijas se necesitan
-- mutuamente. Si esa consulta cruzada se escribiera dentro de la propia
-- politica, PostgreSQL detectaria una recursion infinita. Al encapsularla
-- en funciones SECURITY DEFINER la evaluacion ocurre fuera de RLS y la
-- regla de negocio queda en un unico lugar.
-- ---------------------------------------------------------------------
create or replace function public.es_revisor_de_documento(p_documento_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.documento_versiones v
      join public.documento_revisores r on r.version_id = v.id
     where v.documento_id = p_documento_id
       and r.usuario_id = auth.uid()
  );
$$;

create or replace function public.puede_ver_documento(p_documento_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.documentos d
     where d.id = p_documento_id
       and d.empresa_id = public.empresa_actual()
       and (
         d.estado = 'vigente'
         or public.es_admin_sgc()
         or public.es_auditor()
         or public.es_direccion()
         or d.responsable_id = auth.uid()
         or d.elaborador_id = auth.uid()
         or d.aprobador_id = auth.uid()
         or d.creado_por = auth.uid()
         or public.es_responsable_de_proceso(d.proceso_id)
         or public.es_revisor_de_documento(d.id)
       )
  );
$$;

create or replace function public.puede_gestionar_documento(p_documento_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.documentos d
     where d.id = p_documento_id
       and d.empresa_id = public.empresa_actual()
       and (
         public.es_admin_sgc()
         or d.responsable_id = auth.uid()
         or d.elaborador_id = auth.uid()
         or public.es_responsable_de_proceso(d.proceso_id)
       )
  );
$$;

create or replace function public.documento_de_version(p_version_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select documento_id from public.documento_versiones where id = p_version_id;
$$;


-- =====================================================================
-- MIGRACION: 20260824001300_politicas_rls.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 013 · Politicas RLS por rol
-- =====================================================================
-- RLS activo en TODAS las tablas, sin excepcion.
-- Criterio general:
--   · Todo registro esta acotado a la empresa del usuario.
--   · Administrador SGC   -> control total.
--   · Responsable Proceso -> escribe sobre lo suyo, lee todo.
--   · Colaborador         -> lee documentacion vigente, registra desviaciones.
--   · Auditor             -> lectura amplia, escritura en auditorias.
--   · Direccion           -> solo lectura.

-- ---------------------------------------------------------------------
-- Habilitacion de RLS
-- ---------------------------------------------------------------------
do $$
declare
  v_tabla text;
begin
  for v_tabla in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', v_tabla);
  end loop;
end;
$$;

-- La aplicacion solo opera con el rol "authenticated"; "anon" no lee nada.
do $$
declare
  v_tabla text;
begin
  for v_tabla in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('revoke all on public.%I from anon', v_tabla);
    execute format('grant select, insert, update, delete on public.%I to authenticated', v_tabla);
  end loop;
end;
$$;

revoke all on public.vista_indicadores_looker from anon;
grant select on public.vista_indicadores_looker to authenticated;

-- ---------------------------------------------------------------------
-- Tablas de configuracion general
-- ---------------------------------------------------------------------
create policy "empresas_lectura" on public.empresas
  for select to authenticated
  using (id = public.empresa_actual());

create policy "empresas_administracion" on public.empresas
  for all to authenticated
  using (public.es_admin_sgc() and id = public.empresa_actual())
  with check (public.es_admin_sgc() and id = public.empresa_actual());

create policy "sedes_lectura" on public.sedes
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "sedes_administracion" on public.sedes
  for all to authenticated
  using (public.es_admin_sgc() and public.misma_empresa(empresa_id))
  with check (public.es_admin_sgc() and public.misma_empresa(empresa_id));

create policy "normas_lectura" on public.normas
  for select to authenticated using (true);
create policy "normas_administracion" on public.normas
  for all to authenticated
  using (public.es_admin_sgc()) with check (public.es_admin_sgc());

create policy "procesos_lectura" on public.procesos
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "procesos_administracion" on public.procesos
  for all to authenticated
  using (public.es_admin_sgc() and public.misma_empresa(empresa_id))
  with check (public.es_admin_sgc() and public.misma_empresa(empresa_id));

create policy "puestos_lectura" on public.puestos
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "puestos_administracion" on public.puestos
  for all to authenticated
  using (public.es_admin_sgc() and public.misma_empresa(empresa_id))
  with check (public.es_admin_sgc() and public.misma_empresa(empresa_id));

-- ---------------------------------------------------------------------
-- Usuarios
-- ---------------------------------------------------------------------
create policy "usuarios_lectura" on public.usuarios
  for select to authenticated
  using (public.misma_empresa(empresa_id) or id = auth.uid());

create policy "usuarios_actualiza_propio" on public.usuarios
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "usuarios_administracion" on public.usuarios
  for all to authenticated
  using (public.es_admin_sgc() and public.misma_empresa(empresa_id))
  with check (public.es_admin_sgc() and public.misma_empresa(empresa_id));

-- Un usuario puede editar su perfil, pero no su propio rol ni su empresa:
-- eso queda reservado al Administrador SGC.
create or replace function public.proteger_campos_criticos_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sin sesion de usuario (clave de servicio, migraciones, seed o el
  -- trabajo programado) la operacion ya es de confianza. Este control
  -- existe para impedir que una persona se eleve el rol editando su
  -- propio perfil desde la aplicacion.
  if auth.uid() is null or public.es_admin_sgc() then
    return new;
  end if;

  if new.rol is distinct from old.rol
     or new.empresa_id is distinct from old.empresa_id
     or new.superior_id is distinct from old.superior_id
     or new.activo is distinct from old.activo then
    raise exception 'Solo el Administrador SGC puede modificar rol, empresa, superior o estado'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger usuarios_proteger_campos
  before update on public.usuarios
  for each row execute function public.proteger_campos_criticos_usuario();

-- ---------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------
create policy "clientes_lectura" on public.clientes
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "clientes_gestion" on public.clientes
  for all to authenticated
  using (public.puede_gestionar() and public.misma_empresa(empresa_id))
  with check (public.puede_gestionar() and public.misma_empresa(empresa_id));

-- ---------------------------------------------------------------------
-- Modulo 1 · Documentos
-- ---------------------------------------------------------------------
-- El colaborador solo ve documentacion vigente; quienes intervienen en el
-- flujo ven tambien los borradores y las versiones en revision.
-- La condicion vive en public.puede_ver_documento (migracion 012) para
-- evitar la recursion entre las politicas de las tablas del modulo.
create policy "documentos_lectura" on public.documentos
  for select to authenticated
  using (
    public.misma_empresa(empresa_id)
    and (
      estado = 'vigente'
      or public.es_admin_sgc()
      or public.es_auditor()
      or public.es_direccion()
      or responsable_id = auth.uid()
      or elaborador_id = auth.uid()
      or aprobador_id = auth.uid()
      or creado_por = auth.uid()
      or public.es_responsable_de_proceso(proceso_id)
      or public.es_revisor_de_documento(id)
    )
  );

create policy "documentos_alta" on public.documentos
  for insert to authenticated
  with check (public.puede_gestionar() and public.misma_empresa(empresa_id));

create policy "documentos_edicion" on public.documentos
  for update to authenticated
  using (
    public.misma_empresa(empresa_id)
    and (public.es_admin_sgc()
         or responsable_id = auth.uid()
         or elaborador_id = auth.uid()
         or public.es_responsable_de_proceso(proceso_id))
  )
  with check (public.misma_empresa(empresa_id));

create policy "documentos_baja" on public.documentos
  for delete to authenticated
  using (public.es_admin_sgc() and public.misma_empresa(empresa_id));

-- Las tablas hijas heredan la visibilidad del documento.
create policy "documento_versiones_lectura" on public.documento_versiones
  for select to authenticated
  using (public.puede_ver_documento(documento_id));

create policy "documento_versiones_gestion" on public.documento_versiones
  for all to authenticated
  using (public.puede_gestionar_documento(documento_id))
  with check (public.puede_gestionar_documento(documento_id));

create policy "documento_revisores_lectura" on public.documento_revisores
  for select to authenticated
  using (
    usuario_id = auth.uid()
    or public.puede_ver_documento(public.documento_de_version(version_id))
  );

-- El revisor responde su propia revision; Calidad administra la asignacion.
create policy "documento_revisores_responde" on public.documento_revisores
  for update to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

create policy "documento_revisores_gestion" on public.documento_revisores
  for all to authenticated
  using (public.puede_gestionar_documento(public.documento_de_version(version_id)))
  with check (public.puede_gestionar_documento(public.documento_de_version(version_id)));

create policy "documento_difusion_lectura" on public.documento_difusion
  for select to authenticated
  using (public.puede_ver_documento(documento_id));

create policy "documento_difusion_gestion" on public.documento_difusion
  for all to authenticated
  using (public.puede_gestionar_documento(documento_id))
  with check (public.puede_gestionar_documento(documento_id));

-- ---------------------------------------------------------------------
-- Modulo 2 · No conformidades
-- ---------------------------------------------------------------------
-- Cualquier colaborador puede registrar una desviacion: es el mecanismo
-- de deteccion del sistema y restringirlo lo dejaria sin uso real.
create policy "no_conformidades_lectura" on public.no_conformidades
  for select to authenticated using (public.misma_empresa(empresa_id));

create policy "no_conformidades_alta" on public.no_conformidades
  for insert to authenticated
  with check (public.misma_empresa(empresa_id) and not public.es_direccion());

create policy "no_conformidades_edicion" on public.no_conformidades
  for update to authenticated
  using (
    public.misma_empresa(empresa_id)
    and (public.es_admin_sgc()
         or responsable_id = auth.uid()
         or detectado_por = auth.uid()
         or public.es_responsable_de_proceso(proceso_id))
  )
  with check (public.misma_empresa(empresa_id));

create policy "no_conformidades_baja" on public.no_conformidades
  for delete to authenticated
  using (public.es_admin_sgc() and public.misma_empresa(empresa_id));

create policy "nc_porques_lectura" on public.nc_porques
  for select to authenticated
  using (exists (select 1 from public.no_conformidades n where n.id = no_conformidad_id));
create policy "nc_porques_gestion" on public.nc_porques
  for all to authenticated
  using (exists (
    select 1 from public.no_conformidades n
     where n.id = no_conformidad_id
       and (public.es_admin_sgc() or n.responsable_id = auth.uid()
            or n.detectado_por = auth.uid()
            or public.es_responsable_de_proceso(n.proceso_id))))
  with check (exists (
    select 1 from public.no_conformidades n
     where n.id = no_conformidad_id
       and (public.es_admin_sgc() or n.responsable_id = auth.uid()
            or n.detectado_por = auth.uid()
            or public.es_responsable_de_proceso(n.proceso_id))));

create policy "nc_ishikawa_lectura" on public.nc_ishikawa
  for select to authenticated
  using (exists (select 1 from public.no_conformidades n where n.id = no_conformidad_id));
create policy "nc_ishikawa_gestion" on public.nc_ishikawa
  for all to authenticated
  using (exists (
    select 1 from public.no_conformidades n
     where n.id = no_conformidad_id
       and (public.es_admin_sgc() or n.responsable_id = auth.uid()
            or n.detectado_por = auth.uid()
            or public.es_responsable_de_proceso(n.proceso_id))))
  with check (exists (
    select 1 from public.no_conformidades n
     where n.id = no_conformidad_id
       and (public.es_admin_sgc() or n.responsable_id = auth.uid()
            or n.detectado_por = auth.uid()
            or public.es_responsable_de_proceso(n.proceso_id))));

create policy "nc_acciones_lectura" on public.nc_acciones
  for select to authenticated
  using (exists (select 1 from public.no_conformidades n where n.id = no_conformidad_id));

-- El responsable de una accion puede actualizar su avance.
create policy "nc_acciones_responsable" on public.nc_acciones
  for update to authenticated
  using (responsable_id = auth.uid())
  with check (responsable_id = auth.uid());

create policy "nc_acciones_gestion" on public.nc_acciones
  for all to authenticated
  using (exists (
    select 1 from public.no_conformidades n
     where n.id = no_conformidad_id
       and (public.es_admin_sgc() or n.responsable_id = auth.uid()
            or public.es_responsable_de_proceso(n.proceso_id))))
  with check (exists (
    select 1 from public.no_conformidades n
     where n.id = no_conformidad_id
       and (public.es_admin_sgc() or n.responsable_id = auth.uid()
            or public.es_responsable_de_proceso(n.proceso_id))));

-- ---------------------------------------------------------------------
-- Modulo 3 · Riesgos
-- ---------------------------------------------------------------------
create policy "riesgos_lectura" on public.riesgos
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "riesgos_alta" on public.riesgos
  for insert to authenticated
  with check (public.puede_gestionar() and public.misma_empresa(empresa_id));
create policy "riesgos_edicion" on public.riesgos
  for update to authenticated
  using (
    public.misma_empresa(empresa_id)
    and (public.es_admin_sgc()
         or responsable_id = auth.uid()
         or public.es_responsable_de_proceso(proceso_id))
  )
  with check (public.misma_empresa(empresa_id));
create policy "riesgos_baja" on public.riesgos
  for delete to authenticated
  using (public.es_admin_sgc() and public.misma_empresa(empresa_id));

create policy "riesgo_acciones_lectura" on public.riesgo_acciones
  for select to authenticated
  using (exists (select 1 from public.riesgos r where r.id = riesgo_id));
create policy "riesgo_acciones_gestion" on public.riesgo_acciones
  for all to authenticated
  using (public.puede_gestionar() or responsable_id = auth.uid())
  with check (public.puede_gestionar() or responsable_id = auth.uid());

create policy "riesgo_evaluaciones_lectura" on public.riesgo_evaluaciones
  for select to authenticated
  using (exists (select 1 from public.riesgos r where r.id = riesgo_id));
create policy "riesgo_evaluaciones_gestion" on public.riesgo_evaluaciones
  for all to authenticated
  using (public.puede_gestionar()) with check (public.puede_gestionar());

-- ---------------------------------------------------------------------
-- Modulo 4 · Auditorias
-- ---------------------------------------------------------------------
create policy "programas_auditoria_lectura" on public.programas_auditoria
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "programas_auditoria_gestion" on public.programas_auditoria
  for all to authenticated
  using ((public.es_admin_sgc() or public.es_auditor()) and public.misma_empresa(empresa_id))
  with check ((public.es_admin_sgc() or public.es_auditor()) and public.misma_empresa(empresa_id));

create policy "auditorias_lectura" on public.auditorias
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "auditorias_gestion" on public.auditorias
  for all to authenticated
  using ((public.es_admin_sgc() or public.es_auditor()) and public.misma_empresa(empresa_id))
  with check ((public.es_admin_sgc() or public.es_auditor()) and public.misma_empresa(empresa_id));

create policy "auditoria_equipo_lectura" on public.auditoria_equipo
  for select to authenticated
  using (exists (select 1 from public.auditorias a where a.id = auditoria_id));
create policy "auditoria_equipo_gestion" on public.auditoria_equipo
  for all to authenticated
  using (public.es_admin_sgc() or public.es_auditor())
  with check (public.es_admin_sgc() or public.es_auditor());

create policy "auditoria_hallazgos_lectura" on public.auditoria_hallazgos
  for select to authenticated
  using (exists (select 1 from public.auditorias a where a.id = auditoria_id));
create policy "auditoria_hallazgos_gestion" on public.auditoria_hallazgos
  for all to authenticated
  using (public.es_admin_sgc() or public.es_auditor())
  with check (public.es_admin_sgc() or public.es_auditor());

-- ---------------------------------------------------------------------
-- Modulo 5 · Indicadores y objetivos
-- ---------------------------------------------------------------------
create policy "indicadores_lectura" on public.indicadores
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "indicadores_gestion" on public.indicadores
  for all to authenticated
  using (public.puede_gestionar() and public.misma_empresa(empresa_id))
  with check (public.puede_gestionar() and public.misma_empresa(empresa_id));

create policy "indicador_mediciones_lectura" on public.indicador_mediciones
  for select to authenticated
  using (exists (select 1 from public.indicadores i where i.id = indicador_id));
create policy "indicador_mediciones_gestion" on public.indicador_mediciones
  for all to authenticated
  using (exists (
    select 1 from public.indicadores i
     where i.id = indicador_id
       and (public.es_admin_sgc() or i.responsable_id = auth.uid()
            or public.es_responsable_de_proceso(i.proceso_id))))
  with check (exists (
    select 1 from public.indicadores i
     where i.id = indicador_id
       and (public.es_admin_sgc() or i.responsable_id = auth.uid()
            or public.es_responsable_de_proceso(i.proceso_id))));

create policy "objetivos_lectura" on public.objetivos
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "objetivos_gestion" on public.objetivos
  for all to authenticated
  using (public.puede_gestionar() and public.misma_empresa(empresa_id))
  with check (public.puede_gestionar() and public.misma_empresa(empresa_id));

create policy "objetivo_indicadores_lectura" on public.objetivo_indicadores
  for select to authenticated
  using (exists (select 1 from public.objetivos o where o.id = objetivo_id));
create policy "objetivo_indicadores_gestion" on public.objetivo_indicadores
  for all to authenticated
  using (public.puede_gestionar()) with check (public.puede_gestionar());

-- ---------------------------------------------------------------------
-- Modulo 6 · Satisfaccion del cliente
-- ---------------------------------------------------------------------
create policy "encuestas_lectura" on public.encuestas
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "encuestas_gestion" on public.encuestas
  for all to authenticated
  using (public.puede_gestionar() and public.misma_empresa(empresa_id))
  with check (public.puede_gestionar() and public.misma_empresa(empresa_id));

create policy "encuesta_respuestas_lectura" on public.encuesta_respuestas
  for select to authenticated
  using (exists (select 1 from public.encuestas e where e.id = encuesta_id));
create policy "encuesta_respuestas_gestion" on public.encuesta_respuestas
  for all to authenticated
  using (public.puede_gestionar()) with check (public.puede_gestionar());

-- ---------------------------------------------------------------------
-- Modulo 7 · Recursos humanos
-- ---------------------------------------------------------------------
create policy "competencias_lectura" on public.competencias
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "competencias_gestion" on public.competencias
  for all to authenticated
  using (public.es_admin_sgc() and public.misma_empresa(empresa_id))
  with check (public.es_admin_sgc() and public.misma_empresa(empresa_id));

create policy "puesto_competencias_lectura" on public.puesto_competencias
  for select to authenticated
  using (exists (select 1 from public.puestos p where p.id = puesto_id));
create policy "puesto_competencias_gestion" on public.puesto_competencias
  for all to authenticated
  using (public.es_admin_sgc()) with check (public.es_admin_sgc());

-- La evaluacion de competencias es informacion sensible: la ve la propia
-- persona, su superior y Calidad.
create policy "evaluaciones_competencia_lectura" on public.evaluaciones_competencia
  for select to authenticated
  using (
    usuario_id = auth.uid()
    or public.es_admin_sgc()
    or exists (select 1 from public.usuarios u
                where u.id = evaluaciones_competencia.usuario_id
                  and u.superior_id = auth.uid())
  );
create policy "evaluaciones_competencia_gestion" on public.evaluaciones_competencia
  for all to authenticated
  using (public.es_admin_sgc()
         or exists (select 1 from public.usuarios u
                     where u.id = evaluaciones_competencia.usuario_id
                       and u.superior_id = auth.uid()))
  with check (public.es_admin_sgc()
         or exists (select 1 from public.usuarios u
                     where u.id = evaluaciones_competencia.usuario_id
                       and u.superior_id = auth.uid()));

create policy "capacitaciones_lectura" on public.capacitaciones
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "capacitaciones_gestion" on public.capacitaciones
  for all to authenticated
  using (public.puede_gestionar() and public.misma_empresa(empresa_id))
  with check (public.puede_gestionar() and public.misma_empresa(empresa_id));

create policy "capacitacion_participantes_lectura" on public.capacitacion_participantes
  for select to authenticated
  using (usuario_id = auth.uid() or public.puede_gestionar() or public.es_auditor()
         or public.es_direccion());
create policy "capacitacion_participantes_gestion" on public.capacitacion_participantes
  for all to authenticated
  using (public.puede_gestionar()) with check (public.puede_gestionar());

-- ---------------------------------------------------------------------
-- Modulos 8 y 9 · Proveedores, activos y mantenimientos
-- ---------------------------------------------------------------------
create policy "proveedores_lectura" on public.proveedores
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "proveedores_gestion" on public.proveedores
  for all to authenticated
  using (public.puede_gestionar() and public.misma_empresa(empresa_id))
  with check (public.puede_gestionar() and public.misma_empresa(empresa_id));

create policy "proveedor_evaluaciones_lectura" on public.proveedor_evaluaciones
  for select to authenticated
  using (exists (select 1 from public.proveedores p where p.id = proveedor_id));
create policy "proveedor_evaluaciones_gestion" on public.proveedor_evaluaciones
  for all to authenticated
  using (public.puede_gestionar()) with check (public.puede_gestionar());

create policy "activos_lectura" on public.activos
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "activos_gestion" on public.activos
  for all to authenticated
  using (public.puede_gestionar() and public.misma_empresa(empresa_id))
  with check (public.puede_gestionar() and public.misma_empresa(empresa_id));

create policy "mantenimientos_lectura" on public.mantenimientos
  for select to authenticated
  using (exists (select 1 from public.activos a where a.id = activo_id));
create policy "mantenimientos_gestion" on public.mantenimientos
  for all to authenticated
  using (public.puede_gestionar() or responsable_id = auth.uid())
  with check (public.puede_gestionar() or responsable_id = auth.uid());

-- ---------------------------------------------------------------------
-- Adjuntos, notificaciones y bitacora
-- ---------------------------------------------------------------------
create policy "adjuntos_lectura" on public.adjuntos
  for select to authenticated using (public.misma_empresa(empresa_id));
create policy "adjuntos_alta" on public.adjuntos
  for insert to authenticated
  with check (public.misma_empresa(empresa_id) and subido_por = auth.uid()
              and not public.es_direccion());
create policy "adjuntos_baja" on public.adjuntos
  for delete to authenticated
  using (public.misma_empresa(empresa_id)
         and (subido_por = auth.uid() or public.es_admin_sgc()));

-- Cada persona ve y marca como leidas unicamente sus notificaciones.
create policy "notificaciones_propias" on public.notificaciones
  for select to authenticated using (usuario_id = auth.uid());
create policy "notificaciones_marcar_leida" on public.notificaciones
  for update to authenticated
  using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "notificaciones_borrar_propias" on public.notificaciones
  for delete to authenticated using (usuario_id = auth.uid());
-- El alta se hace mediante la funcion public.crear_notificacion (migracion 014),
-- que valida que emisor y destinatario pertenezcan a la misma empresa.

-- La bitacora es de solo lectura para Calidad, auditores y Direccion.
-- Nadie puede insertar, editar ni borrar: solo la escribe el disparador.
create policy "bitacora_lectura" on public.bitacora
  for select to authenticated
  using (public.es_admin_sgc() or public.es_auditor() or public.es_direccion());

revoke insert, update, delete on public.bitacora from authenticated;


-- =====================================================================
-- MIGRACION: 20260824001400_bitacora_y_notificaciones.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 014 · Disparadores de bitacora y alta de notificaciones
-- =====================================================================

-- ---------------------------------------------------------------------
-- Registro de trazabilidad. Se aplica a nivel de base de datos para que
-- ningun camino de escritura pueda evadirlo, sea desde la aplicacion,
-- desde un script de migracion o desde el panel de Supabase.
-- ---------------------------------------------------------------------
create or replace function public.registrar_bitacora()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anteriores jsonb;
  v_nuevos jsonb;
  v_campos text[];
  v_registro_id uuid;
  v_empresa_id uuid;
  v_usuario_id uuid := auth.uid();
  v_correo text;
  v_accion accion_bitacora;
begin
  if tg_op = 'INSERT' then
    v_accion := 'creacion';
    v_nuevos := to_jsonb(new);
    v_anteriores := null;
  elsif tg_op = 'UPDATE' then
    v_accion := 'edicion';
    v_nuevos := to_jsonb(new);
    v_anteriores := to_jsonb(old);
  else
    v_accion := 'eliminacion';
    v_nuevos := null;
    v_anteriores := to_jsonb(old);
  end if;

  -- Campos efectivamente modificados, para que la lectura de la bitacora
  -- sea util y no una comparacion manual de dos objetos completos.
  if tg_op = 'UPDATE' then
    select array_agg(clave order by clave)
      into v_campos
      from (
        select key as clave
          from jsonb_each(v_nuevos)
         where key not in ('actualizado_en', 'busqueda')
           and v_anteriores -> key is distinct from v_nuevos -> key
      ) cambios;

    -- Si solo cambiaron marcas internas, no se registra ruido.
    if v_campos is null or array_length(v_campos, 1) is null then
      return coalesce(new, old);
    end if;

    -- Solo se conservan los campos que cambiaron.
    v_anteriores := (
      select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
        from jsonb_each(v_anteriores) where key = any (v_campos));
    v_nuevos := (
      select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
        from jsonb_each(v_nuevos) where key = any (v_campos));
  else
    -- El vector de busqueda es derivado, no aporta a la trazabilidad.
    v_nuevos := v_nuevos - 'busqueda';
    v_anteriores := v_anteriores - 'busqueda';
  end if;

  v_registro_id := nullif(coalesce(v_nuevos, v_anteriores) ->> 'id', '')::uuid;
  if v_registro_id is null then
    v_registro_id := nullif(to_jsonb(coalesce(new, old)) ->> 'id', '')::uuid;
  end if;

  v_empresa_id := nullif(to_jsonb(coalesce(new, old)) ->> 'empresa_id', '')::uuid;

  select correo into v_correo from public.usuarios where id = v_usuario_id;

  insert into public.bitacora (
    tabla, registro_id, accion, usuario_id, usuario_correo,
    campos_modificados, valores_anteriores, valores_nuevos, empresa_id
  ) values (
    tg_table_name, v_registro_id, v_accion, v_usuario_id, v_correo,
    v_campos, v_anteriores, v_nuevos, v_empresa_id
  );

  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------
-- Alta de los disparadores sobre las tablas con valor de auditoria.
-- ---------------------------------------------------------------------
do $$
declare
  v_tabla text;
  v_tablas text[] := array[
    'documentos', 'documento_versiones', 'documento_revisores',
    'no_conformidades', 'nc_acciones', 'nc_porques', 'nc_ishikawa',
    'riesgos', 'riesgo_acciones', 'riesgo_evaluaciones',
    'programas_auditoria', 'auditorias', 'auditoria_hallazgos',
    'indicadores', 'indicador_mediciones', 'objetivos',
    'encuestas',
    'competencias', 'puesto_competencias', 'evaluaciones_competencia',
    'capacitaciones', 'capacitacion_participantes',
    'proveedores', 'proveedor_evaluaciones',
    'activos', 'mantenimientos',
    'procesos', 'puestos', 'sedes', 'usuarios', 'clientes', 'adjuntos'
  ];
begin
  foreach v_tabla in array v_tablas loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.registrar_bitacora()',
      'bitacora_' || v_tabla, v_tabla);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Alta de notificaciones.
--
-- La tabla no admite INSERT directo por politica: se pasa por esta
-- funcion, que valida que emisor y destinatario pertenezcan a la misma
-- empresa y evita duplicar la misma alerta en corridas sucesivas del
-- trabajo programado mediante "clave_unicidad".
-- ---------------------------------------------------------------------
create or replace function public.crear_notificacion(
  p_usuario_id uuid,
  p_tipo tipo_notificacion,
  p_titulo text,
  p_mensaje text,
  p_enlace text default null,
  p_entidad text default null,
  p_entidad_id uuid default null,
  p_clave_unicidad text default null,
  p_requiere_correo boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_empresa_destino uuid;
begin
  select empresa_id into v_empresa_destino
    from public.usuarios where id = p_usuario_id and activo;

  if v_empresa_destino is null then
    return null;   -- destinatario inexistente o inactivo: no es un error
  end if;

  -- Cuando la llama una persona, ambas partes deben ser de la misma empresa.
  if auth.uid() is not null and v_empresa_destino is distinct from public.empresa_actual() then
    raise exception 'No se puede notificar a un usuario de otra empresa'
      using errcode = '42501';
  end if;

  insert into public.notificaciones (
    usuario_id, tipo, titulo, mensaje, enlace, entidad, entidad_id,
    clave_unicidad, requiere_correo
  ) values (
    p_usuario_id, p_tipo, p_titulo, p_mensaje, p_enlace, p_entidad, p_entidad_id,
    p_clave_unicidad, p_requiere_correo
  )
  on conflict (usuario_id, clave_unicidad) where clave_unicidad is not null
  do nothing
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.crear_notificacion(
  uuid, tipo_notificacion, text, text, text, text, uuid, text, boolean
) to authenticated;

-- ---------------------------------------------------------------------
-- Notificacion a la lista de difusion de un documento.
-- Resuelve tanto los destinatarios individuales como los procesos
-- completos alcanzados, sin repetir personas.
-- ---------------------------------------------------------------------
create or replace function public.notificar_difusion_documento(p_documento_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_documento public.documentos%rowtype;
  v_destinatario uuid;
  v_total integer := 0;
begin
  select * into v_documento from public.documentos where id = p_documento_id;
  if not found then
    return 0;
  end if;

  for v_destinatario in
    select distinct u.id
      from public.documento_difusion d
      join public.usuarios u
        on (d.usuario_id = u.id or u.proceso_id = d.proceso_id)
     where d.documento_id = p_documento_id
       and u.activo
       and u.id is not null
  loop
    perform public.crear_notificacion(
      v_destinatario,
      'documento_publicado',
      'Documento actualizado: ' || v_documento.codigo,
      'Se publico la version v' || lpad(v_documento.version_actual::text, 2, '0') ||
        ' de "' || v_documento.titulo || '". Corresponde revisar el contenido vigente.',
      '/documentos/' || p_documento_id,
      'documentos',
      p_documento_id,
      'documento:' || p_documento_id || ':v' || v_documento.version_actual
    );
    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$$;

grant execute on function public.notificar_difusion_documento(uuid) to authenticated;


-- =====================================================================
-- MIGRACION: 20260824001500_busqueda_global.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 015 · Busqueda global
-- =====================================================================
-- Consulta unificada sobre documentos, no conformidades, riesgos y
-- proveedores. La funcion es SECURITY INVOKER a proposito: cada persona
-- solo encuentra aquello que sus politicas RLS le permiten leer.

create or replace function public.buscar_global(p_texto text, p_limite integer default 30)
returns table (
  entidad text,
  entidad_etiqueta text,
  id uuid,
  codigo text,
  titulo text,
  detalle text,
  estado text,
  enlace text,
  relevancia real
)
language sql
stable
as $$
  with consulta as (
    select
      websearch_to_tsquery('spanish', p_texto) as tsq,
      '%' || lower(unaccent(coalesce(p_texto, ''))) || '%' as patron
  )
  select * from (
    select
      'documentos'::text,
      'Documento'::text,
      d.id,
      d.codigo,
      d.titulo,
      coalesce(d.descripcion, ''),
      d.estado::text,
      '/documentos/' || d.id,
      ts_rank(d.busqueda, c.tsq) + 0.1
    from public.documentos d, consulta c
    where d.busqueda @@ c.tsq or lower(unaccent(d.codigo || ' ' || d.titulo)) like c.patron

    union all

    select
      'no_conformidades'::text,
      'No conformidad'::text,
      n.id,
      n.codigo,
      n.titulo,
      coalesce(n.descripcion, ''),
      n.estado::text,
      '/no-conformidades/' || n.id,
      ts_rank(n.busqueda, c.tsq)
    from public.no_conformidades n, consulta c
    where n.busqueda @@ c.tsq or lower(unaccent(n.codigo || ' ' || n.titulo)) like c.patron

    union all

    select
      'riesgos'::text,
      'Riesgo'::text,
      r.id,
      r.codigo,
      r.titulo,
      coalesce(r.descripcion, ''),
      r.estado::text,
      '/riesgos/' || r.id,
      ts_rank(r.busqueda, c.tsq)
    from public.riesgos r, consulta c
    where r.busqueda @@ c.tsq or lower(unaccent(r.codigo || ' ' || r.titulo)) like c.patron

    union all

    select
      'proveedores'::text,
      'Proveedor'::text,
      p.id,
      p.codigo,
      p.razon_social,
      coalesce(p.rubro, ''),
      p.estado::text,
      '/proveedores/' || p.id,
      ts_rank(p.busqueda, c.tsq)
    from public.proveedores p, consulta c
    where p.busqueda @@ c.tsq
       or lower(unaccent(p.codigo || ' ' || p.razon_social || ' ' || coalesce(p.ruc, ''))) like c.patron
  ) resultados (entidad, entidad_etiqueta, id, codigo, titulo, detalle, estado, enlace, relevancia)
  order by relevancia desc, codigo
  limit greatest(coalesce(p_limite, 30), 1);
$$;

grant execute on function public.buscar_global(text, integer) to authenticated;


-- =====================================================================
-- MIGRACION: 20260824001600_almacenamiento.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 016 · Supabase Storage: adjuntos con control de acceso
-- =====================================================================
-- Los archivos son privados. El acceso se otorga siempre mediante
-- enlaces firmados de duracion corta generados desde el servidor.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'adjuntos-sgc',
  'adjuntos-sgc',
  false,
  20971520,                        -- 20 MB por archivo
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain',
    'text/csv'
  ]
)
on conflict (id) do nothing;

-- Lectura: cualquier persona autenticada y activa del sistema. El detalle
-- fino de que documento puede ver cada quien lo resuelve la tabla
-- public.adjuntos, que es la que la aplicacion consulta primero.
create policy "adjuntos_sgc_lectura" on storage.objects
  for select to authenticated
  using (bucket_id = 'adjuntos-sgc' and public.empresa_actual() is not null);

-- Carga: todos menos Direccion, que es un perfil de solo lectura.
create policy "adjuntos_sgc_carga" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'adjuntos-sgc'
    and public.empresa_actual() is not null
    and not public.es_direccion()
    and owner = auth.uid()
  );

create policy "adjuntos_sgc_actualizacion" on storage.objects
  for update to authenticated
  using (bucket_id = 'adjuntos-sgc' and (owner = auth.uid() or public.es_admin_sgc()))
  with check (bucket_id = 'adjuntos-sgc');

create policy "adjuntos_sgc_baja" on storage.objects
  for delete to authenticated
  using (bucket_id = 'adjuntos-sgc' and (owner = auth.uid() or public.es_admin_sgc()));


-- =====================================================================
-- MIGRACION: 20260824001700_importacion_sofidya.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 017 · Soporte para la importacion unica desde Sofidya
-- =====================================================================
-- Sofidya expone su informacion por comandos. La mayoria tiene una tabla
-- equivalente en este esquema; dos casos no la tienen:
--
--   · get_personas: las personas no se pueden insertar en public.usuarios
--     porque ese identificador proviene de auth.users, que se crea recien
--     en el primer ingreso con Google. Se guardan aparte y se vinculan
--     por correo cuando la persona ingresa.
--   · get_inf_listados_predef: son listados propios de Sofidya sin
--     equivalente directo. Se conservan en crudo para no perder nada.

create table public.personas_sofidya (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  codigo_externo text not null,
  nombre_completo text not null,
  correo text,
  documento text,
  puesto_nombre text,
  sede_nombre text,
  area text,
  activo boolean not null default true,
  -- Se completa cuando la persona ingresa por primera vez al sistema.
  usuario_id uuid references public.usuarios (id) on delete set null,
  importado_en timestamptz not null default now()
);

create unique index personas_sofidya_codigo_unico
  on public.personas_sofidya (empresa_id, codigo_externo);
create index personas_sofidya_correo_idx on public.personas_sofidya (lower(correo));

comment on table public.personas_sofidya is
  'Nomina importada desde Sofidya, a la espera del primer ingreso de cada persona.';

-- ---------------------------------------------------------------------
-- Bitacora de cada corrida del script de importacion.
-- ---------------------------------------------------------------------
create table public.importaciones_sofidya (
  id bigint generated always as identity primary key,
  comando text not null,
  registros_recibidos integer not null default 0,
  registros_importados integer not null default 0,
  tabla_destino text,
  observacion text,
  datos_crudos jsonb,
  ejecutado_en timestamptz not null default now()
);

create index importaciones_sofidya_comando_idx
  on public.importaciones_sofidya (comando, ejecutado_en desc);

comment on table public.importaciones_sofidya is
  'Registro de cada corrida del script scripts/migrar-sofidya.ts.';

-- ---------------------------------------------------------------------
-- Al crearse un usuario se lo vincula con su ficha importada, si existe.
-- ---------------------------------------------------------------------
create or replace function public.vincular_persona_sofidya()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.personas_sofidya
     set usuario_id = new.id
   where usuario_id is null
     and lower(correo) = lower(new.correo);

  return new;
end;
$$;

create trigger usuarios_vincular_persona_sofidya
  after insert on public.usuarios
  for each row execute function public.vincular_persona_sofidya();

-- ---------------------------------------------------------------------
-- RLS: ambas tablas son de administracion del sistema.
-- ---------------------------------------------------------------------
alter table public.personas_sofidya enable row level security;
alter table public.importaciones_sofidya enable row level security;

revoke all on public.personas_sofidya from anon;
revoke all on public.importaciones_sofidya from anon;
grant select, insert, update, delete on public.personas_sofidya to authenticated;
grant select on public.importaciones_sofidya to authenticated;

create policy "personas_sofidya_lectura" on public.personas_sofidya
  for select to authenticated
  using (public.puede_gestionar() and public.misma_empresa(empresa_id));

create policy "personas_sofidya_gestion" on public.personas_sofidya
  for all to authenticated
  using (public.es_admin_sgc() and public.misma_empresa(empresa_id))
  with check (public.es_admin_sgc() and public.misma_empresa(empresa_id));

create policy "importaciones_sofidya_lectura" on public.importaciones_sofidya
  for select to authenticated
  using (public.es_admin_sgc() or public.es_auditor());


-- =====================================================================
-- MIGRACION: 20260824001800_correlativo_auditorias.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 018 · Numeracion correlativa de auditorias y hallazgos
-- =====================================================================
-- Mismo criterio que ya usan no conformidades (NC-AAAA-NNN) y riesgos
-- (R-AAAA-NNN): el correlativo lo resuelve la base de datos, para que dos
-- personas que dan de alta a la vez no reciban el mismo codigo.

create or replace function public.siguiente_codigo_auditoria(p_empresa_id uuid)
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
    from public.auditorias
   where empresa_id = p_empresa_id
     and codigo like 'AUD-' || v_anio || '-%'
     and split_part(codigo, '-', 3) ~ '^[0-9]+$';

  return 'AUD-' || v_anio || '-' || lpad(v_secuencia::text, 2, '0');
end;
$$;

grant execute on function public.siguiente_codigo_auditoria(uuid) to authenticated;

-- Hallazgos numerados dentro de cada auditoria: H-01, H-02, ...
create or replace function public.siguiente_codigo_hallazgo(p_auditoria_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secuencia integer;
begin
  select coalesce(max(substring(codigo from 3)::integer), 0) + 1
    into v_secuencia
    from public.auditoria_hallazgos
   where auditoria_id = p_auditoria_id
     and codigo ~ '^H-[0-9]+$';

  return 'H-' || lpad(v_secuencia::text, 2, '0');
end;
$$;

grant execute on function public.siguiente_codigo_hallazgo(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Un hallazgo genera su no conformidad en una sola operacion.
--
-- Se resuelve en la base y no en la aplicacion por dos motivos: el
-- correlativo y el vinculo tienen que quedar consistentes aunque falle
-- algo en el medio, y asi la regla vale tambien si la NC se genera desde
-- un script o desde el panel de Supabase.
-- ---------------------------------------------------------------------
create or replace function public.generar_no_conformidad_desde_hallazgo(
  p_hallazgo_id uuid,
  p_responsable_id uuid default null,
  p_fecha_limite date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hallazgo public.auditoria_hallazgos%rowtype;
  v_auditoria public.auditorias%rowtype;
  v_codigo text;
  v_nc_id uuid;
  v_severidad severidad_no_conformidad;
  v_titulo text;
begin
  select * into v_hallazgo from public.auditoria_hallazgos where id = p_hallazgo_id;
  if not found then
    raise exception 'El hallazgo no existe';
  end if;

  if v_hallazgo.no_conformidad_id is not null then
    raise exception 'El hallazgo ya generó la no conformidad %',
      (select codigo from public.no_conformidades where id = v_hallazgo.no_conformidad_id);
  end if;

  if v_hallazgo.tipo not in ('no_conformidad_mayor', 'no_conformidad_menor', 'observacion') then
    raise exception 'Solo los hallazgos de tipo no conformidad u observación generan una NC';
  end if;

  select * into v_auditoria from public.auditorias where id = v_hallazgo.auditoria_id;

  -- La severidad de la NC se deriva del tipo de hallazgo.
  v_severidad := case v_hallazgo.tipo
    when 'no_conformidad_mayor' then 'mayor'::severidad_no_conformidad
    when 'no_conformidad_menor' then 'menor'::severidad_no_conformidad
    else 'menor'::severidad_no_conformidad
  end;

  v_codigo := public.siguiente_codigo_no_conformidad(v_auditoria.empresa_id);

  -- El titulo se recorta: la descripcion completa del hallazgo va al
  -- cuerpo de la no conformidad.
  v_titulo := coalesce(v_hallazgo.codigo || ' · ', '') ||
              left(v_hallazgo.descripcion, 120) ||
              case when length(v_hallazgo.descripcion) > 120 then '…' else '' end;

  insert into public.no_conformidades (
    empresa_id, codigo, titulo, descripcion, origen, severidad, estado,
    proceso_id, sede_id, norma_id, requisito_incumplido, detectado_por,
    responsable_id, fecha_deteccion, fecha_limite_cierre, creado_por
  ) values (
    v_auditoria.empresa_id,
    v_codigo,
    v_titulo,
    v_hallazgo.descripcion ||
      case when v_hallazgo.evidencia is not null
           then E'\n\nEvidencia objetiva: ' || v_hallazgo.evidencia else '' end ||
      E'\n\nOrigen: auditoría ' || v_auditoria.codigo || '.',
    'auditoria_interna',
    v_severidad,
    'abierta',
    coalesce(v_hallazgo.proceso_id, v_auditoria.proceso_id),
    v_auditoria.sede_id,
    v_auditoria.norma_id,
    v_hallazgo.requisito,
    coalesce(v_hallazgo.registrado_por, v_auditoria.auditor_lider_id),
    p_responsable_id,
    coalesce(v_auditoria.fecha_fin, current_date),
    coalesce(p_fecha_limite, current_date + 30),
    auth.uid()
  )
  returning id into v_nc_id;

  update public.auditoria_hallazgos
     set no_conformidad_id = v_nc_id
   where id = p_hallazgo_id;

  return v_nc_id;
end;
$$;

grant execute on function public.generar_no_conformidad_desde_hallazgo(uuid, uuid, date)
  to authenticated;


-- =====================================================================
-- MIGRACION: 20260824001900_mantenimientos.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 019 · Ciclo de mantenimiento de activos
-- =====================================================================
-- Al ejecutar un mantenimiento preventivo hay que actualizar el activo y
-- agendar el siguiente. Se resuelve con un disparador y no en la
-- aplicacion para que la agenda quede consistente aunque el mantenimiento
-- se cierre desde un script o desde el panel de Supabase.

create or replace function public.sincronizar_activo_al_mantener()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activo public.activos%rowtype;
begin
  -- Solo interesa el paso a ejecutado.
  if new.estado <> 'ejecutado' or (tg_op = 'UPDATE' and old.estado = 'ejecutado') then
    return new;
  end if;

  select * into v_activo from public.activos where id = new.activo_id;
  if not found then
    return new;
  end if;

  update public.activos
     set fecha_ultimo_mantenimiento = coalesce(new.fecha_ejecucion, current_date),
         fecha_proximo_mantenimiento =
           case
             when v_activo.requiere_mantenimiento
              and v_activo.frecuencia_mantenimiento_dias is not null
             then coalesce(new.fecha_ejecucion, current_date)
                  + v_activo.frecuencia_mantenimiento_dias
             else null
           end,
         -- Un activo que estaba en mantenimiento vuelve a estar operativo.
         estado = case when v_activo.estado = 'en_mantenimiento'
                       then 'operativo'::estado_activo
                       else v_activo.estado end
   where id = new.activo_id;

  return new;
end;
$$;

create trigger mantenimientos_sincronizar_activo
  after insert or update of estado on public.mantenimientos
  for each row execute function public.sincronizar_activo_al_mantener();

-- ---------------------------------------------------------------------
-- Los mantenimientos programados cuya fecha ya paso quedan vencidos.
-- Lo llama el trabajo programado de alertas, antes de avisar.
-- ---------------------------------------------------------------------
create or replace function public.marcar_mantenimientos_vencidos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_afectados integer;
begin
  update public.mantenimientos
     set estado = 'vencido'
   where estado = 'programado'
     and fecha_programada < current_date;

  get diagnostics v_afectados = row_count;
  return v_afectados;
end;
$$;

grant execute on function public.marcar_mantenimientos_vencidos() to authenticated;

-- ---------------------------------------------------------------------
-- Agenda del proximo mantenimiento al dar de alta un activo que lo
-- requiere y todavia no tiene fecha.
-- ---------------------------------------------------------------------
create or replace function public.agendar_primer_mantenimiento()
returns trigger
language plpgsql
as $$
begin
  if new.requiere_mantenimiento
     and new.frecuencia_mantenimiento_dias is not null
     and new.fecha_proximo_mantenimiento is null then
    new.fecha_proximo_mantenimiento :=
      coalesce(new.fecha_ultimo_mantenimiento, current_date)
      + new.frecuencia_mantenimiento_dias;
  end if;

  -- Si deja de requerir mantenimiento, la agenda se limpia.
  if not new.requiere_mantenimiento then
    new.fecha_proximo_mantenimiento := null;
  end if;

  return new;
end;
$$;

create trigger activos_agendar_mantenimiento
  before insert or update of requiere_mantenimiento, frecuencia_mantenimiento_dias
  on public.activos
  for each row execute function public.agendar_primer_mantenimiento();


-- =====================================================================
-- MIGRACION: 20260825000100_reclamos_desde_satisfaccion.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 020 · Satisfaccion del cliente: del detractor al reclamo formal
-- =====================================================================
-- Medir el NPS sin actuar sobre los detractores no cierra ningun ciclo.
-- Esta migracion agrega el vinculo entre una respuesta de encuesta y la
-- no conformidad que origina, con la misma logica que ya usa el modulo
-- de auditorias: la regla vive en la base y no en la aplicacion, para
-- que valga tambien si la escritura viene de un script o del panel de
-- Supabase.
--
-- Agrega ademas el correlativo de encuestas, que hasta ahora se cargaba
-- a mano en el seed.

alter table public.encuesta_respuestas
  add column if not exists no_conformidad_id uuid
    references public.no_conformidades (id) on delete set null;

create index if not exists encuesta_respuestas_nc_idx
  on public.encuesta_respuestas (no_conformidad_id)
  where no_conformidad_id is not null;

-- ---------------------------------------------------------------------
-- Correlativo de encuestas: ENC-01, ENC-02, ...
-- ---------------------------------------------------------------------
create or replace function public.siguiente_codigo_encuesta(p_empresa_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select 'ENC-' || lpad((coalesce(max(
           nullif(regexp_replace(codigo, '^ENC-', ''), '')::int
         ), 0) + 1)::text, 2, '0')
    from public.encuestas
   where empresa_id = p_empresa_id
     and codigo ~ '^ENC-[0-9]+$';
$$;

-- ---------------------------------------------------------------------
-- Genera la no conformidad a partir de una respuesta de encuesta.
--
-- Solo se admite para detractores: un puntaje de 7 o mas es una opinion
-- a tener en cuenta, no un incumplimiento. El comentario del cliente se
-- copia literal al cuerpo de la no conformidad, porque es la evidencia
-- objetiva del reclamo y reescribirlo la debilita.
-- ---------------------------------------------------------------------
create or replace function public.generar_no_conformidad_desde_respuesta(
  p_respuesta_id uuid,
  p_responsable_id uuid default null,
  p_fecha_limite date default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_respuesta public.encuesta_respuestas%rowtype;
  v_encuesta  public.encuestas%rowtype;
  v_cliente   text;
  v_codigo    text;
  v_titulo    text;
  v_nc_id     uuid;
begin
  select * into v_respuesta from public.encuesta_respuestas where id = p_respuesta_id;
  if not found then
    raise exception 'La respuesta indicada no existe';
  end if;

  if v_respuesta.no_conformidad_id is not null then
    raise exception 'La respuesta ya generó la no conformidad %',
      (select codigo from public.no_conformidades where id = v_respuesta.no_conformidad_id);
  end if;

  if v_respuesta.categoria_nps <> 'detractor' then
    raise exception 'Solo las respuestas de clientes detractores (puntaje 0 a 6) generan una no conformidad';
  end if;

  if coalesce(btrim(v_respuesta.comentario), '') = '' then
    raise exception 'La respuesta no tiene comentario: sin el motivo del cliente no hay reclamo que tratar';
  end if;

  select * into v_encuesta from public.encuestas where id = v_respuesta.encuesta_id;

  select razon_social into v_cliente
    from public.clientes where id = v_respuesta.cliente_id;

  v_codigo := public.siguiente_codigo_no_conformidad(v_encuesta.empresa_id);

  -- El origen y el cliente ya tienen su columna en el listado: el titulo
  -- se reserva para lo unico que no se ve ahi, que es el motivo.
  v_titulo := 'Reclamo de ' || coalesce(v_cliente, 'cliente anónimo') || ': ' ||
              left(v_respuesta.comentario, 80) ||
              case when length(v_respuesta.comentario) > 80 then '…' else '' end;

  insert into public.no_conformidades (
    empresa_id, codigo, titulo, descripcion, origen, severidad, estado,
    sede_id, cliente_id, responsable_id, fecha_deteccion, fecha_limite_cierre,
    creado_por
  ) values (
    v_encuesta.empresa_id,
    v_codigo,
    v_titulo,
    'Comentario del cliente en la encuesta ' || v_encuesta.codigo ||
      ' (' || v_encuesta.nombre || '), puntaje ' || v_respuesta.puntaje || ' de 10:' ||
      E'\n\n«' || v_respuesta.comentario || '»' ||
      case when v_cliente is not null then E'\n\nCliente: ' || v_cliente else '' end ||
      case when v_respuesta.canal is not null then E'\nCanal de respuesta: ' || v_respuesta.canal else '' end,
    'reclamo_cliente',
    -- Un 0 a 3 es un cliente perdido; de 4 a 6, insatisfecho.
    case when v_respuesta.puntaje <= 3 then 'mayor'::severidad_no_conformidad
         else 'menor'::severidad_no_conformidad end,
    'abierta',
    v_respuesta.sede_id,
    v_respuesta.cliente_id,
    p_responsable_id,
    v_respuesta.fecha,
    coalesce(p_fecha_limite, current_date + 30),
    auth.uid()
  )
  returning id into v_nc_id;

  update public.encuesta_respuestas
     set no_conformidad_id = v_nc_id
   where id = p_respuesta_id;

  return v_nc_id;
end;
$$;

comment on function public.generar_no_conformidad_desde_respuesta is
  'Convierte el comentario de un cliente detractor en una no conformidad de origen reclamo_cliente.';


-- =====================================================================
-- MIGRACION: 20260825000200_intranet_publicaciones.sql
-- =====================================================================
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
-- PostgreSQL no admite "create type if not exists", y este archivo tiene
-- que poder aplicarse sobre una base que ya lo tenga.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_publicacion') then
    create type public.tipo_publicacion as enum (
      'anuncio',          -- comunicado interno
      'novedad_producto', -- lanzamientos, para que comercial se entere antes
      'logro',            -- licitaciones ganadas, records, certificaciones
      'reconocimiento',   -- a una persona o a un area
      'bienvenida',       -- nuevos ingresos
      'evento'            -- ferias, feriados, fechas de cierre
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'estado_publicacion') then
    create type public.estado_publicacion as enum ('borrador', 'publicada', 'archivada');
  end if;
end;
$$;

create table if not exists public.publicaciones (
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

create index if not exists publicaciones_muro_idx
  on public.publicaciones (empresa_id, estado, fecha_publicacion desc);
create index if not exists publicaciones_tipo_idx on public.publicaciones (empresa_id, tipo);

drop trigger if exists publicaciones_actualizacion on public.publicaciones;
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

drop trigger if exists publicaciones_sellar_fecha on public.publicaciones;
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
drop policy if exists "publicaciones_lectura" on public.publicaciones;
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

drop policy if exists "publicaciones_gestion" on public.publicaciones;
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
drop trigger if exists bitacora_publicaciones on public.publicaciones;
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


-- =====================================================================
-- MIGRACION: 20260825000300_perfiles_de_puesto.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 022 · Perfil, competencia y funciones del puesto (formulario R-02-01)
-- =====================================================================
-- La tabla "puestos" nacio con lo minimo: codigo, nombre, area y mision.
-- Alcanzaba para la matriz de competencias, pero no para lo que pidio
-- Direccion: que cada persona pueda leer su perfil y el de los demas.
--
-- Los campos que se agregan no son una invencion: son los del formulario
-- R-02-01 que Camping 44 ya usa, uno por uno. Modelar otra cosa
-- obligaria a Calidad a mantener dos versiones del mismo perfil.
--
-- "url_documento" guarda el enlace al archivo original en Drive. La
-- intranet no reemplaza ese archivo: lo muestra y enlaza. Duplicar el
-- contenido garantiza que en dos meses haya dos versiones y nadie sepa
-- cual rige, que es justamente el problema a resolver.

alter table public.puestos
  -- Identificacion del formulario, para que la ficha se lea igual que el papel.
  add column if not exists codigo_formulario text not null default 'R-02-01',
  add column if not exists revision smallint not null default 0,

  -- Linea de reporte declarada en el perfil. Es texto y no una referencia
  -- a otro puesto a proposito: el documento dice "Gerente Administrativo
  -- y Financiero" aunque ese puesto todavia no este cargado, y perder esa
  -- informacion por no tener a donde apuntarla seria peor.
  add column if not exists supervisado_por text,
  add column if not exists reemplazado_por text,

  add column if not exists responsabilidades_generales text,
  -- Una funcion por elemento: asi se listan, se cuentan y se comparan
  -- entre puestos sin tener que partir un parrafo.
  add column if not exists funciones text[] not null default '{}',

  add column if not exists formacion_academica text,
  add column if not exists formacion_complementaria text,
  add column if not exists experiencia text,

  -- "Otros requerimientos" del formulario. Son casilleros de si o no.
  add column if not exists requiere_registro_conducir boolean not null default false,
  add column if not exists requiere_movilidad_propia boolean not null default false,
  add column if not exists requiere_viajes_interior boolean not null default false,
  add column if not exists requiere_viajes_exterior boolean not null default false,
  add column if not exists requiere_horario_extendido boolean not null default false,

  -- Enlace al documento original. La intranet muestra, no reemplaza.
  add column if not exists url_documento text;

comment on column public.puestos.funciones is
  'Funciones propias del puesto, una por elemento, tal como figuran en el R-02-01.';
comment on column public.puestos.supervisado_por is
  'Puesto del que depende, en el texto del perfil. La jerarquia operativa vive en usuarios.superior_id.';
comment on column public.puestos.url_documento is
  'Enlace al R-02-01 original. La intranet enlaza el archivo vigente en lugar de duplicarlo.';

create index if not exists puestos_area_idx on public.puestos (empresa_id, area);


-- =====================================================================
-- MIGRACION: 20260825000400_documentos_enlazados.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 023 · Documentos: enlace al archivo vigente y tipo "plan"
-- =====================================================================
-- Direccion pidio un repositorio de procedimientos vigentes con numero de
-- version y fecha, para que nadie use la version equivocada.
--
-- La forma barata de resolverlo mal seria subir una copia de cada archivo
-- a la intranet. En dos meses habria dos versiones de cada documento y
-- nadie sabria cual rige, que es exactamente el problema a evitar.
--
-- La intranet es el indice: codigo, titulo, version, fecha y estado. El
-- archivo sigue viviendo donde ya vive, y se enlaza. Cuando Calidad lo
-- actualiza ahi, la intranet muestra lo nuevo sin hacer nada.

alter table public.documentos
  add column if not exists url_documento text;

comment on column public.documentos.url_documento is
  'Enlace al archivo vigente. La intranet indexa y enlaza; no duplica el contenido.';

-- El juego documental de Camping 44 incluye planes, que el enum no
-- contemplaba: el "PLAN-IT-04 Plan de Contingencia Informatica" no es un
-- procedimiento ni un manual.
alter type public.tipo_documento add value if not exists 'plan';


-- =====================================================================
-- MIGRACION: 20260825000500_documentos_sin_codigo.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- Documentos sin codigo controlado
-- =====================================================================
-- Al cargar la unidad compartida del SGC aparecio un caso que el esquema
-- no contemplaba: no todos los documentos vigentes tienen codigo.
--
-- Los manuales de proceso, los formularios y los protocolos si lo tienen
-- (MP-SOP-01, F-SOP-05-01, P-SOP-01-01). En cambio la Matriz FODA, la
-- Matriz de Partes Interesadas, el Alcance del SGC, la Politica de
-- Calidad, el Proposito, Mision y Vision, los Valores Institucionales,
-- la Politica de Garantia y la Estructura Organizacional no lo llevan:
-- el documento se identifica por su titulo, su version y su vigencia.
-- Se verifico abriendo los archivos, no suponiendolo por el nombre.
--
-- Antes que inventarles un codigo -- que despues circularia como si
-- fuera el oficial -- se permite que la columna quede vacia. Cuando
-- Calidad los codifique, se completa y el formato vuelve a exigirse.
--
-- El alta desde la interfaz sigue pidiendo codigo: un documento nuevo
-- nace codificado. La columna vacia es para lo que ya existe asi.

alter table public.documentos
  alter column codigo drop not null;

-- El formato se sigue exigiendo cuando hay codigo. El indice unico ya
-- trata los nulos como distintos entre si, de modo que varios
-- documentos sin codigo conviven sin chocar.
alter table public.documentos
  drop constraint if exists documentos_codigo_formato;

alter table public.documentos
  add constraint documentos_codigo_formato
  check (codigo is null or codigo ~ '^[A-Z]{1,4}(-[A-Z0-9]{1,4}){1,4}$')
  not valid;

-- Se valida aparte para que la migracion se pueda volver a correr sin
-- chocar: el `drop constraint if exists` de arriba la quita primero.
alter table public.documentos validate constraint documentos_codigo_formato;


-- =====================================================================
-- MIGRACION: 20260825000600_busqueda_documentos_sin_codigo.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- Busqueda global: documentos sin codigo controlado
-- =====================================================================
-- La busqueda por subcadena concatenaba codigo y titulo. Con un codigo
-- vacio la concatenacion entera es null, la comparacion tambien, y el
-- documento solo aparecia si acertaba el tsquery: buscar "garant" no
-- encontraba la Politica de Garantia, aunque buscar "garantia" si.
--
-- Se rehace la funcion con coalesce sobre el codigo. Es lo unico que
-- cambia respecto de 20260824001500_busqueda_global.sql.

create or replace function public.buscar_global(p_texto text, p_limite integer default 30)
returns table (
  entidad text,
  entidad_etiqueta text,
  id uuid,
  codigo text,
  titulo text,
  detalle text,
  estado text,
  enlace text,
  relevancia real
)
language sql
stable
as $$
  with consulta as (
    select
      websearch_to_tsquery('spanish', p_texto) as tsq,
      '%' || lower(unaccent(coalesce(p_texto, ''))) || '%' as patron
  )
  select * from (
    select
      'documentos'::text,
      'Documento'::text,
      d.id,
      d.codigo,
      d.titulo,
      coalesce(d.descripcion, ''),
      d.estado::text,
      '/documentos/' || d.id,
      ts_rank(d.busqueda, c.tsq) + 0.1
    from public.documentos d, consulta c
    where d.busqueda @@ c.tsq or lower(unaccent(coalesce(d.codigo, '') || ' ' || d.titulo)) like c.patron

    union all

    select
      'no_conformidades'::text,
      'No conformidad'::text,
      n.id,
      n.codigo,
      n.titulo,
      coalesce(n.descripcion, ''),
      n.estado::text,
      '/no-conformidades/' || n.id,
      ts_rank(n.busqueda, c.tsq)
    from public.no_conformidades n, consulta c
    where n.busqueda @@ c.tsq or lower(unaccent(n.codigo || ' ' || n.titulo)) like c.patron

    union all

    select
      'riesgos'::text,
      'Riesgo'::text,
      r.id,
      r.codigo,
      r.titulo,
      coalesce(r.descripcion, ''),
      r.estado::text,
      '/riesgos/' || r.id,
      ts_rank(r.busqueda, c.tsq)
    from public.riesgos r, consulta c
    where r.busqueda @@ c.tsq or lower(unaccent(r.codigo || ' ' || r.titulo)) like c.patron

    union all

    select
      'proveedores'::text,
      'Proveedor'::text,
      p.id,
      p.codigo,
      p.razon_social,
      coalesce(p.rubro, ''),
      p.estado::text,
      '/proveedores/' || p.id,
      ts_rank(p.busqueda, c.tsq)
    from public.proveedores p, consulta c
    where p.busqueda @@ c.tsq
       or lower(unaccent(p.codigo || ' ' || p.razon_social || ' ' || coalesce(p.ruc, ''))) like c.patron
  ) resultados (entidad, entidad_etiqueta, id, codigo, titulo, detalle, estado, enlace, relevancia)
  order by relevancia desc, codigo nulls last
  limit greatest(coalesce(p_limite, 30), 1);
$$;

grant execute on function public.buscar_global(text, integer) to authenticated;


-- =====================================================================
-- MIGRACION: 20260825000700_evaluacion_proveedores_segun_formulario.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- Evaluacion de proveedores segun el formulario F-SOP-08-01
-- =====================================================================
-- La evaluacion se habia construido con cinco criterios inventados
-- (calidad, plazo de entrega, precio, servicio de posventa y
-- documentacion) porque todavia no se conocia el formulario real.
--
-- El formulario vigente, F-SOP-08-01 "Evaluacion de Asociados de Negocio
-- y Proveedores" Ver. 00 del 25/05/2026, usa cuatro:
--
--   Calidad · Logistica · Legal · Servicio
--
-- Se alinea el sistema al formulario. Con cuatro criterios de 1 a 5 el
-- maximo es 20, asi que el factor de escala a la nota de 0 a 100 pasa de
-- 4 a 5. Los cortes 80 / 60 no cambian.
--
-- Los criterios viejos se traducen a los nuevos para no perder las
-- evaluaciones ya cargadas:
--
--   calidad          → calidad     (se queda como esta)
--   plazo_entrega    → logistica   (el plazo es la parte medible de la logistica)
--   documentacion    → legal       (documentacion y cumplimiento formal)
--   servicio_posventa→ servicio    (posventa es servicio)
--   precio           → se pierde   (el formulario no lo evalua)
--
-- El formulario ademas pregunta "¿De que manera afecta a la calidad de
-- los articulos/servicios de la empresa?" por cada proveedor. Es una
-- columna propia y no una observacion suelta: es el fundamento de por
-- que ese proveedor se evalua.

-- ---------------------------------------------------------------------
-- 1 · Columnas nuevas, con el valor traducido del criterio viejo
-- ---------------------------------------------------------------------
alter table public.proveedor_evaluaciones
  add column if not exists logistica smallint,
  add column if not exists legal smallint,
  add column if not exists servicio smallint;

-- La traduccion solo tiene sentido mientras existan las columnas
-- viejas. En una base ya migrada esto no hace nada, que es lo que
-- permite volver a correr el archivo entero sin romperlo.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'proveedor_evaluaciones'
       and column_name = 'plazo_entrega'
  ) then
    update public.proveedor_evaluaciones set
      logistica = coalesce(logistica, plazo_entrega),
      legal     = coalesce(legal, documentacion),
      servicio  = coalesce(servicio, servicio_posventa);
  end if;
end;
$$;

alter table public.proveedor_evaluaciones
  alter column logistica set not null,
  alter column legal set not null,
  alter column servicio set not null;

-- ---------------------------------------------------------------------
-- 2 · El puntaje se recalcula sobre los cuatro criterios
-- ---------------------------------------------------------------------
-- Una columna generada no se puede redefinir: se quita y se vuelve a
-- crear. El disparador que copia el puntaje al proveedor no cambia.
--
-- Se hace solo si todavia esta la formula vieja, para que volver a
-- correr la migracion no tire la columna buena.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public'
       and table_name = 'proveedor_evaluaciones'
       and column_name = 'plazo_entrega'
  ) then
    alter table public.proveedor_evaluaciones drop column puntaje;

    alter table public.proveedor_evaluaciones
      add column puntaje numeric(5, 2) generated always as (
        (calidad + logistica + legal + servicio) * 5.0
      ) stored;
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- 3 · Fuera los criterios que el formulario no usa
-- ---------------------------------------------------------------------
alter table public.proveedor_evaluaciones
  drop constraint if exists proveedor_evaluaciones_plazo,
  drop constraint if exists proveedor_evaluaciones_precio,
  drop constraint if exists proveedor_evaluaciones_servicio,
  drop constraint if exists proveedor_evaluaciones_documentacion;

alter table public.proveedor_evaluaciones
  drop column if exists plazo_entrega,
  drop column if exists precio,
  drop column if exists servicio_posventa,
  drop column if exists documentacion;

-- Se quitan antes de agregarlas: asi la migracion se puede repetir.
alter table public.proveedor_evaluaciones
  drop constraint if exists proveedor_evaluaciones_logistica,
  drop constraint if exists proveedor_evaluaciones_legal,
  drop constraint if exists proveedor_evaluaciones_servicio;

alter table public.proveedor_evaluaciones
  add constraint proveedor_evaluaciones_logistica check (logistica between 1 and 5),
  add constraint proveedor_evaluaciones_legal     check (legal between 1 and 5),
  add constraint proveedor_evaluaciones_servicio  check (servicio between 1 and 5);

-- ---------------------------------------------------------------------
-- 4 · El impacto del proveedor sobre la calidad
-- ---------------------------------------------------------------------
alter table public.proveedores
  add column if not exists impacto_en_calidad text;

comment on column public.proveedores.impacto_en_calidad is
  'Respuesta a "¿De que manera afecta a la calidad de los articulos/servicios '
  'de la empresa?" del formulario F-SOP-08-01.';

-- ---------------------------------------------------------------------
-- 5 · Reconciliar lo que dependia del puntaje viejo
-- ---------------------------------------------------------------------
-- El resultado y la calificacion del proveedor son valores guardados,
-- no calculados: quedaron con la nota de cinco criterios. Se recalculan
-- con la escala del formulario, la misma que aplica `resultadoSugerido`
-- en `lib/proveedores.ts`.

update public.proveedor_evaluaciones set
  resultado = case
    when puntaje >= 80 then 'aprobado'::public.estado_proveedor
    when puntaje >= 60 then 'condicional'::public.estado_proveedor
    else 'rechazado'::public.estado_proveedor
  end;

update public.proveedores p set
  calificacion_actual = e.puntaje,
  estado = e.resultado
 from (
   select distinct on (proveedor_id) proveedor_id, puntaje, resultado
     from public.proveedor_evaluaciones
    order by proveedor_id, fecha desc, creado_en desc
 ) e
 where e.proveedor_id = p.id;


-- =====================================================================
-- SEED · datos de demostracion
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- Datos de demostracion
-- =====================================================================
-- Todos los registros llevan es_demostracion = true y los usuarios usan
-- el prefijo "demo." en su correo, de modo que se distingan a simple
-- vista de los datos reales y se puedan eliminar de una sola pasada.
--
-- Para borrar toda la demostracion:
--   delete from auth.users where email like 'demo.%@camping44.com.py';
--   delete from public.documentos where es_demostracion;
--   delete from public.no_conformidades where es_demostracion;
--   delete from public.riesgos where es_demostracion;
--   ... (ver README.md)

-- ---------------------------------------------------------------------
-- Empresas
-- ---------------------------------------------------------------------
insert into public.empresas (id, nombre, razon_social, ruc, activa) values
  ('11111111-1111-4111-8111-111111111111', 'Camping 44', 'Camping 44 S.A.', '80012345-6', true),
  ('22222222-2222-4222-8222-222222222222', 'Vitálica', 'Vitálica E.A.S.', '80098765-4', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Sedes
-- ---------------------------------------------------------------------
insert into public.sedes (id, empresa_id, nombre, direccion, ciudad, telefono) values
  ('a1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'Casa Central', 'Av. Eusebio Ayala 2540', 'Asunción', '021 555 4400'),
  ('a1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'Sucursal Shopping', 'Shopping del Sol, local 118', 'Asunción', '021 555 4410'),
  ('a1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'Depósito Central', 'Ruta Transchaco km 14', 'Mariano Roque Alonso', '021 555 4420')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Normas de referencia
-- ---------------------------------------------------------------------
insert into public.normas (id, codigo, nombre, version, descripcion, vigente) values
  ('b1000000-0000-4000-8000-000000000001', 'ISO 9001:2015',
   'Sistemas de gestión de la calidad — Requisitos', '2015',
   'Norma de referencia del sistema de gestión.', true),
  ('b1000000-0000-4000-8000-000000000002', 'Ley 4036/2010',
   'Ley de armas de fuego, municiones y explosivos', '2010',
   'Marco legal aplicable a la comercialización de armas en Paraguay.', true),
  ('b1000000-0000-4000-8000-000000000003', 'Res. DIMABEL 112/2019',
   'Registro y control de existencias de material controlado', '2019',
   'Obligaciones de registro ante la Dirección de Material Bélico.', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Procesos (mapa de procesos de Camping 44)
-- ---------------------------------------------------------------------
insert into public.procesos (id, empresa_id, codigo, nombre, tipo, descripcion) values
  ('c1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'EST-01', 'Dirección y planificación estratégica', 'estrategico',
   'Definición de objetivos, revisión por la dirección y asignación de recursos.'),
  ('c1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'EST-02', 'Gestión de la calidad', 'estrategico',
   'Mantenimiento del sistema de gestión, auditorías internas y mejora continua.'),
  ('c1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'COM', 'Comercial y ventas', 'operativo',
   'Atención en salón, asesoramiento técnico y cierre de ventas.'),
  ('c1000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   'CMP', 'Compras e importaciones', 'operativo',
   'Selección de proveedores, importación y nacionalización de mercadería.'),
  ('c1000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111',
   'DEP', 'Depósito y logística', 'operativo',
   'Recepción, almacenamiento, control de existencias y despacho.'),
  ('c1000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111',
   'REG', 'Cumplimiento regulatorio', 'operativo',
   'Registro de material controlado y reportes ante DIMABEL.'),
  ('c1000000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111',
   'COB', 'Cobranzas', 'apoyo',
   'Gestión de cuentas por cobrar y recuperación de créditos.'),
  ('c1000000-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111',
   'TI', 'Tecnología de la información', 'apoyo',
   'Infraestructura, sistemas y soporte a los usuarios.'),
  ('c1000000-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111',
   'RRHH', 'Recursos humanos', 'apoyo',
   'Selección, capacitación y evaluación del personal.')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Puestos
-- ---------------------------------------------------------------------
insert into public.puestos (id, empresa_id, codigo, nombre, area, proceso_id, mision) values
  ('d1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'P-001', 'Gerente general', 'Dirección', 'c1000000-0000-4000-8000-000000000001',
   'Conducir la operación y asegurar el cumplimiento de los objetivos.'),
  ('d1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'P-002', 'Responsable de calidad', 'Calidad', 'c1000000-0000-4000-8000-000000000002',
   'Mantener y mejorar el sistema de gestión de la calidad.'),
  ('d1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'P-003', 'Jefe comercial', 'Comercial', 'c1000000-0000-4000-8000-000000000003',
   'Alcanzar las metas de venta con el nivel de servicio comprometido.'),
  ('d1000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   'P-004', 'Vendedor de salón', 'Comercial', 'c1000000-0000-4000-8000-000000000003',
   'Asesorar al cliente y concretar la venta cumpliendo la normativa vigente.'),
  ('d1000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111',
   'P-005', 'Encargado de depósito', 'Logística', 'c1000000-0000-4000-8000-000000000005',
   'Garantizar la exactitud del inventario y la trazabilidad del material.'),
  ('d1000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111',
   'P-006', 'Analista de compras', 'Compras', 'c1000000-0000-4000-8000-000000000004',
   'Asegurar el abastecimiento en tiempo, costo y calidad.'),
  ('d1000000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111',
   'P-007', 'Analista de cobranzas', 'Administración', 'c1000000-0000-4000-8000-000000000007',
   'Reducir la morosidad y sostener el flujo de cobranzas.'),
  ('d1000000-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111',
   'P-008', 'Responsable de TI', 'TI', 'c1000000-0000-4000-8000-000000000008',
   'Sostener la infraestructura y los sistemas de la operación.')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Usuarios de demostracion
-- ---------------------------------------------------------------------
-- Se crean en auth.users; el disparador public.crear_perfil_usuario
-- genera el perfil en public.usuarios con rol Colaborador, y luego se
-- ajustan rol, jerarquia y proceso a cargo.
--
-- Los correos llevan el prefijo "demo." a proposito: asi nunca colisionan
-- con las cuentas reales del espacio de trabajo de Google.
insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('e1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'demo.direccion@camping44.com.py', now(),
   '{"provider":"google","providers":["google"]}',
   '{"full_name":"Rodrigo Fernández"}', now(), now()),
  ('e1000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'demo.calidad@camping44.com.py', now(),
   '{"provider":"google","providers":["google"]}',
   '{"full_name":"María Benítez"}', now(), now()),
  ('e1000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'demo.comercial@camping44.com.py', now(),
   '{"provider":"google","providers":["google"]}',
   '{"full_name":"Lucía Ayala"}', now(), now()),
  ('e1000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'demo.deposito@camping44.com.py', now(),
   '{"provider":"google","providers":["google"]}',
   '{"full_name":"Marcos Duarte"}', now(), now()),
  ('e1000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'demo.compras@camping44.com.py', now(),
   '{"provider":"google","providers":["google"]}',
   '{"full_name":"Silvia Rojas"}', now(), now()),
  ('e1000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'demo.cobranzas@camping44.com.py', now(),
   '{"provider":"google","providers":["google"]}',
   '{"full_name":"Patricia Cabral"}', now(), now()),
  ('e1000000-0000-4000-8000-000000000007', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'demo.ti@camping44.com.py', now(),
   '{"provider":"google","providers":["google"]}',
   '{"full_name":"Andrés Villalba"}', now(), now()),
  ('e1000000-0000-4000-8000-000000000008', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'demo.auditor@camping44.com.py', now(),
   '{"provider":"google","providers":["google"]}',
   '{"full_name":"Gustavo Meza"}', now(), now()),
  ('e1000000-0000-4000-8000-000000000009', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'demo.vendedor@camping44.com.py', now(),
   '{"provider":"google","providers":["google"]}',
   '{"full_name":"Nicolás Giménez"}', now(), now())
on conflict (id) do nothing;

-- Rol, jerarquia y proceso a cargo.
update public.usuarios set
  rol = 'direccion', puesto_id = 'd1000000-0000-4000-8000-000000000001',
  proceso_id = 'c1000000-0000-4000-8000-000000000001'
where id = 'e1000000-0000-4000-8000-000000000001';

update public.usuarios set
  rol = 'administrador_sgc', puesto_id = 'd1000000-0000-4000-8000-000000000002',
  proceso_id = 'c1000000-0000-4000-8000-000000000002',
  superior_id = 'e1000000-0000-4000-8000-000000000001'
where id = 'e1000000-0000-4000-8000-000000000002';

update public.usuarios set
  rol = 'responsable_proceso', puesto_id = 'd1000000-0000-4000-8000-000000000003',
  proceso_id = 'c1000000-0000-4000-8000-000000000003',
  superior_id = 'e1000000-0000-4000-8000-000000000001'
where id = 'e1000000-0000-4000-8000-000000000003';

update public.usuarios set
  rol = 'responsable_proceso', puesto_id = 'd1000000-0000-4000-8000-000000000005',
  proceso_id = 'c1000000-0000-4000-8000-000000000005',
  superior_id = 'e1000000-0000-4000-8000-000000000001'
where id = 'e1000000-0000-4000-8000-000000000004';

update public.usuarios set
  rol = 'responsable_proceso', puesto_id = 'd1000000-0000-4000-8000-000000000006',
  proceso_id = 'c1000000-0000-4000-8000-000000000004',
  superior_id = 'e1000000-0000-4000-8000-000000000001'
where id = 'e1000000-0000-4000-8000-000000000005';

update public.usuarios set
  rol = 'responsable_proceso', puesto_id = 'd1000000-0000-4000-8000-000000000007',
  proceso_id = 'c1000000-0000-4000-8000-000000000007',
  superior_id = 'e1000000-0000-4000-8000-000000000001'
where id = 'e1000000-0000-4000-8000-000000000006';

update public.usuarios set
  rol = 'responsable_proceso', puesto_id = 'd1000000-0000-4000-8000-000000000008',
  proceso_id = 'c1000000-0000-4000-8000-000000000008',
  superior_id = 'e1000000-0000-4000-8000-000000000001'
where id = 'e1000000-0000-4000-8000-000000000007';

update public.usuarios set
  rol = 'auditor', superior_id = 'e1000000-0000-4000-8000-000000000002'
where id = 'e1000000-0000-4000-8000-000000000008';

update public.usuarios set
  rol = 'colaborador', puesto_id = 'd1000000-0000-4000-8000-000000000004',
  proceso_id = 'c1000000-0000-4000-8000-000000000003',
  superior_id = 'e1000000-0000-4000-8000-000000000003'
where id = 'e1000000-0000-4000-8000-000000000009';

-- Responsables de proceso.
update public.procesos set responsable_id = 'e1000000-0000-4000-8000-000000000001'
  where id = 'c1000000-0000-4000-8000-000000000001';
update public.procesos set responsable_id = 'e1000000-0000-4000-8000-000000000002'
  where id in ('c1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000006');
update public.procesos set responsable_id = 'e1000000-0000-4000-8000-000000000003'
  where id = 'c1000000-0000-4000-8000-000000000003';
update public.procesos set responsable_id = 'e1000000-0000-4000-8000-000000000005'
  where id = 'c1000000-0000-4000-8000-000000000004';
update public.procesos set responsable_id = 'e1000000-0000-4000-8000-000000000004'
  where id = 'c1000000-0000-4000-8000-000000000005';
update public.procesos set responsable_id = 'e1000000-0000-4000-8000-000000000006'
  where id = 'c1000000-0000-4000-8000-000000000007';
update public.procesos set responsable_id = 'e1000000-0000-4000-8000-000000000007'
  where id in ('c1000000-0000-4000-8000-000000000008', 'c1000000-0000-4000-8000-000000000009');

-- A partir de aqui la bitacora atribuye los movimientos a Calidad, que es
-- quien cargaria estos datos en la operacion real.
select set_config('request.jwt.claim.sub', 'e1000000-0000-4000-8000-000000000002', false);

-- ---------------------------------------------------------------------
-- Clientes y proveedores
-- ---------------------------------------------------------------------
insert into public.clientes (id, empresa_id, codigo, razon_social, ruc, correo, ciudad, es_demostracion) values
  ('f1000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'CLI-001', 'Estancia Santa Rosa S.A.', '80025874-1', 'compras@santarosa.demo.py', 'Concepción', true),
  ('f1000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'CLI-002', 'Club de Caza y Pesca Asunción', '80031122-3', 'secretaria@clubcaza.demo.py', 'Asunción', true),
  ('f1000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'CLI-003', 'Seguridad Integral Guaraní S.R.L.', '80044455-7', 'admin@sig.demo.py', 'Luque', true),
  ('f1000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   'CLI-004', 'Agroganadera del Chaco S.A.', '80055566-8', 'compras@agrochaco.demo.py', 'Filadelfia', true)
on conflict (id) do nothing;

insert into public.proveedores (
  id, empresa_id, codigo, razon_social, nombre_comercial, ruc, rubro, critico,
  correo, telefono, ciudad, pais, estado, periodicidad_evaluacion_meses, es_demostracion
) values
  ('f2000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'PRV-001', 'Importadora Andina de Equipamiento S.A.', 'Andina Outdoor', '80077788-9',
   'Equipamiento outdoor', true, 'ventas@andina.demo.py', '+54 11 4000 0000',
   'Buenos Aires', 'Argentina', 'aprobado', 12, true),
  ('f2000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'PRV-002', 'Distribuidora de Municiones del Sur Ltda.', 'DMS', '80088899-0',
   'Municiones y accesorios', true, 'contacto@dms.demo.py', '+55 41 3000 0000',
   'Curitiba', 'Brasil', 'aprobado', 6, true),
  ('f2000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'PRV-003', 'Transportes Ñemity S.R.L.', 'Ñemity Logística', '80099900-1',
   'Transporte y logística', false, 'operaciones@nemity.demo.py', '021 555 7788',
   'Asunción', 'Paraguay', 'condicional', 12, true),
  ('f2000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   'PRV-004', 'Insumos Gráficos Paraguay S.A.', 'Ingrapar', '80011122-4',
   'Insumos de oficina', false, 'ventas@ingrapar.demo.py', '021 555 3322',
   'Asunción', 'Paraguay', 'aprobado', 24, true),
  ('f2000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111',
   'PRV-005', 'Servicios Informáticos Aguará S.R.L.', 'Aguará TI', '80022233-5',
   'Servicios de TI', true, 'soporte@aguara.demo.py', '021 555 9911',
   'Asunción', 'Paraguay', 'en_evaluacion', 12, true)
on conflict (id) do nothing;

-- Evaluaciones (el disparador actualiza calificacion y fechas del proveedor).
-- Los cuatro criterios son los del formulario F-SOP-08-01: calidad,
-- logistica, legal y servicio. Cada uno de 1 a 5; el puntaje sale
-- generado, de 0 a 100.
insert into public.proveedor_evaluaciones (
  proveedor_id, fecha, periodo, calidad, logistica, legal, servicio,
  resultado, comentario, evaluado_por
) values
  ('f2000000-0000-4000-8000-000000000001', current_date - 120, 'Semestre 1',
   5, 4, 5, 5, 'aprobado', 'Cumplimiento sostenido en calidad y documentación.',
   'e1000000-0000-4000-8000-000000000005'),
  ('f2000000-0000-4000-8000-000000000002', current_date - 60, 'Semestre 1',
   5, 3, 5, 4, 'aprobado', 'Demoras puntuales por trámites de importación.',
   'e1000000-0000-4000-8000-000000000005'),
  -- Queda rechazado: 11 de 20 son 55 puntos, debajo del corte de 60. Es
  -- el mismo valor al que llega una base ya instalada cuando la
  -- migracion traduce sus criterios viejos, y conviene que los dos
  -- caminos den identico.
  ('f2000000-0000-4000-8000-000000000003', current_date - 200, 'Anual',
   3, 2, 3, 3, 'rechazado', 'Reiteradas demoras en la entrega al depósito.',
   'e1000000-0000-4000-8000-000000000005'),
  ('f2000000-0000-4000-8000-000000000004', current_date - 300, 'Anual',
   4, 5, 4, 4, 'aprobado', 'Sin observaciones en el período.',
   'e1000000-0000-4000-8000-000000000005');

-- ---------------------------------------------------------------------
-- Documentos
-- ---------------------------------------------------------------------
insert into public.documentos (
  id, empresa_id, codigo, titulo, descripcion, tipo, estado, proceso_id, norma_id,
  responsable_id, elaborador_id, aprobador_id, version_actual, fecha_aprobacion,
  fecha_vigencia, fecha_proxima_revision, periodicidad_revision_meses,
  es_demostracion, creado_por
) values
  ('01000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'MP-SOP-01', 'Manual del Sistema de Gestión de Calidad',
   'Describe el alcance del sistema, el mapa de procesos y la política de calidad de Camping 44.',
   'manual', 'vigente', 'c1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001',
   'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002',
   'e1000000-0000-4000-8000-000000000001', 1, current_date - 200, current_date - 200,
   current_date + 165, 12, true, 'e1000000-0000-4000-8000-000000000002'),

  ('01000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'MP-SOP-02', 'Procedimiento de control de información documentada',
   'Reglas de codificación, elaboración, revisión, aprobación y baja de documentos.',
   'procedimiento', 'vigente', 'c1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001',
   'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002',
   'e1000000-0000-4000-8000-000000000001', 2, current_date - 90, current_date - 90,
   current_date + 275, 12, true, 'e1000000-0000-4000-8000-000000000002'),

  ('01000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'MP-SOP-03', 'Procedimiento de no conformidades y acciones correctivas',
   'Tratamiento de desviaciones, análisis de causa raíz y verificación de eficacia.',
   'procedimiento', 'vigente', 'c1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001',
   'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002',
   'e1000000-0000-4000-8000-000000000001', 1, current_date - 150, current_date - 150,
   current_date + 215, 12, true, 'e1000000-0000-4000-8000-000000000002'),

  ('01000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   'MP-SOP-04', 'Procedimiento de recepción y almacenamiento de mercadería',
   'Controles de recepción, verificación documental y ubicación en depósito.',
   'procedimiento', 'vigente', 'c1000000-0000-4000-8000-000000000005', 'b1000000-0000-4000-8000-000000000001',
   'e1000000-0000-4000-8000-000000000004', 'e1000000-0000-4000-8000-000000000004',
   'e1000000-0000-4000-8000-000000000002', 1, current_date - 340, current_date - 340,
   current_date + 12, 12, true, 'e1000000-0000-4000-8000-000000000004'),

  ('01000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111',
   'MP-SOP-05', 'Procedimiento de registro y control de material ante DIMABEL',
   'Registro de ingresos y egresos de material controlado y reportes obligatorios.',
   'procedimiento', 'vigente', 'c1000000-0000-4000-8000-000000000006', 'b1000000-0000-4000-8000-000000000002',
   'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002',
   'e1000000-0000-4000-8000-000000000001', 1, current_date - 355, current_date - 355,
   current_date - 5, 12, true, 'e1000000-0000-4000-8000-000000000002'),

  ('01000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111',
   'POL-01', 'Política de calidad',
   'Compromiso de la dirección con la satisfacción del cliente y la mejora continua.',
   'politica', 'vigente', 'c1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001',
   'e1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002',
   'e1000000-0000-4000-8000-000000000001', 0, current_date - 400, current_date - 400,
   current_date + 330, 24, true, 'e1000000-0000-4000-8000-000000000002'),

  ('01000000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111',
   'F-DEP-01-01', 'Formulario de conteo cíclico de inventario',
   'Planilla de registro del conteo cíclico semanal en depósito.',
   'formulario', 'vigente', 'c1000000-0000-4000-8000-000000000005', null,
   'e1000000-0000-4000-8000-000000000004', 'e1000000-0000-4000-8000-000000000004',
   'e1000000-0000-4000-8000-000000000002', 0, current_date - 120, current_date - 120,
   current_date + 245, 12, true, 'e1000000-0000-4000-8000-000000000004'),

  ('01000000-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111',
   'F-COM-01-01', 'Formulario de evaluación de satisfacción del cliente',
   'Encuesta breve entregada al cliente luego de la compra.',
   'formulario', 'en_revision', 'c1000000-0000-4000-8000-000000000003', null,
   'e1000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000003',
   null, 0, null, null, null, 12, true, 'e1000000-0000-4000-8000-000000000003'),

  ('01000000-0000-4000-8000-000000000009', '11111111-1111-4111-8111-111111111111',
   'IT-01', 'Instructivo de arqueo diario de caja',
   'Pasos del arqueo de caja al cierre de cada jornada.',
   'instructivo', 'borrador', 'c1000000-0000-4000-8000-000000000007', null,
   'e1000000-0000-4000-8000-000000000006', 'e1000000-0000-4000-8000-000000000006',
   null, 0, null, null, null, 12, true, 'e1000000-0000-4000-8000-000000000006')
on conflict (id) do nothing;

-- Versiones de cada documento.
insert into public.documento_versiones (
  documento_id, version, estado, resumen_cambios, elaborado_por, aprobado_por, fecha_aprobacion
) values
  ('01000000-0000-4000-8000-000000000001', 0, 'obsoleto', 'Versión inicial del manual.',
   'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', now() - interval '500 days'),
  ('01000000-0000-4000-8000-000000000001', 1, 'vigente',
   'Se incorpora el proceso de cumplimiento regulatorio al mapa de procesos.',
   'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', now() - interval '200 days'),

  ('01000000-0000-4000-8000-000000000002', 0, 'obsoleto', 'Versión inicial.',
   'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', now() - interval '480 days'),
  ('01000000-0000-4000-8000-000000000002', 1, 'obsoleto', 'Se agrega la codificación de formularios.',
   'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', now() - interval '300 days'),
  ('01000000-0000-4000-8000-000000000002', 2, 'vigente',
   'Se define la lista de difusión obligatoria y el acuse de publicación.',
   'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', now() - interval '90 days'),

  ('01000000-0000-4000-8000-000000000003', 0, 'obsoleto', 'Versión inicial.',
   'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', now() - interval '420 days'),
  ('01000000-0000-4000-8000-000000000003', 1, 'vigente',
   'Se incorpora el escalamiento al jefe inmediato a los diez días.',
   'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', now() - interval '150 days'),

  ('01000000-0000-4000-8000-000000000004', 0, 'obsoleto', 'Versión inicial.',
   'e1000000-0000-4000-8000-000000000004', 'e1000000-0000-4000-8000-000000000002', now() - interval '700 days'),
  ('01000000-0000-4000-8000-000000000004', 1, 'vigente', 'Se agrega el control de temperatura del depósito.',
   'e1000000-0000-4000-8000-000000000004', 'e1000000-0000-4000-8000-000000000002', now() - interval '340 days'),

  ('01000000-0000-4000-8000-000000000005', 0, 'obsoleto', 'Versión inicial.',
   'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', now() - interval '720 days'),
  ('01000000-0000-4000-8000-000000000005', 1, 'vigente',
   'Actualización por la Resolución DIMABEL 112/2019.',
   'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', now() - interval '355 days'),

  ('01000000-0000-4000-8000-000000000006', 0, 'vigente', 'Versión inicial de la política.',
   'e1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000001', now() - interval '400 days'),

  ('01000000-0000-4000-8000-000000000007', 0, 'vigente', 'Versión inicial del formulario.',
   'e1000000-0000-4000-8000-000000000004', 'e1000000-0000-4000-8000-000000000002', now() - interval '120 days'),

  ('01000000-0000-4000-8000-000000000008', 0, 'en_revision',
   'Primera propuesta de encuesta posventa.', 'e1000000-0000-4000-8000-000000000003', null, null),

  ('01000000-0000-4000-8000-000000000009', 0, 'borrador',
   'Borrador inicial del instructivo de arqueo.', 'e1000000-0000-4000-8000-000000000006', null, null);

-- Revisores pendientes de la version en revision.
insert into public.documento_revisores (version_id, usuario_id, estado)
select v.id, 'e1000000-0000-4000-8000-000000000002', 'pendiente'
  from public.documento_versiones v
 where v.documento_id = '01000000-0000-4000-8000-000000000008' and v.version = 0;

insert into public.documento_revisores (version_id, usuario_id, estado)
select v.id, 'e1000000-0000-4000-8000-000000000001', 'pendiente'
  from public.documento_versiones v
 where v.documento_id = '01000000-0000-4000-8000-000000000008' and v.version = 0;

-- Listas de difusion.
insert into public.documento_difusion (documento_id, proceso_id) values
  ('01000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000003'),
  ('01000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000005'),
  ('01000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000005'),
  ('01000000-0000-4000-8000-000000000005', 'c1000000-0000-4000-8000-000000000006'),
  ('01000000-0000-4000-8000-000000000007', 'c1000000-0000-4000-8000-000000000005')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Riesgos y oportunidades
-- ---------------------------------------------------------------------
insert into public.riesgos (
  id, empresa_id, codigo, titulo, descripcion, tipo, categoria, proceso_id,
  responsable_id, estado, causas, consecuencias, controles_existentes, tratamiento,
  probabilidad, impacto, fecha_identificacion, es_demostracion, creado_por
) values
  ('02000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'R-2026-001', 'Diferencias entre el stock físico y el registro ante DIMABEL',
   'El material controlado podría no coincidir con lo declarado en el registro obligatorio.',
   'riesgo', 'Regulatorio', 'c1000000-0000-4000-8000-000000000006',
   'e1000000-0000-4000-8000-000000000002', 'en_tratamiento',
   'Conteos cíclicos sin frecuencia definida y carga manual de movimientos.',
   'Sanción administrativa, suspensión de la licencia comercial y daño reputacional.',
   'Conteo mensual del material controlado y doble firma en cada egreso.',
   'mitigar', 4, 5, current_date - 180, true, 'e1000000-0000-4000-8000-000000000002'),

  ('02000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'R-2026-002', 'Quiebre de stock en temporada alta de pesca',
   'La demanda de equipamiento se concentra entre septiembre y diciembre.',
   'riesgo', 'Operativo', 'c1000000-0000-4000-8000-000000000004',
   'e1000000-0000-4000-8000-000000000005', 'en_tratamiento',
   'Plazos de importación de hasta noventa días y previsión basada solo en el año anterior.',
   'Pérdida de ventas y migración de clientes a la competencia.',
   'Punto de reposición definido para los veinte artículos de mayor rotación.',
   'mitigar', 4, 3, current_date - 150, true, 'e1000000-0000-4000-8000-000000000002'),

  ('02000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'R-2026-003', 'Morosidad creciente en ventas a crédito corporativo',
   'Clientes institucionales con plazos de pago superiores a los acordados.',
   'riesgo', 'Financiero', 'c1000000-0000-4000-8000-000000000007',
   'e1000000-0000-4000-8000-000000000006', 'en_tratamiento',
   'Aprobación de crédito sin análisis formal y seguimiento manual de vencimientos.',
   'Deterioro del flujo de caja y necesidad de financiamiento externo.',
   'Informe semanal de cuentas por cobrar y llamado a los treinta días.',
   'mitigar', 3, 4, current_date - 100, true, 'e1000000-0000-4000-8000-000000000002'),

  ('02000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   'R-2026-004', 'Pérdida de información por falta de respaldo verificado',
   'Los respaldos se generan pero no se verifica su restauración.',
   'riesgo', 'Tecnológico', 'c1000000-0000-4000-8000-000000000008',
   'e1000000-0000-4000-8000-000000000007', 'identificado',
   'No existe una prueba periódica de restauración documentada.',
   'Interrupción de la operación e imposibilidad de reconstruir registros contables.',
   'Respaldo automático diario en la nube.',
   'mitigar', 2, 5, current_date - 60, true, 'e1000000-0000-4000-8000-000000000002'),

  ('02000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111',
   'R-2026-005', 'Venta sin verificación completa de la documentación del comprador',
   'Riesgo de concretar una venta de material controlado sin la habilitación vigente.',
   'riesgo', 'Regulatorio', 'c1000000-0000-4000-8000-000000000003',
   'e1000000-0000-4000-8000-000000000003', 'en_tratamiento',
   'Alta rotación de vendedores y verificación apoyada en la memoria del personal.',
   'Responsabilidad penal y administrativa para la empresa y el vendedor.',
   'Lista de verificación obligatoria antes de la facturación.',
   'evitar', 2, 5, current_date - 220, true, 'e1000000-0000-4000-8000-000000000002'),

  ('02000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111',
   'R-2026-006', 'Deterioro de mercadería por humedad en el depósito',
   'El sector de carpas y bolsas de dormir presenta humedad en época de lluvias.',
   'riesgo', 'Operativo', 'c1000000-0000-4000-8000-000000000005',
   'e1000000-0000-4000-8000-000000000004', 'controlado',
   'Falta de aislamiento en el sector oeste del depósito.',
   'Pérdida de mercadería y reclamos por calidad del producto.',
   'Deshumidificadores instalados y control diario de temperatura.',
   'mitigar', 2, 3, current_date - 300, true, 'e1000000-0000-4000-8000-000000000002'),

  ('02000000-0000-4000-8000-000000000007', '11111111-1111-4111-8111-111111111111',
   'R-2026-007', 'Dependencia de un único proveedor de municiones',
   'El 80 % del abastecimiento de municiones proviene de un solo proveedor.',
   'riesgo', 'Cadena de suministro', 'c1000000-0000-4000-8000-000000000004',
   'e1000000-0000-4000-8000-000000000005', 'identificado',
   'Ausencia de proveedores alternativos homologados.',
   'Interrupción del abastecimiento ante cualquier contingencia del proveedor.',
   'Contrato anual con volumen comprometido.',
   'mitigar', 3, 3, current_date - 45, true, 'e1000000-0000-4000-8000-000000000002'),

  ('02000000-0000-4000-8000-000000000008', '11111111-1111-4111-8111-111111111111',
   'R-2026-008', 'Apertura del canal de venta en línea para equipamiento outdoor',
   'La demanda de equipamiento de campamento crece fuera del área metropolitana.',
   'oportunidad', 'Comercial', 'c1000000-0000-4000-8000-000000000003',
   'e1000000-0000-4000-8000-000000000003', 'identificado',
   'Consultas recurrentes de clientes del interior por redes sociales.',
   'Ampliación del alcance comercial sin abrir una sucursal física.',
   'Catálogo digital publicado y despacho por encomienda.',
   'explotar', 4, 4, current_date - 30, true, 'e1000000-0000-4000-8000-000000000002')
on conflict (id) do nothing;

-- Evaluacion residual de los riesgos ya tratados.
update public.riesgos set probabilidad_residual = 2, impacto_residual = 5
  where id = '02000000-0000-4000-8000-000000000001';
update public.riesgos set probabilidad_residual = 1, impacto_residual = 3
  where id = '02000000-0000-4000-8000-000000000006';

-- Algunas fechas de reevaluacion ya vencidas, para que el tablero y el
-- trabajo programado tengan casos reales que mostrar.
update public.riesgos set fecha_proxima_revision = current_date - 3
  where id = '02000000-0000-4000-8000-000000000005';
update public.riesgos set fecha_proxima_revision = current_date + 5
  where id = '02000000-0000-4000-8000-000000000003';

insert into public.riesgo_evaluaciones (riesgo_id, fecha, probabilidad, impacto, comentario, evaluado_por) values
  ('02000000-0000-4000-8000-000000000001', current_date - 180, 4, 5, 'Evaluación inicial.', 'e1000000-0000-4000-8000-000000000002'),
  ('02000000-0000-4000-8000-000000000001', current_date - 30, 2, 5, 'Riesgo residual tras implantar el conteo mensual.', 'e1000000-0000-4000-8000-000000000002'),
  ('02000000-0000-4000-8000-000000000002', current_date - 150, 4, 3, 'Evaluación inicial.', 'e1000000-0000-4000-8000-000000000005'),
  ('02000000-0000-4000-8000-000000000003', current_date - 100, 3, 4, 'Evaluación inicial.', 'e1000000-0000-4000-8000-000000000006'),
  ('02000000-0000-4000-8000-000000000005', current_date - 220, 3, 5, 'Evaluación inicial.', 'e1000000-0000-4000-8000-000000000003'),
  ('02000000-0000-4000-8000-000000000005', current_date - 90, 2, 5, 'Baja de probabilidad por la lista de verificación obligatoria.', 'e1000000-0000-4000-8000-000000000003'),
  ('02000000-0000-4000-8000-000000000006', current_date - 300, 3, 3, 'Evaluación inicial.', 'e1000000-0000-4000-8000-000000000004'),
  ('02000000-0000-4000-8000-000000000006', current_date - 40, 1, 3, 'Riesgo residual tras instalar los deshumidificadores.', 'e1000000-0000-4000-8000-000000000004');

insert into public.riesgo_acciones (riesgo_id, descripcion, tratamiento, responsable_id, fecha_limite, estado, fecha_ejecucion) values
  ('02000000-0000-4000-8000-000000000001',
   'Definir la frecuencia del conteo cíclico de material controlado en el procedimiento MP-SOP-04.',
   'mitigar', 'e1000000-0000-4000-8000-000000000004', current_date - 20, 'ejecutada', current_date - 25),
  ('02000000-0000-4000-8000-000000000001',
   'Conciliar mensualmente el stock físico contra el registro presentado ante DIMABEL.',
   'mitigar', 'e1000000-0000-4000-8000-000000000002', current_date + 25, 'en_curso', null),
  ('02000000-0000-4000-8000-000000000002',
   'Adelantar la orden de compra de temporada a julio de cada año.',
   'mitigar', 'e1000000-0000-4000-8000-000000000005', current_date + 40, 'pendiente', null),
  ('02000000-0000-4000-8000-000000000003',
   'Implantar el análisis formal de crédito previo a la aprobación de ventas a plazo.',
   'mitigar', 'e1000000-0000-4000-8000-000000000006', current_date + 15, 'en_curso', null),
  ('02000000-0000-4000-8000-000000000004',
   'Realizar una prueba de restauración trimestral y dejar constancia del resultado.',
   'mitigar', 'e1000000-0000-4000-8000-000000000007', current_date + 30, 'pendiente', null),
  ('02000000-0000-4000-8000-000000000007',
   'Homologar un segundo proveedor de municiones antes del cierre del ejercicio.',
   'mitigar', 'e1000000-0000-4000-8000-000000000005', current_date + 90, 'pendiente', null),
  ('02000000-0000-4000-8000-000000000008',
   'Definir el alcance y la logística de despacho del canal en línea.',
   'explotar', 'e1000000-0000-4000-8000-000000000003', current_date + 60, 'en_curso', null);

-- ---------------------------------------------------------------------
-- No conformidades
-- ---------------------------------------------------------------------
insert into public.no_conformidades (
  id, empresa_id, codigo, titulo, descripcion, origen, severidad, estado,
  proceso_id, sede_id, norma_id, cliente_id, requisito_incumplido,
  correccion_inmediata, conclusion_causa_raiz, detectado_por, responsable_id,
  fecha_deteccion, fecha_limite_cierre, fecha_cierre, cerrado_por, eficacia,
  observacion_eficacia, riesgo_id, es_demostracion, creado_por
) values
  ('03000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'NC-2026-001', 'Diferencia de 3 unidades en el conteo cíclico de material controlado',
   'Durante el conteo cíclico del 12 del mes se detectó una diferencia de tres unidades entre el stock físico y el sistema, en el sector de material controlado del Depósito Central.',
   'proceso_interno', 'critica', 'en_tratamiento',
   'c1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000003',
   'b1000000-0000-4000-8000-000000000002', null,
   'Ley 4036/2010 · Art. 27 — Registro de existencias',
   'Se bloqueó el egreso del sector y se recontó con doble verificación.',
   'El procedimiento de recepción no define la frecuencia del conteo cíclico ni exige la doble firma en el ingreso de material controlado, por lo que las diferencias se detectan tarde.',
   'e1000000-0000-4000-8000-000000000004', 'e1000000-0000-4000-8000-000000000002',
   current_date - 22, current_date - 2, null, null, 'pendiente', null,
   '02000000-0000-4000-8000-000000000001', true, 'e1000000-0000-4000-8000-000000000004'),

  ('03000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'NC-2026-002', 'Entrega fuera de plazo del proveedor Transportes Ñemity',
   'Tres despachos consecutivos del proveedor PRV-003 llegaron con más de cinco días de atraso respecto de lo comprometido.',
   'proveedor', 'mayor', 'en_verificacion',
   'c1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000003',
   'b1000000-0000-4000-8000-000000000001', null,
   'ISO 9001:2015 · 8.4.1 — Control de proveedores externos',
   'Se recurrió a un transportista alternativo para el despacho urgente.',
   'La evaluación del proveedor se realiza una vez al año y no contempla un umbral de atrasos que active la reevaluación anticipada.',
   'e1000000-0000-4000-8000-000000000005', 'e1000000-0000-4000-8000-000000000005',
   current_date - 45, current_date + 8, null, null, 'pendiente', null,
   null, true, 'e1000000-0000-4000-8000-000000000005'),

  ('03000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'NC-2026-003', 'Reclamo de cliente por asesoramiento incorrecto sobre calibre',
   'El Club de Caza y Pesca reclamó que se le vendió munición de calibre distinto al solicitado, detectado por el cliente al retirar la mercadería.',
   'reclamo_cliente', 'menor', 'cerrada',
   'c1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001',
   'b1000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002',
   'ISO 9001:2015 · 8.2.1 — Comunicación con el cliente',
   'Se realizó el cambio en el momento y se dejó constancia en la nota de crédito.',
   'El vendedor no contaba con la capacitación técnica sobre calibres, porque la inducción no incluye ese contenido para el personal nuevo.',
   'e1000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000003',
   current_date - 120, current_date - 90, current_date - 85,
   'e1000000-0000-4000-8000-000000000002', 'eficaz',
   'Se verificaron dos meses posteriores sin reclamos del mismo tipo.',
   null, true, 'e1000000-0000-4000-8000-000000000003'),

  ('03000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   'NC-2026-004', 'Facturación sin verificación de la habilitación del comprador',
   'En una venta del mes anterior se emitió la factura antes de completar la lista de verificación documental obligatoria.',
   'auditoria_interna', 'critica', 'en_analisis',
   'c1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000002',
   'b1000000-0000-4000-8000-000000000002', null,
   'Ley 4036/2010 · Art. 31 — Verificación del adquirente',
   'Se retuvo la entrega hasta completar la verificación documental.',
   null,
   'e1000000-0000-4000-8000-000000000008', 'e1000000-0000-4000-8000-000000000003',
   current_date - 12, current_date + 18, null, null, 'pendiente', null,
   '02000000-0000-4000-8000-000000000005', true, 'e1000000-0000-4000-8000-000000000008'),

  ('03000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111',
   'NC-2026-005', 'Documento MP-SOP-05 vencido en su fecha de revisión',
   'El procedimiento de registro ante DIMABEL superó su fecha de próxima revisión sin que se confirmara la vigencia de su contenido.',
   'auditoria_interna', 'menor', 'abierta',
   'c1000000-0000-4000-8000-000000000002', null,
   'b1000000-0000-4000-8000-000000000001', null,
   'ISO 9001:2015 · 7.5.3 — Control de la información documentada',
   null, null,
   'e1000000-0000-4000-8000-000000000008', 'e1000000-0000-4000-8000-000000000002',
   current_date - 5, current_date + 25, null, null, 'pendiente', null,
   null, true, 'e1000000-0000-4000-8000-000000000008'),

  ('03000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111',
   'NC-2026-006', 'Caja con faltante de Gs. 185.000 en el arqueo del cierre',
   'El arqueo de caja de la Sucursal Shopping arrojó un faltante de Gs. 185.000 respecto del total facturado del día.',
   'proceso_interno', 'menor', 'en_tratamiento',
   'c1000000-0000-4000-8000-000000000007', 'a1000000-0000-4000-8000-000000000002',
   null, null,
   'ISO 9001:2015 · 8.5.1 — Control de la producción y provisión del servicio',
   'Se reconstruyó el movimiento del día con los comprobantes y se ajustó el registro.',
   'El arqueo se realiza sin un instructivo escrito, por lo que cada cajero aplica un criterio distinto para los vales internos.',
   'e1000000-0000-4000-8000-000000000006', 'e1000000-0000-4000-8000-000000000006',
   current_date - 30, current_date + 5, null, null, 'pendiente', null,
   null, true, 'e1000000-0000-4000-8000-000000000006')
on conflict (id) do nothing;

-- Cinco porques de la NC-2026-001.
insert into public.nc_porques (no_conformidad_id, orden, pregunta, respuesta) values
  ('03000000-0000-4000-8000-000000000001', 1, '¿Por qué ocurrió la desviación?',
   'Porque el stock físico no coincidía con el registrado en el sistema.'),
  ('03000000-0000-4000-8000-000000000001', 2, '¿Por qué?',
   'Porque hubo egresos de material que no se cargaron en el momento.'),
  ('03000000-0000-4000-8000-000000000001', 3, '¿Por qué?',
   'Porque el operario carga los movimientos al final del turno, de memoria.'),
  ('03000000-0000-4000-8000-000000000001', 4, '¿Por qué?',
   'Porque el procedimiento no exige la carga inmediata ni la doble firma en el egreso.'),
  ('03000000-0000-4000-8000-000000000001', 5, '¿Por qué?',
   'Porque el procedimiento MP-SOP-04 se redactó antes de que el depósito manejara material controlado y nunca se actualizó.');

-- Ishikawa de la NC-2026-001.
insert into public.nc_ishikawa (no_conformidad_id, categoria, causa, es_causa_raiz) values
  ('03000000-0000-4000-8000-000000000001', 'metodo',
   'El procedimiento no define la frecuencia del conteo cíclico.', true),
  ('03000000-0000-4000-8000-000000000001', 'metodo',
   'No se exige doble firma en el egreso de material controlado.', true),
  ('03000000-0000-4000-8000-000000000001', 'mano_de_obra',
   'La carga de movimientos se hace de memoria al cierre del turno.', false),
  ('03000000-0000-4000-8000-000000000001', 'medicion',
   'No hay indicador de exactitud de inventario que anticipe la diferencia.', false),
  ('03000000-0000-4000-8000-000000000001', 'maquina',
   'El lector de código de barras del sector falla de forma intermitente.', false),
  ('03000000-0000-4000-8000-000000000001', 'medio_ambiente',
   'El sector de material controlado tiene iluminación deficiente.', false);

-- Ishikawa de la NC-2026-003.
insert into public.nc_ishikawa (no_conformidad_id, categoria, causa, es_causa_raiz) values
  ('03000000-0000-4000-8000-000000000003', 'mano_de_obra',
   'El vendedor no recibió capacitación técnica sobre calibres.', true),
  ('03000000-0000-4000-8000-000000000003', 'metodo',
   'La inducción del personal nuevo no incluye contenido técnico de producto.', true);

-- Planes de accion.
insert into public.nc_acciones (
  no_conformidad_id, tipo, descripcion, responsable_id, fecha_limite, estado,
  fecha_ejecucion, evidencia, verificado_por, fecha_verificacion, nivel_escalamiento
) values
  ('03000000-0000-4000-8000-000000000001', 'correccion',
   'Recontar la totalidad del sector de material controlado y ajustar el registro.',
   'e1000000-0000-4000-8000-000000000004', current_date - 18, 'verificada',
   current_date - 19, 'Acta de conteo del sector firmada por depósito y calidad.',
   'e1000000-0000-4000-8000-000000000002', current_date - 15, 0),
  ('03000000-0000-4000-8000-000000000001', 'accion_correctiva',
   'Actualizar el procedimiento MP-SOP-04 incorporando la frecuencia de conteo y la doble firma en el egreso.',
   'e1000000-0000-4000-8000-000000000004', current_date - 14, 'pendiente', null, null, null, null, 1),
  ('03000000-0000-4000-8000-000000000001', 'accion_correctiva',
   'Capacitar al personal de depósito en el procedimiento actualizado.',
   'e1000000-0000-4000-8000-000000000004', current_date + 12, 'pendiente', null, null, null, null, 0),

  ('03000000-0000-4000-8000-000000000002', 'accion_correctiva',
   'Incorporar al procedimiento de compras un umbral de atrasos que active la reevaluación anticipada del proveedor.',
   'e1000000-0000-4000-8000-000000000005', current_date - 5, 'ejecutada',
   current_date - 6, 'Procedimiento actualizado y comunicado a compras.', null, null, 0),
  ('03000000-0000-4000-8000-000000000002', 'accion_correctiva',
   'Reevaluar a Transportes Ñemity fuera del calendario anual.',
   'e1000000-0000-4000-8000-000000000005', current_date + 8, 'en_curso', null, null, null, null, 0),

  ('03000000-0000-4000-8000-000000000003', 'accion_correctiva',
   'Incorporar el módulo técnico de producto a la inducción del personal de salón.',
   'e1000000-0000-4000-8000-000000000003', current_date - 100, 'verificada',
   current_date - 105, 'Plan de inducción actualizado y dictado a tres vendedores.',
   'e1000000-0000-4000-8000-000000000002', current_date - 88, 0),

  ('03000000-0000-4000-8000-000000000004', 'correccion',
   'Completar la verificación documental de la venta observada antes de la entrega.',
   'e1000000-0000-4000-8000-000000000003', current_date - 10, 'ejecutada',
   current_date - 11, 'Lista de verificación completa archivada con la factura.', null, null, 0),
  ('03000000-0000-4000-8000-000000000004', 'accion_correctiva',
   'Bloquear la emisión de la factura en el punto de venta hasta completar la lista de verificación.',
   'e1000000-0000-4000-8000-000000000007', current_date + 18, 'en_curso', null, null, null, null, 0),

  ('03000000-0000-4000-8000-000000000005', 'accion_correctiva',
   'Revisar el contenido del MP-SOP-05 y publicar la versión que corresponda.',
   'e1000000-0000-4000-8000-000000000002', current_date + 20, 'pendiente', null, null, null, null, 0),

  ('03000000-0000-4000-8000-000000000006', 'accion_correctiva',
   'Redactar y aprobar el instructivo de arqueo diario de caja (IT-01).',
   'e1000000-0000-4000-8000-000000000006', current_date + 5, 'en_curso', null, null, null, null, 0);

-- ---------------------------------------------------------------------
-- Auditorias internas
-- ---------------------------------------------------------------------
insert into public.programas_auditoria (id, empresa_id, anio, nombre, objetivo, estado, aprobado_por, fecha_aprobacion, es_demostracion) values
  ('04000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   extract(year from current_date)::int,
   'Programa anual de auditorías internas',
   'Verificar la conformidad del sistema de gestión con la norma ISO 9001:2015 y con la normativa aplicable al material controlado.',
   'en_ejecucion', 'e1000000-0000-4000-8000-000000000001', current_date - 220, true)
on conflict (id) do nothing;

insert into public.auditorias (
  id, empresa_id, programa_id, codigo, tipo, proceso_id, norma_id, sede_id,
  auditor_lider_id, objetivo, alcance, criterios, fecha_planificada, fecha_inicio,
  fecha_fin, estado, conclusiones, es_demostracion
) values
  ('05000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   '04000000-0000-4000-8000-000000000001', 'AUD-2026-01', 'interna',
   'c1000000-0000-4000-8000-000000000005', 'b1000000-0000-4000-8000-000000000001',
   'a1000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000008',
   'Verificar el control de existencias y la trazabilidad del material en depósito.',
   'Recepción, almacenamiento y despacho del Depósito Central.',
   'ISO 9001:2015 y MP-SOP-04.', current_date - 200, current_date - 200,
   current_date - 198, 'cerrada',
   'Se detectaron dos hallazgos, uno de ellos derivado a no conformidad.', true),

  ('05000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   '04000000-0000-4000-8000-000000000001', 'AUD-2026-02', 'interna',
   'c1000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000002',
   'a1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000008',
   'Verificar el cumplimiento de la verificación documental previa a la venta.',
   'Proceso comercial de la Sucursal Shopping.',
   'Ley 4036/2010 y MP-SOP-05.', current_date - 15, current_date - 14,
   current_date - 13, 'informe_pendiente', null, true),

  ('05000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   '04000000-0000-4000-8000-000000000001', 'AUD-2026-03', 'interna',
   'c1000000-0000-4000-8000-000000000007', 'b1000000-0000-4000-8000-000000000001',
   'a1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000008',
   'Verificar la gestión de cuentas por cobrar y el arqueo de caja.',
   'Proceso de cobranzas de Casa Central.',
   'ISO 9001:2015.', current_date + 35, null, null, 'planificada', null, true),

  ('05000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   '04000000-0000-4000-8000-000000000001', 'AUD-2026-04', 'interna',
   'c1000000-0000-4000-8000-000000000008', 'b1000000-0000-4000-8000-000000000001',
   'a1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000008',
   'Verificar la gestión de respaldos y la continuidad de los sistemas.',
   'Infraestructura y sistemas de TI.',
   'ISO 9001:2015 · 7.1.3.', current_date + 80, null, null, 'planificada', null, true)
on conflict (id) do nothing;

insert into public.auditoria_equipo (auditoria_id, usuario_id, rol_equipo) values
  ('05000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000008', 'auditor líder'),
  ('05000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002', 'auditor'),
  ('05000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000008', 'auditor líder')
on conflict do nothing;

insert into public.auditoria_hallazgos (
  auditoria_id, codigo, tipo, requisito, descripcion, evidencia, proceso_id,
  no_conformidad_id, registrado_por
) values
  ('05000000-0000-4000-8000-000000000001', 'H-01', 'no_conformidad_menor',
   'ISO 9001:2015 · 7.5.3',
   'El procedimiento MP-SOP-04 no define la frecuencia del conteo cíclico.',
   'Lectura del procedimiento vigente y entrevista al encargado de depósito.',
   'c1000000-0000-4000-8000-000000000005', '03000000-0000-4000-8000-000000000001',
   'e1000000-0000-4000-8000-000000000008'),
  ('05000000-0000-4000-8000-000000000001', 'H-02', 'observacion',
   'ISO 9001:2015 · 7.1.3',
   'La iluminación del sector de material controlado dificulta la lectura de las etiquetas.',
   'Verificación en el lugar durante la auditoría.',
   'c1000000-0000-4000-8000-000000000005', null, 'e1000000-0000-4000-8000-000000000008'),
  ('05000000-0000-4000-8000-000000000002', 'H-03', 'no_conformidad_mayor',
   'Ley 4036/2010 · Art. 31',
   'Se emitió una factura de material controlado sin completar la verificación documental del comprador.',
   'Muestreo de diez ventas del período; una sin lista de verificación.',
   'c1000000-0000-4000-8000-000000000003', '03000000-0000-4000-8000-000000000004',
   'e1000000-0000-4000-8000-000000000008'),
  ('05000000-0000-4000-8000-000000000002', 'H-04', 'oportunidad_mejora',
   'ISO 9001:2015 · 7.2',
   'Conviene incorporar la verificación documental como paso bloqueante del punto de venta.',
   'Sugerencia surgida de la entrevista con el jefe comercial.',
   'c1000000-0000-4000-8000-000000000003', null, 'e1000000-0000-4000-8000-000000000008');

-- ---------------------------------------------------------------------
-- Indicadores y objetivos
-- ---------------------------------------------------------------------
insert into public.indicadores (
  id, empresa_id, codigo, nombre, descripcion, proceso_id, responsable_id,
  formula, unidad, frecuencia, sentido, meta, activo, es_demostracion
) values
  ('06000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'KPI-01', 'Exactitud de inventario',
   'Coincidencia entre el stock físico y el registrado en el sistema.',
   'c1000000-0000-4000-8000-000000000005', 'e1000000-0000-4000-8000-000000000004',
   '(1 − diferencias / unidades contadas) × 100', '%', 'mensual', 'mayor_mejor', 98, true, true),
  ('06000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'KPI-02', 'Reclamos de clientes',
   'Cantidad de reclamos formales recibidos en el período.',
   'c1000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000003',
   'Suma de reclamos registrados', 'reclamos', 'mensual', 'menor_mejor', 2, true, true),
  ('06000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'KPI-03', 'Morosidad de la cartera',
   'Proporción de la cartera con más de treinta días de atraso.',
   'c1000000-0000-4000-8000-000000000007', 'e1000000-0000-4000-8000-000000000006',
   'Cartera vencida / cartera total × 100', '%', 'mensual', 'menor_mejor', 8, true, true),
  ('06000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   'KPI-04', 'Cumplimiento del plan de auditorías',
   'Auditorías cerradas sobre auditorías planificadas del año.',
   'c1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002',
   'Auditorías cerradas / planificadas × 100', '%', 'trimestral', 'mayor_mejor', 100, true, true),
  ('06000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111',
   'KPI-05', 'Cierre de no conformidades en plazo',
   'No conformidades cerradas dentro de la fecha límite comprometida.',
   'c1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002',
   'NC cerradas en plazo / NC cerradas × 100', '%', 'mensual', 'mayor_mejor', 90, true, true),
  ('06000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111',
   'KPI-06', 'Entregas de proveedores en plazo',
   'Despachos recibidos dentro del plazo comprometido.',
   'c1000000-0000-4000-8000-000000000004', 'e1000000-0000-4000-8000-000000000005',
   'Entregas en plazo / entregas totales × 100', '%', 'mensual', 'mayor_mejor', 95, true, true)
on conflict (id) do nothing;

-- Mediciones de los ultimos seis meses.
insert into public.indicador_mediciones (indicador_id, periodo, valor_real, meta_periodo, cargado_por)
select
  i.id,
  (date_trunc('month', current_date) - (mes || ' months')::interval)::date,
  -- mes = 0 es el periodo mas reciente. Los valores mejoran hacia el
  -- presente, de modo que el tablero muestre una mezcla realista de
  -- indicadores en meta y fuera de meta, no un escenario uniforme.
  case i.codigo
    when 'KPI-01' then (98.6 - mes * 0.20)::numeric(14,2)   -- meta 98, mayor mejor
    when 'KPI-02' then greatest(0, mes - 2)::numeric(14,2)  -- meta 2, menor mejor
    when 'KPI-03' then (7.2 + mes * 0.45)::numeric(14,2)    -- meta 8, menor mejor
    when 'KPI-04' then (100 - mes * 10)::numeric(14,2)      -- meta 100, trimestral
    when 'KPI-05' then (93 - mes * 1.20)::numeric(14,2)     -- meta 90, mayor mejor
    else (95.8 - mes * 0.40)::numeric(14,2)                 -- meta 95, mayor mejor
  end,
  i.meta,
  'e1000000-0000-4000-8000-000000000002'
from public.indicadores i
cross join generate_series(0, 5) as mes
where i.es_demostracion
  and (i.frecuencia = 'mensual' or mes % 3 = 0)
on conflict (indicador_id, periodo) do nothing;

insert into public.objetivos (
  id, empresa_id, codigo, nombre, descripcion, proceso_id, responsable_id,
  anio, meta, avance_porcentaje, estado, es_demostracion
) values
  ('07000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'OBJ-01', 'Elevar la exactitud de inventario al 99 %',
   'Reducir las diferencias de inventario mediante el conteo cíclico y la doble firma.',
   'c1000000-0000-4000-8000-000000000005', 'e1000000-0000-4000-8000-000000000004',
   extract(year from current_date)::int, '99 % de exactitud sostenida', 65, 'en_curso', true),
  ('07000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'OBJ-02', 'Reducir la morosidad por debajo del 8 %',
   'Implantar el análisis de crédito previo y el seguimiento semanal de la cartera.',
   'c1000000-0000-4000-8000-000000000007', 'e1000000-0000-4000-8000-000000000006',
   extract(year from current_date)::int, 'Morosidad menor al 8 %', 45, 'en_curso', true),
  ('07000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'OBJ-03', 'Cerrar el 100 % del programa anual de auditorías',
   'Ejecutar las cuatro auditorías internas planificadas para el ejercicio.',
   'c1000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002',
   extract(year from current_date)::int, '4 de 4 auditorías cerradas', 25, 'en_curso', true)
on conflict (id) do nothing;

insert into public.objetivo_indicadores (objetivo_id, indicador_id) values
  ('07000000-0000-4000-8000-000000000001', '06000000-0000-4000-8000-000000000001'),
  ('07000000-0000-4000-8000-000000000002', '06000000-0000-4000-8000-000000000003'),
  ('07000000-0000-4000-8000-000000000003', '06000000-0000-4000-8000-000000000004')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Satisfaccion del cliente
-- ---------------------------------------------------------------------
-- Nota: el panel de NPS de Camping 44 sigue siendo la fuente real. Estos
-- registros solo ilustran la estructura preparada para ingerirlos.
insert into public.encuestas (
  id, empresa_id, codigo, nombre, tipo, descripcion, fecha_inicio, fecha_fin,
  activa, fuente_externa, es_demostracion
) values
  ('08000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'ENC-01', 'NPS posventa', 'nps',
   'Encuesta breve enviada al cliente luego de la compra.',
   current_date - 180, null, true, 'panel-nps-apps-script', true)
on conflict (id) do nothing;

insert into public.encuesta_respuestas (encuesta_id, cliente_id, fecha, puntaje, comentario, canal, sede_id, referencia_externa) values
  ('08000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', current_date - 5, 10,
   'Excelente asesoramiento técnico en el mostrador.', 'correo', 'a1000000-0000-4000-8000-000000000001', 'demo-001'),
  ('08000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002', current_date - 9, 6,
   'Me entregaron un calibre distinto al pedido; se resolvió, pero perdí el viaje.', 'correo', 'a1000000-0000-4000-8000-000000000001', 'demo-002'),
  ('08000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000003', current_date - 14, 9,
   'Muy buena atención y stock disponible.', 'whatsapp', 'a1000000-0000-4000-8000-000000000002', 'demo-003'),
  ('08000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000004', current_date - 20, 8,
   'Buen producto, la entrega demoró más de lo previsto.', 'correo', 'a1000000-0000-4000-8000-000000000003', 'demo-004'),
  ('08000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', current_date - 32, 9,
   'Cumplieron con el plazo comprometido.', 'correo', 'a1000000-0000-4000-8000-000000000001', 'demo-005'),
  ('08000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000003', current_date - 41, 4,
   'Demora de dos semanas en la entrega de un pedido ya pagado.', 'telefono', 'a1000000-0000-4000-8000-000000000003', 'demo-006'),
  ('08000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000002', current_date - 55, 10,
   'El personal conoce el producto, se nota la capacitación.', 'correo', 'a1000000-0000-4000-8000-000000000002', 'demo-007'),
  ('08000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000004', current_date - 70, 7,
   'Todo correcto, sin observaciones.', 'correo', 'a1000000-0000-4000-8000-000000000001', 'demo-008')
on conflict do nothing;

-- Historia de doce meses para que la tendencia de NPS tenga de donde
-- salir. La mayoria de quien responde un NPS no deja comentario: estas
-- filas son solo el puntaje, y las de arriba, las que si comentaron.
-- La mezcla mensual esta elegida para reflejar una mejora sostenida
-- desde el arranque del sistema de gestion.
insert into public.encuesta_respuestas (encuesta_id, cliente_id, fecha, puntaje, canal, sede_id, referencia_externa)
select
  '08000000-0000-4000-8000-000000000001',
  case (n % 4)
    when 0 then 'f1000000-0000-4000-8000-000000000001'
    when 1 then 'f1000000-0000-4000-8000-000000000002'
    when 2 then 'f1000000-0000-4000-8000-000000000003'
    else 'f1000000-0000-4000-8000-000000000004'
  end::uuid,
  -- Repartidas dentro del mes, no todas el mismo dia. El "least" evita
  -- que el mes en curso genere respuestas con fecha futura.
  least(
    (date_trunc('month', current_date) - (m.mes_atras || ' months')::interval)::date
      + ((n * 3) % 26),
    current_date
  ),
  case
    when n <= m.promotores then 9 + (n % 2)              -- 9 o 10
    when n <= m.promotores + m.pasivos then 7 + (n % 2)  -- 7 u 8
    else 3 + (n % 4)                                     -- 3 a 6
  end,
  case (n % 3) when 0 then 'correo' when 1 then 'whatsapp' else 'telefono' end,
  case (n % 3)
    when 0 then 'a1000000-0000-4000-8000-000000000001'
    when 1 then 'a1000000-0000-4000-8000-000000000002'
    else 'a1000000-0000-4000-8000-000000000003'
  end::uuid,
  'demo-hist-' || m.mes_atras || '-' || n
from (values
  -- mes_atras, promotores, pasivos, detractores  (NPS resultante)
  (11, 3, 2, 2),   -- +14
  (10, 4, 2, 2),   -- +25
  ( 9, 4, 3, 2),   -- +22
  ( 8, 5, 2, 2),   -- +33
  ( 7, 5, 3, 1),   -- +44
  ( 6, 6, 2, 2),   -- +40
  ( 5, 6, 3, 1),   -- +50
  ( 4, 7, 2, 1),   -- +60
  ( 3, 6, 3, 2),   -- +36
  ( 2, 7, 3, 1),   -- +55
  ( 1, 8, 2, 1),   -- +64
  ( 0, 5, 2, 1)    -- mes en curso, todavia parcial
) as m(mes_atras, promotores, pasivos, detractores),
lateral generate_series(1, m.promotores + m.pasivos + m.detractores) as n
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Intranet: fechas de legajo, para cumpleanos y aniversarios
-- ---------------------------------------------------------------------
-- Se reparten a lo largo del ano a proposito: si todos cumplieran el
-- mismo mes, la pantalla de inicio se veria bien hoy y vacia en octubre.
update public.usuarios set fecha_nacimiento = date '1978-03-14', fecha_ingreso = date '2015-02-02'
 where id = 'e1000000-0000-4000-8000-000000000001';
update public.usuarios set fecha_nacimiento = date '1986-08-27', fecha_ingreso = date '2019-04-15'
 where id = 'e1000000-0000-4000-8000-000000000002';
update public.usuarios set fecha_nacimiento = date '1983-11-05', fecha_ingreso = date '2017-08-21'
 where id = 'e1000000-0000-4000-8000-000000000003';
update public.usuarios set fecha_nacimiento = date '1990-08-30', fecha_ingreso = date '2021-06-01'
 where id = 'e1000000-0000-4000-8000-000000000004';
update public.usuarios set fecha_nacimiento = date '1988-01-19', fecha_ingreso = date '2020-09-14'
 where id = 'e1000000-0000-4000-8000-000000000005';
update public.usuarios set fecha_nacimiento = date '1992-05-23', fecha_ingreso = date '2022-03-07'
 where id = 'e1000000-0000-4000-8000-000000000006';
update public.usuarios set fecha_nacimiento = date '1995-09-08', fecha_ingreso = date '2023-01-16'
 where id = 'e1000000-0000-4000-8000-000000000007';
update public.usuarios set fecha_nacimiento = date '1981-06-11', fecha_ingreso = date '2018-11-05'
 where id = 'e1000000-0000-4000-8000-000000000008';
update public.usuarios set fecha_nacimiento = date '1997-08-12', fecha_ingreso = date '2026-07-27'
 where id = 'e1000000-0000-4000-8000-000000000009';

-- ---------------------------------------------------------------------
-- Intranet: publicaciones del muro
-- ---------------------------------------------------------------------
insert into public.publicaciones (
  id, empresa_id, tipo, titulo, cuerpo, resumen, estado, fijada,
  fecha_publicacion, fecha_vencimiento, usuario_referido_id, proceso_id,
  es_demostracion, creado_por
) values
  ('0c000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'anuncio',
   'Entra en vigencia el nuevo procedimiento de venta de material controlado',
   E'Desde el lunes rige la versión 03 del procedimiento MP-SOP-01. Los cambios principales son dos:\n\n1. La verificación del adquirente se registra antes de emitir la factura, no después.\n2. Toda venta de material controlado queda con el número de registro en el comprobante.\n\nEl procedimiento completo está en Documentación. Ante cualquier duda, consulten con Calidad antes de aplicar criterio propio.',
   'Rige la versión 03 del MP-SOP-01. La verificación del adquirente pasa a hacerse antes de facturar.',
   'publicada', true, now() - interval '2 days', current_date + 30,
   null, 'c1000000-0000-4000-8000-000000000003', true,
   'e1000000-0000-4000-8000-000000000002'),

  ('0c000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'logro',
   'Adjudicada la licitación de equipamiento para la Gobernación',
   E'Se adjudicó a Camping 44 la provisión de equipamiento de campamento y seguridad para la Gobernación, por un plazo de doce meses.\n\nEs la licitación más grande que ganamos hasta hoy, y se ganó con el pliego técnico armado por Comercial junto con Compras. La entrega arranca el mes que viene.',
   'La licitación más grande que ganamos hasta hoy. Entrega a doce meses, arranca el mes que viene.',
   'publicada', false, now() - interval '6 days', null,
   null, 'c1000000-0000-4000-8000-000000000003', true,
   'e1000000-0000-4000-8000-000000000001'),

  ('0c000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'bienvenida',
   'Le damos la bienvenida a Nicolás Giménez',
   E'Nicolás se suma como Vendedor de salón en Casa Central. Viene del rubro outdoor y conoce bien la línea de campamento.\n\nDurante su primera semana va a estar rotando por depósito y por caja para ver la operación completa. Si lo cruzan, preséntense.',
   'Se suma como Vendedor de salón en Casa Central.',
   'publicada', false, now() - interval '9 days', null,
   'e1000000-0000-4000-8000-000000000009', 'c1000000-0000-4000-8000-000000000003', true,
   'e1000000-0000-4000-8000-000000000002'),

  ('0c000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   'reconocimiento',
   'Depósito: el área más ordenada del mes',
   E'El reconocimiento de área más ordenada del mes es para Depósito.\n\nEl conteo cíclico se cerró sin diferencias por segundo mes consecutivo, y la señalización de pasillos quedó completa. Marcos y su equipo se lo ganaron.',
   'Segundo mes consecutivo cerrando el conteo cíclico sin diferencias.',
   'publicada', false, now() - interval '13 days', null,
   'e1000000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000005', true,
   'e1000000-0000-4000-8000-000000000001'),

  ('0c000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111',
   'novedad_producto',
   'Llega la línea de carpas de montaña temporada 2027',
   E'Entra a depósito la línea de carpas de montaña de la temporada 2027: tres modelos, de dos a cuatro plazas, con columna de agua de 3000 mm.\n\nLas fichas técnicas y el comparativo contra la línea anterior están en Documentación. Comercial: mírenlo antes de que empiece a preguntar el cliente.',
   'Tres modelos, de dos a cuatro plazas. Las fichas técnicas ya están cargadas.',
   'publicada', false, now() - interval '4 days', null,
   null, 'c1000000-0000-4000-8000-000000000003', true,
   'e1000000-0000-4000-8000-000000000003'),

  ('0c000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111',
   'evento',
   'Cierre contable de agosto: viernes 28',
   E'El cierre contable de agosto es el viernes 28 a las 18:00.\n\nToda rendición de gastos, nota de crédito o ajuste de inventario que quede fuera de ese horario pasa a septiembre. No hay excepciones, y avisar el lunes siguiente no sirve de nada.',
   'Viernes 28 a las 18:00. Lo que quede afuera pasa a septiembre.',
   'publicada', false, now() - interval '1 day', current_date + 5,
   null, 'c1000000-0000-4000-8000-000000000007', true,
   'e1000000-0000-4000-8000-000000000005')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- Recursos humanos
-- ---------------------------------------------------------------------
insert into public.competencias (id, empresa_id, codigo, nombre, descripcion, tipo) values
  ('09000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'CMP-01', 'Conocimiento técnico de producto',
   'Calibres, munición, compatibilidad y uso del equipamiento comercializado.', 'tecnica'),
  ('09000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'CMP-02', 'Normativa de material controlado',
   'Ley 4036/2010 y resoluciones de DIMABEL aplicables a la venta.', 'legal'),
  ('09000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'CMP-03', 'Atención al cliente',
   'Escucha, asesoramiento y manejo de reclamos.', 'conductual'),
  ('09000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   'CMP-04', 'Gestión de inventarios',
   'Conteo cíclico, trazabilidad y control de existencias.', 'tecnica'),
  ('09000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111',
   'CMP-05', 'Sistema de gestión de la calidad',
   'Norma ISO 9001:2015 y procedimientos internos del SGC.', 'tecnica')
on conflict (id) do nothing;

insert into public.puesto_competencias (puesto_id, competencia_id, nivel_requerido, critica) values
  ('d1000000-0000-4000-8000-000000000004', '09000000-0000-4000-8000-000000000001', 4, true),
  ('d1000000-0000-4000-8000-000000000004', '09000000-0000-4000-8000-000000000002', 5, true),
  ('d1000000-0000-4000-8000-000000000004', '09000000-0000-4000-8000-000000000003', 4, false),
  ('d1000000-0000-4000-8000-000000000005', '09000000-0000-4000-8000-000000000004', 5, true),
  ('d1000000-0000-4000-8000-000000000005', '09000000-0000-4000-8000-000000000002', 4, true),
  ('d1000000-0000-4000-8000-000000000002', '09000000-0000-4000-8000-000000000005', 5, true),
  ('d1000000-0000-4000-8000-000000000003', '09000000-0000-4000-8000-000000000001', 5, true)
on conflict do nothing;

insert into public.evaluaciones_competencia (usuario_id, competencia_id, nivel_actual, nivel_requerido, fecha, evaluado_por, observacion) values
  ('e1000000-0000-4000-8000-000000000009', '09000000-0000-4000-8000-000000000001', 2, 4, current_date - 110,
   'e1000000-0000-4000-8000-000000000003', 'Brecha detectada a raíz del reclamo NC-2026-003.'),
  ('e1000000-0000-4000-8000-000000000009', '09000000-0000-4000-8000-000000000002', 4, 5, current_date - 110,
   'e1000000-0000-4000-8000-000000000003', 'Conoce la normativa; falta profundizar en resoluciones recientes.'),
  ('e1000000-0000-4000-8000-000000000009', '09000000-0000-4000-8000-000000000003', 4, 4, current_date - 110,
   'e1000000-0000-4000-8000-000000000003', 'Sin brecha.'),
  ('e1000000-0000-4000-8000-000000000004', '09000000-0000-4000-8000-000000000004', 4, 5, current_date - 60,
   'e1000000-0000-4000-8000-000000000001', 'Brecha a cubrir con la capacitación de inventarios.');

insert into public.capacitaciones (
  id, empresa_id, codigo, nombre, descripcion, tipo, proveedor_nombre, instructor,
  fecha_inicio, fecha_fin, horas, costo_gs, estado, competencia_id, es_demostracion
) values
  ('0a000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'CAP-01', 'Inducción técnica de producto para personal de salón',
   'Calibres, munición y compatibilidad del equipamiento comercializado.',
   'interna', null, 'Lucía Ayala', current_date - 100, current_date - 99, 8, 0,
   'finalizada', '09000000-0000-4000-8000-000000000001', true),
  ('0a000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'CAP-02', 'Actualización normativa Ley 4036/2010 y resoluciones DIMABEL',
   'Obligaciones de registro, verificación del adquirente y reportes.',
   'externa', 'Consultora Legal Guaraní', 'Abg. R. Espínola',
   current_date - 45, current_date - 45, 6, 3711850, 'finalizada',
   '09000000-0000-4000-8000-000000000002', true),
  ('0a000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'CAP-03', 'Conteo cíclico y trazabilidad de inventario',
   'Metodología de conteo, ajustes y control de material controlado.',
   'interna', null, 'Marcos Duarte', current_date + 20, current_date + 20, 4, 0,
   'planificada', '09000000-0000-4000-8000-000000000004', true),
  ('0a000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   'CAP-04', 'Formación de auditores internos ISO 9001:2015',
   'Planificación, ejecución e informe de auditorías internas.',
   'externa', 'Instituto de Calidad del Paraguay', 'Ing. M. Sanabria',
   current_date + 55, current_date + 57, 16, 12500000, 'planificada',
   '09000000-0000-4000-8000-000000000005', true)
on conflict (id) do nothing;

insert into public.capacitacion_participantes (capacitacion_id, usuario_id, asistio, calificacion, eficacia, fecha_evaluacion_eficacia, observacion) values
  ('0a000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000009', true, 88, 'eficaz',
   current_date - 70, 'Sin reclamos por asesoramiento desde la capacitación.'),
  ('0a000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000003', true, 95, 'eficaz',
   current_date - 70, 'Replicó el contenido al resto del equipo.'),
  ('0a000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000003', true, 90, 'pendiente', null, null),
  ('0a000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000002', true, 92, 'pendiente', null, null),
  ('0a000000-0000-4000-8000-000000000002', 'e1000000-0000-4000-8000-000000000009', false, null, 'pendiente',
   null, 'No asistió; se reprograma su participación en la próxima edición.'),
  ('0a000000-0000-4000-8000-000000000003', 'e1000000-0000-4000-8000-000000000004', false, null, 'pendiente', null, null)
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Infraestructura y activos
-- ---------------------------------------------------------------------
insert into public.activos (
  id, empresa_id, codigo, nombre, categoria, descripcion, sede_id, ubicacion,
  responsable_id, proveedor_id, numero_serie, marca, modelo, estado,
  fecha_adquisicion, valor_gs, requiere_mantenimiento,
  frecuencia_mantenimiento_dias, fecha_ultimo_mantenimiento,
  fecha_proximo_mantenimiento, es_demostracion
) values
  ('0b000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111',
   'ACT-001', 'Servidor de aplicaciones', 'Equipamiento informático',
   'Servidor local de respaldo y sistemas administrativos.',
   'a1000000-0000-4000-8000-000000000001', 'Sala de servidores',
   'e1000000-0000-4000-8000-000000000007', 'f2000000-0000-4000-8000-000000000005',
   'SRV-2023-118', 'Dell', 'PowerEdge T350', 'operativo',
   current_date - 800, 48500000, true, 180, current_date - 150, current_date + 30, true),

  ('0b000000-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111',
   'ACT-002', 'Caja fuerte de material controlado', 'Seguridad',
   'Resguardo del material controlado fuera del horario comercial.',
   'a1000000-0000-4000-8000-000000000003', 'Sector A, depósito',
   'e1000000-0000-4000-8000-000000000004', null,
   'CF-9912', 'Bulldog', 'BD-450', 'operativo',
   current_date - 1200, 22000000, true, 365, current_date - 340, current_date + 25, true),

  ('0b000000-0000-4000-8000-000000000003', '11111111-1111-4111-8111-111111111111',
   'ACT-003', 'Autoelevador manual', 'Logística',
   'Movimiento de pallets en el depósito central.',
   'a1000000-0000-4000-8000-000000000003', 'Playa de recepción',
   'e1000000-0000-4000-8000-000000000004', null,
   'AE-2201', 'Toyota', 'HW-25', 'en_mantenimiento',
   current_date - 500, 15750000, true, 90, current_date - 95, current_date - 5, true),

  ('0b000000-0000-4000-8000-000000000004', '11111111-1111-4111-8111-111111111111',
   'ACT-004', 'Sistema de videovigilancia', 'Seguridad',
   'Doce cámaras distribuidas entre Casa Central y depósito.',
   'a1000000-0000-4000-8000-000000000001', 'Perimetral',
   'e1000000-0000-4000-8000-000000000007', 'f2000000-0000-4000-8000-000000000005',
   'CCTV-4412', 'Hikvision', 'DS-7616', 'operativo',
   current_date - 600, 31200000, true, 120, current_date - 40, current_date + 80, true),

  ('0b000000-0000-4000-8000-000000000005', '11111111-1111-4111-8111-111111111111',
   'ACT-005', 'Deshumidificador industrial', 'Acondicionamiento',
   'Control de humedad del sector de carpas y bolsas de dormir.',
   'a1000000-0000-4000-8000-000000000003', 'Sector oeste',
   'e1000000-0000-4000-8000-000000000004', null,
   'DH-7781', 'Trotec', 'TTK-175', 'operativo',
   current_date - 280, 8900000, true, 60, current_date - 20, current_date + 40, true),

  ('0b000000-0000-4000-8000-000000000006', '11111111-1111-4111-8111-111111111111',
   'ACT-006', 'Punto de venta Sucursal Shopping', 'Equipamiento informático',
   'Terminal, impresora fiscal y lector de código de barras.',
   'a1000000-0000-4000-8000-000000000002', 'Mostrador',
   'e1000000-0000-4000-8000-000000000007', 'f2000000-0000-4000-8000-000000000005',
   'PDV-3310', 'HP', 'RP5800', 'operativo',
   current_date - 400, 12300000, false, null, null, null, true)
on conflict (id) do nothing;

insert into public.mantenimientos (
  activo_id, tipo, descripcion, fecha_programada, fecha_ejecucion, responsable_id,
  proveedor_id, estado, costo_gs, observacion
) values
  ('0b000000-0000-4000-8000-000000000001', 'preventivo',
   'Limpieza interna, verificación de discos y prueba de restauración de respaldos.',
   current_date + 30, null, 'e1000000-0000-4000-8000-000000000007',
   'f2000000-0000-4000-8000-000000000005', 'programado', 1850000, null),
  ('0b000000-0000-4000-8000-000000000002', 'verificacion',
   'Verificación anual del mecanismo de cierre y cambio de combinación.',
   current_date + 25, null, 'e1000000-0000-4000-8000-000000000004', null,
   'programado', 950000, null),
  ('0b000000-0000-4000-8000-000000000003', 'correctivo',
   'Reparación del sistema hidráulico.', current_date - 5, null,
   'e1000000-0000-4000-8000-000000000004', null, 'en_curso', 2400000,
   'Equipo fuera de servicio hasta la reparación.'),
  ('0b000000-0000-4000-8000-000000000005', 'preventivo',
   'Limpieza de filtros y control de la descarga de condensado.',
   current_date + 40, null, 'e1000000-0000-4000-8000-000000000004', null,
   'programado', 350000, null),
  ('0b000000-0000-4000-8000-000000000004', 'preventivo',
   'Limpieza de lentes y verificación de grabación de las doce cámaras.',
   current_date - 40, current_date - 40, 'e1000000-0000-4000-8000-000000000007',
   'f2000000-0000-4000-8000-000000000005', 'ejecutado', 1200000,
   'Sin observaciones.');

-- ---------------------------------------------------------------------
-- Cierre
-- ---------------------------------------------------------------------
select set_config('request.jwt.claim.sub', '', false);

do $$
declare
  v_documentos integer;
  v_nc integer;
  v_riesgos integer;
  v_bitacora integer;
begin
  select count(*) into v_documentos from public.documentos;
  select count(*) into v_nc from public.no_conformidades;
  select count(*) into v_riesgos from public.riesgos;
  select count(*) into v_bitacora from public.bitacora;

  raise notice 'Datos de demostración cargados: % documentos, % no conformidades, % riesgos, % movimientos de bitácora.',
    v_documentos, v_nc, v_riesgos, v_bitacora;
end;
$$;

-- =====================================================================
-- DATOS REALES: 10-mapa-de-procesos.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- DATOS REALES · Mapa de procesos y manuales de proceso
-- =====================================================================
-- Los diecinueve procesos del mapa de Camping 44, con su manual. Salen
-- de la unidad compartida del SGC, carpeta "04 Manuales de Proceso", que
-- ya esta dividida por tipo: estrategicos, misionales y de soporte.
--
-- Esa division coincide con el enum "tipo_proceso" del sistema:
--   MP-EST → estrategico     MP-MIS → operativo     MP-SOP → apoyo
-- ("misional" y "operativo" son el mismo concepto con distinto nombre;
-- se respeta el del enum para no tocar el esquema por una palabra.)
--
-- Cada proceso queda con su manual cargado en "documentos", enlazado al
-- PDF vigente. No se copia el contenido: la intranet indexa y enlaza.
--
-- Los procesos y documentos de demostracion que compartan codigo quedan
-- reemplazados por el real: el codigo es la identidad, y el documento
-- verdadero es el que debe quedarse con el suyo.
--
-- Se aplica DESPUES del seed. Es idempotente.

do $$
declare
  v_empresa uuid;
  v_responsable uuid;
  v_norma uuid;
  -- Los manuales llevan "Vigencia: 25/05/2026" en su propio encabezado.
  v_vigencia constant date := date '2026-05-25';
  r record;
  v_proceso uuid;
begin
  select id into v_empresa from public.empresas order by creado_en limit 1;
  if v_empresa is null then
    raise exception 'No hay ninguna empresa cargada. Aplique el seed primero.';
  end if;

  select id into v_responsable from public.usuarios
   where empresa_id = v_empresa and rol = 'administrador_sgc' and activo
   order by creado_en limit 1;
  if v_responsable is null then
    select id into v_responsable from public.usuarios
     where empresa_id = v_empresa and activo order by creado_en limit 1;
  end if;
  if v_responsable is null then
    raise exception 'No hay usuarios cargados: no se puede asignar responsable.';
  end if;

  select id into v_norma from public.normas limit 1;

  for r in
    select * from (values
      -- codigo,       tipo,           nombre,                                       id de Drive
      ('MP-EST-01', 'estrategico', 'Información Documentada',                      '1_cG6iIUl61FLdFCon3GEgb3maDCZD7aD'),
      ('MP-EST-02', 'estrategico', 'Planificación Estratégica del SGC',            '1wtuLruEKy8qfUQjKjUfNYkArUvFhUGLT'),
      ('MP-EST-03', 'estrategico', 'Auditoría Interna del SGC',                    '1pX4FwLS9_Kx_baBc1v_JNPLTmSh5qHSJ'),
      ('MP-EST-04', 'estrategico', 'No Conformidades y Acciones Correctivas',      '1JrWpsTWYUTyLUpX_pvyB4skr2kVZLrX8'),
      ('MP-MIS-01', 'operativo',   'Importación',                                  '1uK6ogBarCoj6mFdXSenyzqSI_ze1l3VK'),
      ('MP-MIS-02', 'operativo',   'Almacenamiento',                               '1w9Q9OCwbj9vTrbWa2uMpwkx2sGA_aiHU'),
      ('MP-MIS-03', 'operativo',   'Ventas',                                       '1o_N5HGeBtm0TGz658cVSt-E5QGYp8vEQ'),
      ('MP-MIS-04', 'operativo',   'Despacho de Mercadería',                       '1NmOdaeAPNHp_BDuzO01x3PQ9sREj3PUd'),
      ('MP-MIS-05', 'operativo',   'Servicio Técnico',                             '1MBKJ0cZmOtVxdzy9HcRDXzP8igCiaCca'),
      ('MP-MIS-06', 'operativo',   'Operación del Stand de Tiro',                  '1Zq1dLhcwf0RJZ-pwNkgw3WlgpL4bFUJb'),
      ('MP-MIS-07', 'operativo',   'Gestión del Centro de Instrucción',            '1a2YRd85GynWbAIVt9GcvAl1VyShKwqgT'),
      ('MP-SOP-01', 'apoyo',       'Gestión del Capital Humano',                   '1bsNBt42lKECeizR2Lfa-ILdrU99P-V0O'),
      ('MP-SOP-02', 'apoyo',       'Infraestructura y Tecnología',                 '1T4Yh401khasW6X4iMvx4Vg8r9u4HKZ8j'),
      ('MP-SOP-03', 'apoyo',       'Gestión de Créditos',                          '1hvLfW03V2R7DBztNezqIBXrLyIsS1p57'),
      ('MP-SOP-04', 'apoyo',       'Gestión de Cobranzas',                         '1g-sv1TZxViVkOVHfSPtoNqQ6D8FbDSpc'),
      ('MP-SOP-05', 'apoyo',       'Inventario de Existencias',                    '1Cp3fmOd_czf9SBhedN-WZyffJ5CkT6sh'),
      ('MP-SOP-06', 'apoyo',       'Facturación y Notas de Crédito',               '17pLevHQJZM8ihtQGaHmOuZbPJelpZ5Y-'),
      ('MP-SOP-07', 'apoyo',       'Seguridad Informática',                        '1S4nXqhUevm6y2AuReHmzpci1Pcc1m7h_'),
      ('MP-SOP-08', 'apoyo',       'Compras locales y Evaluación a Proveedores',   '15lT-5jfwblLJh9HwJ-SejK5ytmo9nFIG')
    ) as t(codigo, tipo, nombre, drive_id)
  loop
    -- El proceso lleva el codigo del manual sin el prefijo "MP-": el
    -- manual documenta al proceso, no es el proceso.
    insert into public.procesos (empresa_id, codigo, nombre, tipo, descripcion)
    values (
      v_empresa,
      replace(r.codigo, 'MP-', ''),
      r.nombre,
      r.tipo::public.tipo_proceso,
      'Documentado en el manual ' || r.codigo || '.'
    )
    on conflict (empresa_id, lower(codigo)) do update set
      nombre = excluded.nombre, tipo = excluded.tipo,
      descripcion = excluded.descripcion
    returning id into v_proceso;

    insert into public.documentos (
      empresa_id, codigo, titulo, tipo, estado, proceso_id, norma_id,
      responsable_id, elaborador_id, version_actual,
      fecha_aprobacion, fecha_vigencia, fecha_proxima_revision,
      periodicidad_revision_meses, es_demostracion, url_documento
    ) values (
      v_empresa, r.codigo, r.nombre, 'manual', 'vigente', v_proceso, v_norma,
      v_responsable, v_responsable, 0,
      v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12, false,
      'https://drive.google.com/file/d/' || r.drive_id || '/view'
    )
    on conflict (empresa_id, upper(codigo)) do update set
      titulo = excluded.titulo,
      tipo = excluded.tipo,
      estado = excluded.estado,
      proceso_id = excluded.proceso_id,
      version_actual = excluded.version_actual,
      fecha_vigencia = excluded.fecha_vigencia,
      fecha_proxima_revision = excluded.fecha_proxima_revision,
      es_demostracion = false,
      url_documento = excluded.url_documento;
  end loop;
end;
$$;

-- =====================================================================
-- DATOS REALES: 20-perfiles-de-puesto.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- DATOS REALES · Perfiles de puesto (formulario R-02-01)
-- =====================================================================
-- Estos NO son datos de demostracion: son los nueve perfiles R-02-01
-- vigentes de Camping 44, transcriptos de los documentos del Drive.
-- Por eso van fuera del seed y no llevan "es_demostracion".
--
-- Se aplica DESPUES del seed, porque necesita que exista la empresa.
--   psql "<cadena de conexion>" -f supabase/datos-reales/perfiles-de-puesto.sql
--
-- Es idempotente: se puede volver a correr y actualiza en lugar de
-- duplicar.
--
-- PENDIENTE DE CALIDAD: el formulario R-02-01 no lleva codigo de puesto,
-- asi que se asignaron correlativos provisionales P-101 en adelante. Si
-- Calidad ya tiene una codificacion, se reemplaza aca.

do $$
declare
  v_empresa uuid;
  v_logistica uuid;
  v_jefe_logistica uuid;
begin
  select id into v_empresa from public.empresas order by creado_en limit 1;
  if v_empresa is null then
    raise exception 'No hay ninguna empresa cargada. Aplique el seed primero.';
  end if;

  -- El proceso de logistica puede no existir todavia; si falta, los
  -- puestos quedan sin proceso en vez de fallar.
  select id into v_logistica from public.procesos
   where empresa_id = v_empresa and nombre ilike '%log%stica%' limit 1;

  -- -------------------------------------------------------------------
  -- Jefe de Logistica. Va primero porque los demas le reportan.
  -- -------------------------------------------------------------------
  insert into public.puestos (
    empresa_id, codigo, nombre, area, proceso_id, mision,
    codigo_formulario, revision, supervisado_por, reemplazado_por,
    responsabilidades_generales, funciones,
    formacion_academica, formacion_complementaria, experiencia,
    requiere_registro_conducir, requiere_movilidad_propia,
    requiere_viajes_interior, requiere_viajes_exterior, requiere_horario_extendido
  ) values (
    v_empresa, 'P-101', 'Jefe de Logística', 'Logística y Operaciones', v_logistica,
    'Gestiona el área Logística y de distribución, liderando a su equipo de trabajo con la finalidad de garantizar el cumplimiento de las metas, objetivos y valores de la Empresa.',
    'R-02-01', 0,
    'Gerente de Operaciones y Relaciones Corporativas',
    'Gerente de Operaciones y Relaciones Corporativas',
    'Planificar, coordinar y supervisar integralmente las actividades logísticas de la organización, garantizando la eficiencia operativa en el almacenamiento, mantenimiento, transporte y distribución de mercaderías. Asegura el funcionamiento óptimo de los recursos físicos (vehículos, maquinarias, instalaciones y depósitos), gestiona la logística de importaciones y controla el stock.',
    array[
      'Organizar y dirigir las actividades diarias de su equipo.',
      'Mantener en condiciones óptimas los móviles y maquinarias.',
      'Dirigir y controlar el mantenimiento edilicio.',
      'Coordinar y dirigir el envío de mercaderías para los clientes mayoristas.',
      'Gestionar con la aseguradora de rodados las coberturas de reparaciones en caso de siniestros.',
      'Control y actualización del stock de mercaderías.',
      'Organizar y coordinar la logística de las importaciones en los procesos de compra de mercadería.',
      'Mantener en condiciones óptimas el depósito.',
      'Colabora en los procesos de cambio planeados para el mejoramiento continuo de la organización.',
      'Promueve un clima apropiado para el desarrollo del trabajo en equipo, con calidad y productividad.',
      'Realiza las tareas de acuerdo a lo establecido en los procedimientos.',
      'Ejecuta otras tareas relacionadas a sus funciones que le sean encomendadas.'
    ],
    'Bachiller concluido.',
    'Manejo de herramientas informáticas. Curso de Excel Intermedio.',
    'Experiencia previa mínima de 1 año en cargos similares.',
    true, false, false, false, true
  )
  on conflict (empresa_id, lower(codigo)) do update set
    nombre = excluded.nombre, mision = excluded.mision,
    supervisado_por = excluded.supervisado_por, funciones = excluded.funciones,
    responsabilidades_generales = excluded.responsabilidades_generales;

  select id into v_jefe_logistica from public.puestos
   where empresa_id = v_empresa and codigo = 'P-101';

  -- -------------------------------------------------------------------
  -- Responsable IT. Depende de Administracion y Finanzas, no de Logistica.
  -- -------------------------------------------------------------------
  insert into public.puestos (
    empresa_id, codigo, nombre, area, mision,
    codigo_formulario, revision, supervisado_por,
    responsabilidades_generales, funciones,
    formacion_academica, experiencia,
    requiere_registro_conducir, requiere_movilidad_propia,
    requiere_viajes_interior, requiere_viajes_exterior, requiere_horario_extendido
  ) values (
    v_empresa, 'P-102', 'Responsable IT', 'Administración y Finanzas',
    'Administrar, mantener y desarrollar la infraestructura tecnológica de la empresa, incluyendo hardware, software, servidores, red, celulares corporativos y seguridad de la información. Brindar soporte técnico a los usuarios y colaborar en la implementación, mantenimiento y personalización del sistema Odoo, garantizando el funcionamiento estable y seguro de los recursos informáticos.',
    'R-02-01', 0,
    'Gerente Administrativo y Financiero',
    'Asegurar la disponibilidad, seguridad y eficiencia de los sistemas informáticos y de comunicación de la empresa, garantizando la continuidad operativa de las áreas.',
    array[
      'Administrar y mantener el hardware de la empresa: montaje, instalación, configuración y mantenimiento preventivo y correctivo de equipos informáticos, impresoras y periféricos.',
      'Administrar y mantener el software utilizado por la empresa: instalación, actualización, configuración y control de licencias.',
      'Controlar y ejecutar respaldos de seguridad de todos los sistemas informáticos y garantizar su resguardo.',
      'Monitorear el correcto funcionamiento de servidores, redes internas, conexiones de internet, puntos de acceso y sistemas de seguridad.',
      'Administrar los accesos, perfiles y contraseñas de los usuarios en los distintos sistemas y plataformas.',
      'Implementar y supervisar las políticas de seguridad informática y protección de datos.',
      'Configurar, mantener y controlar los celulares corporativos, planes de datos, líneas y cuentas de Google.',
      'Participar en el mantenimiento y desarrollo básico de Odoo ERP.',
      'Colaborar en el mantenimiento de la página web y herramientas de análisis.',
      'Documentar configuraciones, procedimientos técnicos y protocolos de soporte.',
      'Brindar soporte técnico a usuarios: hardware, software, conectividad, correo e impresoras.',
      'Supervisar la contratación de servicios externos verificando su cumplimiento.',
      'Mantener actualizado el inventario de hardware, licencias, líneas y equipos corporativos.',
      'Capacitar e instruir a los usuarios en el uso seguro de los sistemas y equipos.',
      'Reportar al superior inmediato las necesidades de actualización tecnológica, reemplazo de equipos o riesgos detectados.'
    ],
    'Estudiante de la carrera de informática o afines.',
    '2 años en cargo con responsabilidades similares.',
    false, false, false, false, false
  )
  on conflict (empresa_id, lower(codigo)) do update set
    nombre = excluded.nombre, mision = excluded.mision,
    supervisado_por = excluded.supervisado_por, funciones = excluded.funciones,
    responsabilidades_generales = excluded.responsabilidades_generales;
end;
$$;

-- ---------------------------------------------------------------------
-- Los siete puestos que reportan al Jefe de Logistica.
-- Comparten supervisor, formulario y revision; cambia la mision, las
-- funciones y los requisitos.
-- ---------------------------------------------------------------------
do $$
declare
  v_empresa uuid;
  v_logistica uuid;
  v_jefe uuid;
begin
  select id into v_empresa from public.empresas order by creado_en limit 1;
  select id into v_logistica from public.procesos
   where empresa_id = v_empresa and nombre ilike '%log%stica%' limit 1;
  select id into v_jefe from public.puestos
   where empresa_id = v_empresa and codigo = 'P-101';

  insert into public.puestos (
    empresa_id, codigo, nombre, area, proceso_id, reporta_a_puesto_id, mision,
    codigo_formulario, revision, supervisado_por, reemplazado_por,
    responsabilidades_generales, funciones,
    formacion_academica, formacion_complementaria, experiencia,
    requiere_registro_conducir, requiere_movilidad_propia,
    requiere_viajes_interior, requiere_viajes_exterior, requiere_horario_extendido
  ) values

  (v_empresa, 'P-103', 'Asistente de Logística Mayorista', 'Logística y Operaciones', v_logistica, v_jefe,
   'Coordina y ejecuta de manera eficiente los procesos logísticos y administrativos relacionados con la preparación, facturación y envío de pedidos mayoristas, garantizando el cumplimiento de los plazos establecidos y la correcta documentación, en colaboración con el área comercial y otras áreas involucradas.',
   'R-02-01', 0, 'Jefe de Logística', null, null,
   array[
     'Procesar y facturar las Notas de Pedido generadas por el área Comercial, considerando los detalles inherentes a cada pedido, tipo de mercadería y cliente.',
     'Realizar la preparación física de los pedidos.',
     'Monitorear el estado de cada pedido, manteniendo actualizada la planilla de Ventas Mayoristas.',
     'Colaborar según necesidad en la verificación de mercaderías que se reciben por importación, en DIGEMABEL o en Aduanas.',
     'Colaborar con la atención a personas de otros departamentos que precisen productos o asistencia de Logística.',
     'Actualizar el registro de todos los pedidos enviados, sea por transportadora, móvil de C44, retiro por vendedores o delivery.',
     'Entregar las Notas de Pedido, Guía de Envío y duplicados de facturas a los departamentos correspondientes.',
     'Colaborar en los procesos de cambio planificados para el mejoramiento continuo de la Organización.',
     'Promover el desarrollo de la cultura organizacional.',
     'Realizar las tareas de acuerdo a lo establecido en los procedimientos.',
     'Ejecutar otras tareas relacionadas a sus funciones que le sean encomendadas.'
   ],
   'Bachiller concluido.', 'Curso de Excel Básico.',
   'Experiencia previa mínima 1 año en cargos similares.',
   true, false, false, false, true),

  (v_empresa, 'P-104', 'Asistente de Gestiones', 'Logística y Operaciones', v_logistica, v_jefe,
   'Coordina y ejecuta las gestiones administrativas y operativas solicitadas por el área administrativa. Asegura una eficiente entrega de pedidos a clientes en el área metropolitana y la correcta preparación, control y envío de pedidos mayoristas.',
   'R-02-01', 0, 'Jefe de Logística', null, null,
   array[
     'Preparar físicamente los pedidos mayoristas.',
     'Realizar entrega de pedidos en la zona metropolitana.',
     'Controlar y trasladar los pedidos del interior del país a la transportadora.',
     'Colaborar en los procesos de cambio planificados para el mejoramiento continuo de la Organización.',
     'Promover el desarrollo de la cultura organizacional.',
     'Realizar las tareas de acuerdo a lo establecido en los procedimientos.',
     'Ejecutar otras tareas relacionadas a sus funciones que le sean encomendadas.'
   ],
   'Bachiller concluido.', 'Curso de Excel básico.',
   'Experiencia previa mínima de 1 año en cargos similares.',
   true, false, false, false, true),

  (v_empresa, 'P-105', 'Gestor de Cobranzas y Entregas', 'Logística y Operaciones', v_logistica, v_jefe,
   'Es responsable de realizar las gestiones de documentos necesarios para los trámites ante la DIGEMABEL. Realizar entrega de pedidos, gestiones de cobranza y otras tareas relacionadas al área de logística.',
   'R-02-01', 0, 'Jefe de Logística', 'Asistente de logística',
   'Apoyar operativamente al área de Logística.',
   array[
     'Coordinar con la Asistente DIMABEL los documentos a ser gestionados.',
     'Coordinar con la Analista de Créditos y Cobranzas la hoja de ruta para los cobros a clientes.',
     'Controlar los recibos y pagarés previa entrega al cliente.',
     'Rendir en caja el efectivo cobrado con la documentación pertinente.',
     'Coordinar con el Jefe de Logística la hoja de ruta u otras tareas para la jornada.',
     'Controlar antes de salir de C44 la factura y mercadería a ser entregada al cliente.',
     'Cuidar y velar por el correcto manejo de la motocicleta y otros móviles de la empresa que le fueran asignados.',
     'Colaborar en los procesos de cambio planificados para el mejoramiento continuo de la Organización.',
     'Promover un clima apropiado para el desarrollo del trabajo en equipo, con calidad y productividad.',
     'Realizar las tareas de acuerdo a lo establecido en los procedimientos.',
     'Ejecutar otras tareas relacionadas a sus funciones que le sean encomendadas.'
   ],
   'Bachiller concluido.', null,
   'Experiencia previa mínima de 1 año en cargos similares.',
   true, true, false, false, false),

  (v_empresa, 'P-106', 'Asistente Técnico', 'Logística y Operaciones', v_logistica, v_jefe,
   'Garantiza la adecuada recepción, registro, reparación y mantenimiento de productos averiados o en garantía, trabajando en coordinación con el área comercial y administrativa, además de realizar tareas básicas de mantenimiento del edificio.',
   'R-02-01', 0, 'Jefe de Logística', 'Asistente de Control de Stock 2', null,
   array[
     'Recibir y registrar los artículos averiados o para mantenimiento.',
     'Realizar la reparación o mantenimiento de los artículos averiados.',
     'Coordinar con el Departamento Comercial las acciones a tomar en relación al artículo.',
     'Colaborar con las tareas de mantenimiento edilicio.',
     'Colaborar en los procesos de cambio planificados para el mejoramiento continuo de la Organización.',
     'Promover el desarrollo de la cultura organizacional.',
     'Realizar las tareas de acuerdo a lo establecido en los procedimientos.',
     'Ejecutar otras tareas relacionadas a sus funciones que le sean encomendadas.'
   ],
   'Bachiller concluido.', 'Curso de Excel Básico. Curso de Electricidad. Curso de Plomería.',
   'Experiencia previa mínima 1 año en cargos similares.',
   true, false, false, false, true),

  (v_empresa, 'P-107', 'Asistente de Control de Stock 1', 'Logística y Operaciones', v_logistica, v_jefe,
   'Coordina y ejecuta las actividades de recepción, verificación, acondicionamiento y organización de mercaderías, colaborando en la gestión de pedidos mayoristas, la reposición de productos y las tareas administrativas, con el fin de asegurar un flujo logístico eficiente y el mantenimiento del depósito.',
   'R-02-01', 0, 'Jefe de Logística', null, null,
   array[
     'Recibir y controlar las mercaderías que ingresan por compras locales e internacionales.',
     'Etiquetar y rotular las mercaderías recibidas para su almacenamiento.',
     'Mantener el depósito ordenado, con la mercadería ubicada de forma idónea.',
     'Realizar gestiones para el Departamento Administrativo.',
     'Dar soporte al proceso de Reposición de Stock o preparación de mercaderías para el envío.',
     'Realizar entrega de pedidos en la zona metropolitana.',
     'Dar soporte en lo relacionado al mantenimiento edilicio.',
     'Dar soporte según necesidad al Delivery.',
     'Apoyar en la realización de inventarios.',
     'Colaborar en los procesos de cambio planificados para el mejoramiento continuo de la Organización.',
     'Promover el desarrollo de la cultura organizacional.',
     'Realizar las tareas de acuerdo a lo establecido en los procedimientos.'
   ],
   'Egresado de Administración, Lic. en Psicología Laboral o afines.',
   'Manejo de herramientas informáticas.',
   'Experiencia previa en el cargo mínima 3 años.',
   true, true, true, false, false),

  (v_empresa, 'P-108', 'Asistente de Control de Stock 2', 'Logística y Operaciones', v_logistica, v_jefe,
   'Gestiona la recepción, verificación, acondicionamiento y almacenamiento eficiente de mercaderías, colaborando en la gestión de pedidos, control de inventarios y mantenimiento del depósito, así como en tareas de entrega y reemplazo de personal.',
   'R-02-01', 0, 'Jefe de Logística', null, null,
   array[
     'Realizar entrega de pedidos en la zona metropolitana.',
     'Apoyar en las tareas de verificación física de mercaderías recibidas.',
     'Apoyar en el etiquetado y rotulado de mercaderías recibidas.',
     'Apoyar en el mantenimiento del orden y la limpieza del depósito.',
     'Dar soporte según necesidad al Delivery.',
     'Dar soporte en lo relacionado al mantenimiento edilicio.',
     'Dar soporte al proceso de Reposición de Stock o preparación de mercaderías para el envío.',
     'Dar soporte en el área de Asistencia Técnica, según necesidad.',
     'Colaborar en los procesos de cambio planificados para el mejoramiento continuo de la Organización.',
     'Promover el desarrollo de la cultura organizacional.',
     'Realizar las tareas de acuerdo a lo establecido en los procedimientos.',
     'Ejecutar otras tareas relacionadas a sus funciones que le sean encomendadas.'
   ],
   'Bachiller concluido.', 'Curso de Excel Básico.',
   'Experiencia previa mínima de 1 año en cargos similares.',
   true, false, false, false, false),

  (v_empresa, 'P-109', 'Asistente de Reposición de Stock', 'Logística y Operaciones', v_logistica, v_jefe,
   'Gestiona de manera eficiente la reposición, registro y control de mercaderías en el salón de ventas y el depósito, asegurando un flujo continuo de productos, la correcta documentación de los movimientos y la colaboración con otros departamentos.',
   'R-02-01', 0, 'Jefe de Logística', null, null,
   array[
     'Realizar la reposición de productos en el Salón de Ventas.',
     'Registrar en el sistema informático todos los movimientos de mercaderías realizados.',
     'Mantener actualizados los registros físicos de movimientos internos de mercadería.',
     'Colaborar según necesidad en el control de embalajes de los productos que serán enviados a los clientes.',
     'Mantener actualizada la planilla Reposición de Mercaderías.',
     'Comunicarse con el Departamento Administrativo sobre problemas relacionados al stock.',
     'Colaborar en los procesos de cambio planificados para el mejoramiento continuo de la Organización.',
     'Promover el desarrollo de la cultura organizacional.',
     'Realizar las tareas de acuerdo a lo establecido en los procedimientos.',
     'Ejecutar otras tareas relacionadas a sus funciones que le sean encomendadas.',
     'Colaborar con la atención a personas de otros departamentos que precisen productos o asistencia de Logística.'
   ],
   'Bachiller concluido.', 'Manejo de herramientas informáticas. Curso de Excel Básico.',
   'Experiencia previa mínima de 1 año en cargos similares.',
   true, false, false, false, true)

  on conflict (empresa_id, lower(codigo)) do update set
    nombre = excluded.nombre, mision = excluded.mision,
    supervisado_por = excluded.supervisado_por,
    reporta_a_puesto_id = excluded.reporta_a_puesto_id,
    funciones = excluded.funciones;
end;
$$;

-- =====================================================================
-- DATOS REALES: 30-documentos-it.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- DATOS REALES · Juego documental de TI
-- =====================================================================
-- Los diez documentos de Tecnologia de la Informacion vigentes de
-- Camping 44, con su codigo real y el enlace al archivo en Drive.
--
-- No se copia el contenido: la intranet indexa y enlaza. El archivo
-- vigente sigue siendo el del Drive, y cuando Calidad lo actualiza ahi,
-- la ficha muestra lo nuevo sin intervencion.
--
-- La codificacion es la de Camping 44: <TIPO>-<AREA>-<NN>, donde el
-- correlativo es unico dentro del area sin importar el tipo.
--
-- Se aplica DESPUES del seed (necesita empresa y un usuario responsable).
-- Es idempotente.

do $$
declare
  v_empresa uuid;
  v_responsable uuid;
  v_proceso uuid;
  v_norma uuid;
  -- Fecha de la ultima actualizacion de los archivos en Drive.
  v_vigencia constant date := date '2026-03-31';
begin
  select id into v_empresa from public.empresas order by creado_en limit 1;
  if v_empresa is null then
    raise exception 'No hay ninguna empresa cargada. Aplique el seed primero.';
  end if;

  -- El responsable definitivo es el Responsable IT. Mientras su legajo no
  -- exista, queda a cargo del Administrador SGC: la columna no admite
  -- nulos, y dejar el documento sin dueno seria peor que asignarlo
  -- provisoriamente a Calidad.
  select id into v_responsable from public.usuarios
   where empresa_id = v_empresa and rol = 'administrador_sgc' and activo
   order by creado_en limit 1;

  if v_responsable is null then
    select id into v_responsable from public.usuarios
     where empresa_id = v_empresa and activo order by creado_en limit 1;
  end if;

  if v_responsable is null then
    raise exception 'No hay usuarios cargados: no se puede asignar responsable.';
  end if;

  select id into v_proceso from public.procesos
   where empresa_id = v_empresa and nombre ilike '%tecnolog%' limit 1;
  select id into v_norma from public.normas limit 1;

  insert into public.documentos (
    empresa_id, codigo, titulo, tipo, estado, proceso_id, norma_id,
    responsable_id, elaborador_id, version_actual,
    fecha_aprobacion, fecha_vigencia, fecha_proxima_revision,
    periodicidad_revision_meses, url_documento
  ) values
  (v_empresa, 'POL-IT-01', 'Política de Seguridad Informática', 'politica', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/1U-Z1D9Nv_VaJLgGB8sVgAyopkQhPfxsl40ePIOyYVw4/edit'),

  (v_empresa, 'PROC-IT-02', 'Procedimiento de Gestión de Accesos y Usuarios', 'procedimiento', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/1bQvc64iL-9YZfmao6tgwgMh0PoNpZQ9EQVmmF7V3sfM/edit'),

  (v_empresa, 'PROC-IT-03', 'Procedimiento de Respaldo y Recuperación de Datos', 'procedimiento', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/1m2qqbWr7W5cdNTTN7wUU_WPAY5TDANMQpseuAak3Pzs/edit'),

  (v_empresa, 'PLAN-IT-04', 'Plan de Contingencia Informática', 'plan', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/1TPMUhU9QUKNCH6PTfn9cE2pyOzWbNoSxe91QZMn673M/edit'),

  (v_empresa, 'POL-IT-05', 'Política de Uso de Equipos y Celulares Corporativos', 'politica', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/1lfbghseL9gbMIAyP5U5rlMxZVdL5wFmZ-32E6xBxePU/edit'),

  (v_empresa, 'PROC-IT-06', 'Procedimiento de Gestión de Incidentes Informáticos', 'procedimiento', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/11sSsZlns7W_sZ2GtM3s1-ExQBhW8eTeozFYcQc4JZI8/edit'),

  (v_empresa, 'PROC-IT-07', 'Procedimiento de Control de Accesos Físicos', 'procedimiento', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/1jlpebNqN8m6K-CTD06tPCZ6iXEzMbRiziywNgSFn7Ao/edit'),

  (v_empresa, 'PROC-IT-08', 'Procedimiento de Gestión Documental', 'procedimiento', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/1Lez3_80a4hrXsJFunuwWITZVxU09KJMTioPkCWmRM14/edit'),

  (v_empresa, 'PROC-IT-09', 'Procedimiento de Protección de la Información', 'procedimiento', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/1QCTX52Myxu1dDRnHbiwRE1W9TgEyxiBjvASvXI5g_Qg/edit'),

  (v_empresa, 'PROC-IT-10', 'Procedimiento de Comunicación de Incidentes', 'procedimiento', 'vigente',
   v_proceso, v_norma, v_responsable, v_responsable, 1,
   v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12,
   'https://docs.google.com/document/d/1Ll3srt-bilpF2o9efdCc1nyMaGnrdldNEKzr7nZSkRA/edit')

  on conflict (empresa_id, upper(codigo)) do update set
    titulo = excluded.titulo,
    tipo = excluded.tipo,
    estado = excluded.estado,
    fecha_vigencia = excluded.fecha_vigencia,
    fecha_proxima_revision = excluded.fecha_proxima_revision,
    url_documento = excluded.url_documento;
end;
$$;

-- =====================================================================
-- DATOS REALES: 40-documentos-del-sgc.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- DATOS REALES · Documentos de la unidad compartida del SGC
-- =====================================================================
-- El resto del juego documental vigente: contexto organizacional,
-- politicas, estructura, formularios y el protocolo de orden y limpieza.
-- Los manuales de proceso ya se cargaron en 10-mapa-de-procesos.sql.
--
-- Codigo, version y vigencia salen del encabezado de cada archivo, no
-- del nombre del archivo ni de la fecha de modificacion en Drive: se
-- abrieron para leerlos. Casi todo el juego se lanzo el 25/05/2026 en
-- version 00; el protocolo de orden y limpieza es posterior
-- (11/08/2026) y el contrato de compraventa ya va por la version 01.
--
-- Ocho documentos NO tienen codigo. No es un olvido de esta carga: el
-- documento mismo no lo lleva, se identifica por titulo, version y
-- vigencia. Se dejan sin codigo antes que inventarles uno. Cuando
-- Calidad los codifique, se completa la columna.
--
-- La Matriz de Comunicaciones si lo tiene, aunque el nombre del archivo
-- no lo diga: el manual MP-SOP-01 la cita como F-SOP-01-01.
--
-- Como con los manuales, se enlaza el archivo vigente en lugar de
-- copiar su contenido.
--
-- Se aplica DESPUES de 10-mapa-de-procesos.sql. Es idempotente.

do $$
declare
  v_empresa uuid;
  v_responsable uuid;
  v_norma uuid;
  r record;
  v_proceso uuid;
begin
  select id into v_empresa from public.empresas order by creado_en limit 1;
  if v_empresa is null then
    raise exception 'No hay ninguna empresa cargada. Aplique el seed primero.';
  end if;

  select id into v_responsable from public.usuarios
   where empresa_id = v_empresa and rol = 'administrador_sgc' and activo
   order by creado_en limit 1;
  if v_responsable is null then
    select id into v_responsable from public.usuarios
     where empresa_id = v_empresa and activo order by creado_en limit 1;
  end if;

  select id into v_norma from public.normas limit 1;

  for r in
    select * from (values
      -- codigo,      titulo,                                              tipo,           proceso,  version, vigencia,     id de Drive

      -- 01 Contexto Organizacional (sin codigo)
      (null,          'Matriz FODA',                                       'registro',     'EST-02', 0, '2026-05-25', '1QRkwdEIgUaPiTBqnsld6-OBfUIVw9iWL'),
      (null,          'Matriz de Partes Interesadas',                      'registro',     'EST-02', 0, '2026-05-25', '11PyqNND_ToYrO3kpe49sWz1WHnOK5CaG'),
      (null,          'Alcance del Sistema de Gestión de Calidad',         'manual',       'EST-02', 0, '2026-05-25', '1OVed4zXHF1WmgtKugcFr-T2FyYns6DTu'),
      (null,          'Mapa de Procesos',                                  'manual',       'EST-02', 0, '2026-05-25', '1ANscWXVEBdPAYj1YC3d2pfptGN07Hc4D'),

      -- 02 Politicas y Otros (sin codigo)
      (null,          'Política de Calidad',                               'politica',     'EST-02', 0, '2026-05-25', '1Syb_5BDVc1ASGfazIU6Txj6nnXKrxfSZ'),
      (null,          'Propósito, Misión y Visión',                        'politica',     'EST-02', 0, '2026-05-25', '1tJlSPwB9whDwbQTNQHxStAj7Dib2_5ZM'),
      (null,          'Valores Institucionales',                           'politica',     'EST-02', 0, '2026-05-25', '1djuLhyp0FBGN8GoGxK36ovbDIWQUg8qQ'),
      (null,          'Política de Garantía',                              'politica',     'MIS-05', 0, '2026-05-25', '1NUSS9-qPk27RgAs7NANdE2Tjd62Qck8N'),

      -- 03 Estructura Organizacional (sin codigo)
      (null,          'Estructura Organizacional',                         'registro',     'SOP-01', 0, '2026-05-25', '1_u6Cti8qRdMZkgVfvWcZ89-jXqbkTPrz'),

      -- 05 Formularios y Otros
      ('F-EST-02-01', 'Minuta de Reunión',                                 'formulario',   'EST-02', 0, '2026-05-25', '1lqtRdof6j7MWDw-Fx_oV1ZUHK8ZeTXvX'),
      ('F-MIS-04-01', 'Carta de Responsabilidad',                          'formulario',   'MIS-04', 0, '2026-05-25', '1UD0zKZX8ct4B1NJk92w2oPWAsLDwkQZR'),
      ('F-MIS-05-01', 'Orden de Trabajo',                                  'formulario',   'MIS-05', 0, '2026-05-25', '1Ghxkkoh1GsUxQadsLWygiLj0eKuwJtK5'),
      ('F-MIS-06-01', 'Autorización y Deslinde de Responsabilidad',        'formulario',   'MIS-06', 0, '2026-05-25', '14iMxwKNOF66xVa8RuTNtVF8V-gz7Rorq'),
      ('F-MIS-06-02', 'Reglamento del Stand de Tiro',                      'formulario',   'MIS-06', 0, '2026-05-25', '1Dd7HefGI72o5wNY82HgY2Wn2YrZr5dWs'),
      ('F-MIS-07-01', 'Guía de Corrección',                                'formulario',   'MIS-07', 0, '2026-05-25', '1kKRf-Lsaaj0JnE9_f-AdjjQ9mlnaEqg-'),
      ('F-SOP-01-01', 'Matriz de Comunicaciones',                          'registro',     'SOP-01', 0, '2026-05-25', '1Qj1g7hABvumJa6dnjIcX1mjJuZs9dz6r'),
      ('F-SOP-02-01', 'Verificación de Activos Edilicios',                 'formulario',   'SOP-02', 0, '2026-05-25', '1hhJiRuYkY0wmJGOEM2WYYm36p1K6hK-i'),
      ('F-SOP-02-02', 'Verificación de Activos Tecnológicos',              'formulario',   'SOP-02', 0, '2026-05-25', '1I3HyCAje0Ke_houGXiYVW4xbmGFENV5m'),
      ('F-SOP-03-01', 'Solicitud de Cliente · B2C',                        'formulario',   'SOP-03', 0, '2026-05-25', '1F7ICUHsHPcKwRAoeOV214XgF5HSgXDCw'),
      ('F-SOP-05-01', 'Informe de Inventario',                             'formulario',   'SOP-05', 0, '2026-05-25', '1glJwXow6Sv6z-YGT7pj7e0RFXltEZmfJ'),
      ('F-SOP-06-01', 'Contrato de Compromiso de Compraventa de Material Controlado, Declaración Jurada y Anexos',
                                                                           'formulario',   'SOP-06', 1, '2026-07-17', '1dfIR8mFzOamADtNvSlkyHR5xXuCS1S4R'),
      ('F-SOP-07-01', 'Alta y Baja de Credenciales de Acceso',             'formulario',   'SOP-07', 0, '2026-05-25', '1ccgI3HP0mffF8uAByIPBT9hXWLUpidiU'),
      ('F-SOP-07-02', 'Compromiso de Uso Responsable',                     'formulario',   'SOP-07', 0, '2026-05-25', '1jm9WrzIY09F_tecBxiQVxDhlxFjwNGOw'),
      ('F-SOP-07-03', 'Retiro de Equipos Informáticos',                    'formulario',   'SOP-07', 0, '2026-05-25', '1KcVcvGCPCu_7u7tkHLeUDXaCDOt-Brin'),
      ('F-SOP-08-01', 'Evaluación de Asociados de Negocio y Proveedores',  'formulario',   'SOP-08', 0, '2026-05-25', '1bnJv5w1CxBZv9gY1O42uu-Y1FAPIppcf'),
      (null,          'Registro de Participación',                         'formulario',   'SOP-01', 0, '2026-05-25', '1vs3tk9oc1zVXKhXs3SpjGKchtlVUVa4S'),
      (null,          'Solicitud de Cliente · B2B',                        'formulario',   'SOP-03', 0, '2026-05-25', '1Q4R9TWbdwrfJl3SiQLhWAlvGuz4l8mM5'),

      -- 07 Protocolo Orden y Limpieza
      ('P-SOP-01-01', 'Orden y Limpieza en Espacios de Trabajo',           'instructivo',  'SOP-01', 0, '2026-08-11', '18u2iMjfQPFEtTpl6QMZDf7toKfNqoaPK'),
      (null,          'Preguntas Frecuentes · Protocolo de Orden y Limpieza',
                                                                           'instructivo',  'SOP-01', 0, '2026-08-11', '1FQeLyX20UI26c_HeDk124zThaL90vHHF')
    ) as t(codigo, titulo, tipo, proceso, version, vigencia, drive_id)
  loop
    select id into v_proceso from public.procesos
     where empresa_id = v_empresa and lower(codigo) = lower(r.proceso);
    if v_proceso is null then
      raise exception 'Falta el proceso % del mapa real. Aplique antes 10-mapa-de-procesos.sql.', r.proceso;
    end if;

    if r.codigo is null then
      -- Sin codigo no hay clave por la cual reconocerlo: se identifica
      -- por titulo dentro de la empresa.
      update public.documentos set
        tipo = r.tipo::public.tipo_documento,
        estado = 'vigente',
        proceso_id = v_proceso,
        norma_id = v_norma,
        responsable_id = v_responsable,
        elaborador_id = v_responsable,
        version_actual = r.version,
        fecha_aprobacion = r.vigencia::date,
        fecha_vigencia = r.vigencia::date,
        fecha_proxima_revision = r.vigencia::date + interval '12 months',
        periodicidad_revision_meses = 12,
        es_demostracion = false,
        url_documento = 'https://drive.google.com/file/d/' || r.drive_id || '/view'
       where empresa_id = v_empresa and codigo is null and titulo = r.titulo;

      if not found then
        insert into public.documentos (
          empresa_id, codigo, titulo, tipo, estado, proceso_id, norma_id,
          responsable_id, elaborador_id, version_actual,
          fecha_aprobacion, fecha_vigencia, fecha_proxima_revision,
          periodicidad_revision_meses, es_demostracion, url_documento
        ) values (
          v_empresa, null, r.titulo, r.tipo::public.tipo_documento, 'vigente',
          v_proceso, v_norma, v_responsable, v_responsable, r.version,
          r.vigencia::date, r.vigencia::date, r.vigencia::date + interval '12 months',
          12, false, 'https://drive.google.com/file/d/' || r.drive_id || '/view'
        );
      end if;
    else
      insert into public.documentos (
        empresa_id, codigo, titulo, tipo, estado, proceso_id, norma_id,
        responsable_id, elaborador_id, version_actual,
        fecha_aprobacion, fecha_vigencia, fecha_proxima_revision,
        periodicidad_revision_meses, es_demostracion, url_documento
      ) values (
        v_empresa, r.codigo, r.titulo, r.tipo::public.tipo_documento, 'vigente',
        v_proceso, v_norma, v_responsable, v_responsable, r.version,
        r.vigencia::date, r.vigencia::date, r.vigencia::date + interval '12 months',
        12, false, 'https://drive.google.com/file/d/' || r.drive_id || '/view'
      )
      on conflict (empresa_id, upper(codigo)) do update set
        titulo = excluded.titulo,
        tipo = excluded.tipo,
        estado = excluded.estado,
        proceso_id = excluded.proceso_id,
        version_actual = excluded.version_actual,
        fecha_aprobacion = excluded.fecha_aprobacion,
        fecha_vigencia = excluded.fecha_vigencia,
        fecha_proxima_revision = excluded.fecha_proxima_revision,
        es_demostracion = false,
        url_documento = excluded.url_documento;
    end if;
  end loop;
end;
$$;

-- =====================================================================
-- DATOS REALES: 50-inventario-tecnologico.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- DATOS REALES · Inventario de activos tecnologicos
-- =====================================================================
-- Las ochenta y cuatro filas cargadas de la planilla "INVENTARIO
-- TECNOLOGICO" de la unidad compartida de TI, ultima actualizacion del
-- 2 de junio de 2026, responsable Facundo Colman.
--
-- Sofidya no los tiene: `get_assets` devuelve cero para las dos sedes.
-- Este es el inventario que se lleva de verdad.
--
-- La planilla tiene ademas seis hojas por area (ADM, CHUM, MAY, MKT,
-- REU, REC/REG, CAJ, DEP, SAL) que son plantillas a medio llenar: casi
-- todas las celdas dicen "[Completar]" y repiten equipos que ya estan
-- en la primera hoja. NO se cargan. Volcarlas seria meter relleno con
-- forma de dato, y ademas duplicaria activos.
--
-- Una fila de la planilla no tiene codigo -- la notebook HP Victus de
-- Martin Benitez, Jefe de Marketing -- y el esquema lo exige. Queda
-- afuera hasta que TI le asigne uno.
--
-- El encabezado de la planilla dice "Proceso: MP-APY-02 Infraestructura
-- y Tecnologia". Esa codificacion es anterior: en el mapa vigente ese
-- proceso es MP-SOP-02. Los activos se cuelgan del proceso por su
-- codigo actual.
--
-- Equivalencia de estados:
--   Operativo   -> operativo
--   Reparacion  -> en_mantenimiento
--   Baja        -> dado_de_baja
--   Libre       -> operativo, y "Sin asignar" en la descripcion, porque
--                  el equipo anda: lo que no tiene es a quien
--
-- A quien esta asignado cada equipo va en la descripcion y no en
-- `responsable_id`: la mayoria de esas personas todavia no tiene cuenta
-- en la intranet, y no se les inventa una.
--
-- Se aplica DESPUES del seed. Es idempotente.

do $$
declare
  v_empresa uuid;
  r record;
begin
  select id into v_empresa from public.empresas order by creado_en limit 1;
  if v_empresa is null then
    raise exception 'No hay ninguna empresa cargada. Aplique el seed primero.';
  end if;

  for r in
    select * from (values
  ('C44-NB-000', 'Notebook Dell inspiron', 'Notebook', 'Dell', 'inspiron', '0768567E-1527-4F05-9365-581D1C27D4A8', 'operativo', 'Asignado a: Irene Livieres. Color: Gris oscuro'),
  ('C44-NB-001', 'Notebook HP Precision 7510', 'Notebook', 'HP', 'Precision 7510', '00330-80180-35975-AA577', 'dado_de_baja', 'Color: Rojo'),
  ('C44-NB-002', 'Notebook HP HP Laptop 15-dy1xxx', 'Notebook', 'HP', 'HP Laptop 15-dy1xxx', '00330-80000-00000-AA258', 'operativo', 'Asignado a: OSCAR DAVID NOGUERA. Color: Plateado'),
  ('C44-NB-003', 'Notebook Dell Precision 7510', 'Notebook', 'Dell', 'Precision 7510', '00330-80180-35875-AA652', 'operativo', 'Asignado a: Adan -DIG 2. Color: Negro'),
  ('C44-NB-004', 'Notebook HP 15-dy1xxx', 'Notebook', 'HP', '15-dy1xxx', 'A4112A0C-AE34-4824-9A3E-F60DF07B750E', 'dado_de_baja', 'Color: Plateado'),
  ('C44-NB-005', 'Notebook HP 15-dy2xxx', 'Notebook', 'HP', '15-dy2xxx', '00330-80000-00000-AA665', 'operativo', 'Asignado a: Oscar Zárate. Color: Plateado'),
  ('C44-NB-006', 'Notebook HP HP 250 G5', 'Notebook', 'HP', 'HP 250 G5', '72A804E3-4949-4DD1-B736-888968B26AD2', 'operativo', 'Asignado a: Cesar Aguilera. Color: Negro'),
  ('C44-NB-007', 'Notebook Lenovo 81WE', 'Notebook', 'Lenovo', '81WE', '00330-80000-00000-AA895', 'operativo', 'Asignado a: Salón. Color: Azul'),
  ('C44-NB-008', 'Notebook ASUS X1504ZA-X1504ZA', 'Notebook', 'ASUS', 'X1504ZA-X1504ZA', '0330-80000-00000-AA069', 'en_mantenimiento', 'Asignado a: Hugo González. Color: Azul'),
  ('C44-NB-009', 'Notebook ASUS X1504ZA-X1504ZA', 'Notebook', 'ASUS', 'X1504ZA-X1504ZA', '0330-80000-00000-AA03', 'operativo', 'Asignado a: Carlos Gonzalez. Color: Azul'),
  ('C44-NB-010', 'Notebook HP 15-dy1xxx', 'Notebook', 'HP', '15-dy1xxx', '00330-81814-80131-AA0EM', 'operativo', 'Asignado a: Alicia. Color: Plateado'),
  ('C44-NB-011', 'Notebook Asus VivoBook', 'Notebook', 'Asus', 'VivoBook', '00330-80000-00000-AA653', 'operativo', 'Asignado a: Lucas Álvarez. Color: Negro'),
  ('C44-NB-012', 'Notebook HP 3168NGW', 'Notebook', 'HP', '3168NGW', '00330-80180-35975-AA577', 'operativo', 'Asignado a: Bianca. Color: Gris/Plata'),
  ('C44-NB-017', 'Notebook Dell inspiron 15 3000', 'Notebook', 'Dell', 'inspiron 15 3000', null, 'operativo', 'Asignado a: Sergio Divano'),
  ('C44-NB-019', 'Notebook HP Envy', 'Notebook', 'HP', 'Envy', '0330-80000-00000-AA056', 'operativo', 'Asignado a: Alejandro Rahi. Color: Plateado'),
  ('C44-NB-020', 'Notebook MSI MS-16W2', 'Notebook', 'MSI', 'MS-16W2', 'CD54D0A1-8F3D-4DF2-A1AE-1F172171EE13', 'operativo', 'Asignado a: Marketing'),
  ('C44-NB-021', 'Notebook HP 15-dy2xxx', 'Notebook', 'HP', '15-dy2xxx', '00330-80000-000-AA708', 'dado_de_baja', 'Color: Gris/Plata'),
  ('C44-NB-022', 'Notebook Dell Precision 7510', 'Notebook', 'Dell', 'Precision 7510', '00330-80180-3597-AA577', 'operativo', 'Asignado a: Créditos. Color: Negra'),
  ('C44-NB-023', 'Notebook Lenovo B1WE', 'Notebook', 'Lenovo', 'B1WE', '6C063E9A-64F0-450D-83B2-6BA39BA2B1FF', 'operativo', 'Asignado a: Venta Salón'),
  ('C44-NB-024', 'Notebook HP 15-dy2061la', 'Notebook', 'HP', '15-dy2061la', 'ACC5F835-78AE-442A-B0EE-416F45317645', 'dado_de_baja', 'Color: Gris'),
  ('C44-NB-025', 'Notebook Lenovo IdeaPad 1 15', 'Notebook', 'Lenovo', 'IdeaPad 1 15', 'PF5TK2FN', 'operativo', 'Asignado a: Fabricio. Color: Plateado'),
  ('C44-NB-026', 'Notebook Lenovo IdeaPad 1 15', 'Notebook', 'Lenovo', 'IdeaPad 1 15', null, 'operativo', 'Asignado a: Facundo Colman. Color: Plateado'),
  ('C44-NB-027', 'Notebook Lenovo IdeaPad 1 15', 'Notebook', 'Lenovo', 'IdeaPad 1 15', null, 'operativo', 'Asignado a: Roque. Color: Plateado'),
  ('C44-NB-028', 'Notebook ASUS TUF DASH F15', 'Notebook', 'ASUS', 'TUF DASH F15', 'N5BRCX02Y14920D', 'operativo', 'Asignado a: Derlis. Color: Negro'),
  ('C44-NB-029', 'Notebook Lenovo IdeaPad 1 15', 'Notebook', 'Lenovo', 'IdeaPad 1 15', null, 'operativo', 'Asignado a: Ruth Dige. Color: Plateado'),
  ('C44-NB-030', 'Notebook Lenovo IdeaPad 1 15', 'Notebook', 'Lenovo', 'IdeaPad 1 15', 'PF5SJMJR', 'operativo', 'Color: Plateado. Sin asignar'),
  ('C44-NB-031', 'Notebook Asus Vivobook', 'Notebook', 'Asus', 'Vivobook', 'S6N0CX04W01024A', 'operativo', 'Asignado a: Ruth Aquino. Color: Negro/Azul Oscuro'),
  ('C44-NB-032', 'Notebook Lenovo IdeaPad 1 15', 'Notebook', 'Lenovo', 'IdeaPad 1 15', 'PF5RPXEX', 'operativo', 'Asignado a: Araceli. Color: Plateado'),
  ('C44-PCE-001', 'CPU', 'CPU', null, null, null, 'operativo', 'Sin asignar'),
  ('C44-PCE-002', 'CPU', 'CPU', null, null, null, 'operativo', 'Asignado a: Eugenia Villalba'),
  ('C44-PCE-003', 'CPU', 'CPU', null, null, null, 'operativo', 'Asignado a: Contabilidad'),
  ('C44-PCE-004', 'CPU', 'CPU', null, null, null, 'operativo', 'Asignado a: David Palacio'),
  ('C44-PCE-005', 'CPU', 'CPU', null, null, null, 'operativo', 'Asignado a: Julia Olmedo'),
  ('C44-PCE-006', 'CPU', 'CPU', null, null, null, 'operativo', 'Asignado a: Yasmina Barranco'),
  ('C44-MOV-001', 'Celular Iphone 13 256GB', 'Celular', null, 'Iphone 13 256GB', 'K73052XQYP', 'operativo', 'Asignado a: Hugo González · Vitálica'),
  ('C44-MOV-002', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X60K2XRK', 'operativo', 'Sin asignar'),
  ('C44-MOV-004', 'Tablet Samsung Galaxy TAB A7', 'Tablet', null, 'Samsung Galaxy TAB A7', null, 'dado_de_baja', null),
  ('C44-MOV-005', 'Tablet Samsung Galaxy Tab A7', 'Tablet', null, 'Samsung Galaxy Tab A7', null, 'dado_de_baja', null),
  ('C44-MOV-006', 'Tablet Blackview tab9', 'Tablet', null, 'Blackview tab9', 'Tab9WNEU0000850', 'dado_de_baja', null),
  ('C44-MOV-007', 'Tablet Blackview tab9', 'Tablet', null, 'Blackview tab9', 'tab9WNEU0006243', 'dado_de_baja', null),
  ('C44-MOV-008', 'POS MODEL T6M', 'POS', null, 'MODEL T6M', 'P652000020210', 'operativo', 'Asignado a: Smart Mobile POS · Vitálica. Sin asignar'),
  ('C44-MOV-009', 'POS MODEL T6M', 'POS', null, 'MODEL T6M', 'P652000022168', 'operativo', 'Asignado a: Smart Mobile POS · Vitálica · Caja'),
  ('C44-MOV-010', 'Celular Xiaomi Redmi 9A', 'Celular', null, 'Xiaomi Redmi 9A', '29227/60U878472', 'dado_de_baja', null),
  ('C44-MOV-011', 'Celular Iphone 13 Pro', 'Celular', null, 'Iphone 13 Pro', 'M7H02T7LWC', 'operativo', 'Asignado a: Corporativo de Marketing'),
  ('C44-MOV-012', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61689/R5UC03799', 'operativo', 'Asignado a: Oscar David Maldonado Yudis'),
  ('C44-MOV-013', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61745/R5U501153', 'operativo', 'Asignado a: Jhamyl Daniel Insfrán Núñez'),
  ('C44-MOV-015', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61745/R5U501070', 'operativo', null),
  ('C44-MOV-016', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61689/R5UC03918', 'operativo', 'Asignado a: Oscar Daniel Zárate Villamayor'),
  ('C44-MOV-017', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61686/R5UC03927', 'operativo', 'Asignado a: Marcelo Evaristo Sánchez Rojas'),
  ('C44-MOV-018', 'Celular Samsung M11', 'Celular', null, 'Samsung M11', 'R9JN70W9C0J', 'operativo', 'Asignado a: Logística'),
  ('C44-MOV-019', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61689/R5UC03807', 'operativo', null),
  ('C44-MOV-021', 'Celular Samsung Galaxy A15', 'Celular', null, 'Samsung Galaxy A15', 'RF8X50BTQ5A', 'operativo', 'Asignado a: Jorge Rodríguez'),
  ('C44-MOV-022', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X60K3RDK', 'operativo', 'Asignado a: Capital Humano'),
  ('C44-MOV-023', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61689/R5UC04011', 'operativo', 'Asignado a: Hugo Javier González Arce'),
  ('C44-MOV-024', 'Celular Samsung A14', 'Celular', null, 'Samsung A14', 'R5CWB25JEKK', 'operativo', null),
  ('C44-MOV-025', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61689/R5UC03883', 'dado_de_baja', null),
  ('C44-MOV-026', 'Celular Samsung Galaxy A14', 'Celular', null, 'Samsung Galaxy A14', 'R58W60T09YL', 'operativo', null),
  ('C44-MOV-027', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61689/R5UC01422', 'operativo', null),
  ('C44-MOV-028', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61745/R5U501194', 'operativo', 'Asignado a: Marcelo Evaristo Sánchez Rojas'),
  ('C44-MOV-029', 'Celular Samsung M11', 'Celular', null, 'Samsung M11', 'R9JN716VH9J', 'dado_de_baja', null),
  ('C44-MOV-030', 'Celular Samsung A14', 'Celular', null, 'Samsung A14', 'R58W60SZAQM', 'operativo', 'Asignado a: Juan Severo Del Puerto Prieto'),
  ('C44-MOV-031', 'Celular Samsung A14', 'Celular', null, 'Samsung A14', 'R58W50E9R2F', 'operativo', 'Asignado a: Bernardo Sosa Garay'),
  ('C44-MOV-032', 'Celular Samsung M11', 'Celular', null, 'Samsung M11', 'R9JN716VHCJ', 'operativo', 'Asignado a: Rodolfo Cohene Tabare'),
  ('C44-MOV-033', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X302WPDB', 'operativo', 'Asignado a: Jhamyl Daniel Insfrán Núñez'),
  ('C44-MOV-034', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X60K4GYH', 'operativo', 'Asignado a: Adan Feliciano Candia Aveiro'),
  ('C44-MOV-035', 'Celular Samsung Galaxy A15', 'Celular', null, 'Samsung Galaxy A15', 'RF8X50G8KNK', 'operativo', 'Asignado a: María Julia Olmedo Cuevas'),
  ('C44-MOV-036', 'Celular Xiaomi Redmi 9A', 'Celular', null, 'Xiaomi Redmi 9A', '31271/11TS01634', 'dado_de_baja', null),
  ('C44-MOV-037', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X50G83AL', 'operativo', 'Asignado a: Lucas Álvarez'),
  ('C44-MOV-038', 'Celular Xiaomi Redmi 9A', 'Celular', null, 'Xiaomi Redmi 9A', 'AYLB854H6LCMJF4H', 'dado_de_baja', null),
  ('C44-MOV-040', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X60K2DVX', 'operativo', null),
  ('C44-MOV-041', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X60HWM4D', 'operativo', null),
  ('C44-MOV-042', 'Celular Xiaomi Redmi 9A', 'Celular', null, 'Xiaomi Redmi 9A', '31271/11TS00263', 'operativo', 'Asignado a: Carlos Gustavo Sosa Aranda'),
  ('C44-MOV-043', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X60K2YZH', 'operativo', null),
  ('C44-MOV-044', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61689/R5UC03778', 'operativo', 'Asignado a: Antonio de Jesús Fernández Benítez'),
  ('C44-MOV-045', 'Celular Xiaomi Redmi 9A', 'Celular', null, 'Xiaomi Redmi 9A', '29227/60U878534', 'operativo', 'Asignado a: Cesar Alejandro Rahi Geraghty'),
  ('C44-MOV-046', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X60K2H7V', 'operativo', null),
  ('C44-MOV-047', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X60HWSZT', 'operativo', 'Asignado a: Mario Esteban Penayo Bogado'),
  ('C44-MOV-048', 'Celular Samsung A15', 'Celular', null, 'Samsung A15', 'RF8X50G7HEH', 'operativo', 'Asignado a: Administración'),
  ('C44-MOV-053', 'Tablet Samsung Galaxy Tab A7', 'Tablet', null, 'Samsung Galaxy Tab A7', null, 'operativo', 'Asignado a: Antonio'),
  ('C44-MOV-054', 'Celular Samsung Galaxy A15', 'Celular', null, 'Samsung Galaxy A15', 'RF8X302GRZP', 'operativo', 'Asignado a: Roque Mendez'),
  ('C44-MOV-056', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61689/R5UC04015', 'operativo', null),
  ('C44-MOV-057', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61689/R5UC03717', 'operativo', 'Asignado a: Yasmin Araceli Pereira Ovelar · NPS'),
  ('C44-MOV-058', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61745/R5U500521', 'operativo', 'Sin asignar'),
  ('C44-MOV-059', 'Celular Xiaomi Poco X7 Pro', 'Celular', null, 'Xiaomi Poco X7 Pro', '61745/R5U501176', 'operativo', 'Sin asignar')
    ) as t(codigo, nombre, tipo, marca, modelo, serie, estado, detalle)
  loop
    insert into public.activos (
      empresa_id, codigo, nombre, categoria, marca, modelo,
      numero_serie, estado, descripcion, es_demostracion
    ) values (
      v_empresa, r.codigo, r.nombre, r.tipo, r.marca, r.modelo,
      r.serie, r.estado::public.estado_activo, r.detalle, false
    )
    on conflict (empresa_id, upper(codigo)) do update set
      nombre = excluded.nombre,
      categoria = excluded.categoria,
      marca = excluded.marca,
      modelo = excluded.modelo,
      numero_serie = excluded.numero_serie,
      estado = excluded.estado,
      descripcion = excluded.descripcion,
      es_demostracion = false;
  end loop;
end;
$$;

-- =====================================================================
-- DATOS REALES: 90-retirar-procesos-de-demostracion.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- DATOS REALES · Retiro de los procesos de demostracion
-- =====================================================================
-- El seed invento siete procesos (COM, CMP, DEP, REG, COB, RRHH, TI)
-- antes de que se conociera el mapa verdadero. Ahora que estan cargados
-- los diecinueve reales, esos siete sobran: dejarlos convertiria el mapa
-- de procesos en una mezcla de lo real y lo inventado, que es justo lo
-- que Direccion no debe ver.
--
-- No se pueden borrar y ya. De ellos cuelgan dos cosas distintas:
--
--   · Registros de demostracion (no conformidades, riesgos, objetivos,
--     indicadores, auditorias, publicaciones). Si se borra el proceso,
--     la clave foranea los deja en null y quedan sin proceso: peor que
--     antes.
--   · Registros REALES. Los nueve perfiles de puesto del formulario
--     R-02-01 se cargaron sobre DEP, y los diez documentos de TI sobre
--     TI, porque en ese momento eran los unicos procesos disponibles.
--
-- Asi que primero se reasigna todo al proceso real que le corresponde y
-- recien despues se borran los siete.
--
-- Donde el mapa real separa lo que el seed juntaba, la reasignacion es
-- por registro y no por proceso. El conteo ciclico no es almacenamiento:
-- es SOP-05 Inventario de Existencias. El respaldo de datos no es
-- infraestructura: es SOP-07 Seguridad Informatica.
--
-- Tambien se corrigen EST-01 y EST-02. El seed los llamaba "Direccion y
-- planificacion estrategica" y "Gestion de la calidad"; el mapa real usa
-- esos mismos codigos para "Informacion Documentada" y "Planificacion
-- Estrategica del SGC". Al cargar el mapa, el nombre cambio pero los
-- registros se quedaron donde estaban, apuntando a un proceso que ya no
-- trata de lo que ellos tratan.
--
-- Se aplica DESPUES de 10-mapa-de-procesos.sql. Es idempotente: una vez
-- retirados los siete procesos, la segunda corrida no encuentra nada que
-- mover y termina sin hacer nada.

do $$
declare
  v_empresa uuid;
  -- Equivalencia de proceso a proceso: a donde va, por defecto, todo lo
  -- que colgaba de cada proceso inventado.
  equivalencias constant text[][] := array[
    ['COM',  'MIS-03'],   -- Comercial y ventas          → Ventas
    ['CMP',  'SOP-08'],   -- Compras e importaciones     → Compras locales y Evaluacion a Proveedores
    ['DEP',  'MIS-02'],   -- Deposito y logistica        → Almacenamiento
    ['REG',  'SOP-05'],   -- Cumplimiento regulatorio    → Inventario de Existencias
    ['COB',  'SOP-04'],   -- Cobranzas                   → Gestion de Cobranzas
    ['RRHH', 'SOP-01'],   -- Recursos humanos            → Gestion del Capital Humano
    ['TI',   'SOP-02']    -- Tecnologia de la informacion → Infraestructura y Tecnologia
  ];
  r record;
  v_origen uuid;
  v_destino uuid;
  v_faltan int;
begin
  select id into v_empresa from public.empresas order by creado_en limit 1;
  if v_empresa is null then
    raise exception 'No hay ninguna empresa cargada. Aplique el seed primero.';
  end if;

  -- Si el mapa real no esta cargado, no hay a donde reasignar. Se corta
  -- antes de tocar nada, en lugar de dejar los registros en el aire.
  select count(*) into v_faltan
    from unnest(array['MIS-02','MIS-03','SOP-01','SOP-02','SOP-04','SOP-05','SOP-08']) c
   where not exists (
     select 1 from public.procesos p
      where p.empresa_id = v_empresa and lower(p.codigo) = lower(c));
  if v_faltan > 0 then
    raise exception 'Falta el mapa de procesos real. Aplique antes 10-mapa-de-procesos.sql.';
  end if;

  -- -------------------------------------------------------------------
  -- 1 · Reasignacion por defecto, proceso a proceso
  -- -------------------------------------------------------------------
  for r in select equivalencias[i][1] as origen, equivalencias[i][2] as destino
             from generate_subscripts(equivalencias, 1) i
  loop
    select id into v_origen from public.procesos
     where empresa_id = v_empresa and lower(codigo) = lower(r.origen);
    continue when v_origen is null;   -- ya retirado en una corrida anterior

    select id into v_destino from public.procesos
     where empresa_id = v_empresa and lower(codigo) = lower(r.destino);

    update public.no_conformidades  set proceso_id = v_destino where proceso_id = v_origen;
    update public.riesgos           set proceso_id = v_destino where proceso_id = v_origen;
    update public.indicadores       set proceso_id = v_destino where proceso_id = v_origen;
    update public.objetivos         set proceso_id = v_destino where proceso_id = v_origen;
    update public.documentos        set proceso_id = v_destino where proceso_id = v_origen;
    update public.documento_difusion set proceso_id = v_destino where proceso_id = v_origen;
    update public.auditorias        set proceso_id = v_destino where proceso_id = v_origen;
    update public.auditoria_hallazgos set proceso_id = v_destino where proceso_id = v_origen;
    update public.publicaciones     set proceso_id = v_destino where proceso_id = v_origen;
    update public.puestos           set proceso_id = v_destino where proceso_id = v_origen;
    update public.usuarios          set proceso_id = v_destino where proceso_id = v_origen;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 2 · Correcciones por registro
-- ---------------------------------------------------------------------
-- El mapa real separa conceptos que el seed trataba como uno solo. Cada
-- registro de esta lista va a un proceso distinto del que le tocaria por
-- la equivalencia de arriba.

do $$
declare
  v_empresa uuid;

begin
  select id into v_empresa from public.empresas order by creado_en limit 1;

  -- No conformidades
  update public.no_conformidades n set proceso_id = p.id
    from public.procesos p
   where p.empresa_id = v_empresa and n.empresa_id = v_empresa
     and (n.codigo, lower(p.codigo)) in (
       ('NC-2026-001', 'sop-05'),   -- conteo ciclico → Inventario de Existencias
       ('NC-2026-005', 'est-01')    -- documento vencido → Informacion Documentada
     );

  -- Riesgos
  update public.riesgos g set proceso_id = p.id
    from public.procesos p
   where p.empresa_id = v_empresa and g.empresa_id = v_empresa
     and (g.codigo, lower(p.codigo)) in (
       ('R-2026-002', 'mis-01'),    -- estacionalidad de la demanda → Importacion
       ('R-2026-004', 'sop-07')     -- verificacion de respaldos → Seguridad Informatica
     );

  -- Indicadores
  update public.indicadores i set proceso_id = p.id
    from public.procesos p
   where p.empresa_id = v_empresa and i.empresa_id = v_empresa
     and (i.codigo, lower(p.codigo)) in (
       ('KPI-01', 'sop-05'),        -- exactitud de inventario → Inventario de Existencias
       ('KPI-04', 'est-03'),        -- plan de auditorias → Auditoria Interna del SGC
       ('KPI-05', 'est-04')         -- cierre de NC en plazo → No Conformidades y Acciones Correctivas
     );

  -- Objetivos
  update public.objetivos o set proceso_id = p.id
    from public.procesos p
   where p.empresa_id = v_empresa and o.empresa_id = v_empresa
     and (o.codigo, lower(p.codigo)) in (
       ('OBJ-01', 'sop-05'),        -- diferencias de inventario → Inventario de Existencias
       ('OBJ-03', 'est-03')         -- auditorias internas del ejercicio → Auditoria Interna del SGC
     );

  -- Documentos. El juego documental de TI es, en su mayor parte, del
  -- sistema de seguridad de la informacion: va a SOP-07 y no a SOP-02.
  update public.documentos d set proceso_id = p.id
    from public.procesos p
   where p.empresa_id = v_empresa and d.empresa_id = v_empresa
     and (upper(d.codigo), lower(p.codigo)) in (
       ('POL-01',      'est-02'),   -- politica de calidad → Planificacion Estrategica del SGC
       ('F-DEP-01-01', 'sop-05'),   -- formulario de conteo ciclico → Inventario de Existencias
       ('POL-IT-01',   'sop-07'),
       ('PROC-IT-02',  'sop-07'),
       ('PROC-IT-03',  'sop-07'),
       ('PLAN-IT-04',  'sop-07'),
       ('PROC-IT-06',  'sop-07'),
       ('PROC-IT-07',  'sop-07'),
       ('PROC-IT-09',  'sop-07'),
       ('PROC-IT-10',  'sop-07')
     );

  -- Puestos. Los perfiles reales del R-02-01 se cargaron todos sobre el
  -- proceso de deposito; el mapa real los reparte.
  update public.puestos u set proceso_id = p.id
    from public.procesos p
   where p.empresa_id = v_empresa and u.empresa_id = v_empresa
     and (upper(u.codigo), lower(p.codigo)) in (
       ('P-001', 'est-02'),         -- Gerente general → Planificacion Estrategica del SGC
       ('P-002', 'est-02'),         -- Responsable de calidad → Planificacion Estrategica del SGC
       ('P-102', 'sop-02'),         -- Responsable IT → Infraestructura y Tecnologia
       ('P-105', 'sop-04'),         -- Gestor de Cobranzas y Entregas
       ('P-106', 'mis-05'),         -- Asistente Tecnico → Servicio Tecnico
       ('P-107', 'sop-05'),         -- Control de Stock 1
       ('P-108', 'sop-05'),         -- Control de Stock 2
       ('P-109', 'sop-05')          -- Reposicion de Stock
     );

  -- Cada persona sigue al proceso de su puesto: asi no hay que mantener
  -- dos listas que digan lo mismo.
  update public.usuarios s set proceso_id = u.proceso_id
    from public.puestos u
   where s.puesto_id = u.id and s.empresa_id = v_empresa
     and s.proceso_id is distinct from u.proceso_id;
end;
$$;

-- ---------------------------------------------------------------------
-- 3 · Retiro
-- ---------------------------------------------------------------------
-- Ya nada cuelga de ellos. Se borran, y con ellos la ultima traza del
-- mapa de procesos inventado.

delete from public.procesos p
 where lower(p.codigo) in ('com', 'cmp', 'dep', 'reg', 'cob', 'rrhh', 'ti')
   and exists (select 1 from public.procesos q
                where q.empresa_id = p.empresa_id and lower(q.codigo) = 'mis-03');

-- ---------------------------------------------------------------------
-- 4 · Un documento de demostracion que ya sobra
-- ---------------------------------------------------------------------
-- El seed invento una "Politica de calidad" con codigo POL-01. La real
-- esta cargada desde la unidad compartida y no lleva codigo. Tener dos
-- politicas de calidad en la misma lista, una marcada como demostracion,
-- es justo lo que confunde a quien entra a mirar. Se borra la inventada.
--
-- El resto de los documentos de demostracion se quedan: son formularios
-- e instructivos sin equivalente real, y la insignia "Demostracion" los
-- distingue.

delete from public.documentos d
 where upper(d.codigo) = 'POL-01'
   and d.es_demostracion
   and exists (
     select 1 from public.documentos r
      where r.empresa_id = d.empresa_id
        and r.codigo is null
        and r.titulo = 'Política de Calidad'
        and not r.es_demostracion);

-- =====================================================================
-- DATOS REALES: 95-reparar-codigos-pisados.sql
-- =====================================================================
-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- DATOS REALES · Reparar los codigos que piso la importacion de Sofidya
-- =====================================================================
-- La primera version de la importacion escribia el codigo tambien al
-- actualizar. Cuando un puesto de Sofidya coincidia de nombre con uno ya
-- cargado, le pisaba el codigo real con uno derivado del identificador
-- interno de Sofidya: el perfil P-101 del formulario R-02-01 quedaba
-- como SOF-P-31.
--
-- El codigo de la importacion ya no lo hace: ahora el codigo se escribe
-- solo al crear la fila. Esto repara lo que alcanzo a pisarse antes.
--
-- Es idempotente y no hace nada si no hay nada roto: solo toca filas
-- cuyo codigo empieza con SOF- y cuyo nombre coincide con uno de los
-- registros conocidos, y solo si el codigo verdadero esta libre.

do $$
declare
  v_empresa uuid;
  r record;
  v_id uuid;
begin
  select id into v_empresa from public.empresas order by creado_en limit 1;
  if v_empresa is null then
    return;
  end if;

  -- -------------------------------------------------------------------
  -- Puestos: los nueve perfiles del formulario R-02-01
  -- -------------------------------------------------------------------
  for r in
    select * from (values
      ('P-101', 'Jefe de Logística'),
      ('P-102', 'Responsable IT'),
      ('P-103', 'Asistente de Logística Mayorista'),
      ('P-104', 'Asistente de Gestiones'),
      ('P-105', 'Gestor de Cobranzas y Entregas'),
      ('P-106', 'Asistente Técnico'),
      ('P-107', 'Asistente de Control de Stock 1'),
      ('P-108', 'Asistente de Control de Stock 2'),
      ('P-109', 'Asistente de Reposición de Stock')
    ) as t(codigo, nombre)
  loop
    -- Si el codigo verdadero sigue en su lugar, no hay nada que reparar.
    continue when exists (
      select 1 from public.puestos
       where empresa_id = v_empresa and lower(codigo) = lower(r.codigo));

    select id into v_id from public.puestos
     where empresa_id = v_empresa
       and nombre = r.nombre
       and codigo like 'SOF-%'
     order by creado_en
     limit 1;

    if v_id is not null then
      update public.puestos set codigo = r.codigo where id = v_id;
      raise notice 'Puesto "%" recupero su codigo %.', r.nombre, r.codigo;
    end if;
  end loop;

  -- -------------------------------------------------------------------
  -- Proveedores del seed
  -- -------------------------------------------------------------------
  for r in
    select * from (values
      ('PRV-001', 'Importadora Andina de Equipamiento S.A.'),
      ('PRV-002', 'Distribuidora de Municiones del Sur Ltda.'),
      ('PRV-003', 'Transportes Ñemity S.R.L.'),
      ('PRV-004', 'Insumos Gráficos Paraguay S.A.'),
      ('PRV-005', 'Servicios Informáticos Aguará S.R.L.')
    ) as t(codigo, razon_social)
  loop
    continue when exists (
      select 1 from public.proveedores
       where empresa_id = v_empresa and upper(codigo) = upper(r.codigo));

    select id into v_id from public.proveedores
     where empresa_id = v_empresa
       and razon_social = r.razon_social
       and codigo like 'SOF-%'
     order by creado_en
     limit 1;

    if v_id is not null then
      update public.proveedores set codigo = r.codigo where id = v_id;
      raise notice 'Proveedor "%" recupero su codigo %.', r.razon_social, r.codigo;
    end if;
  end loop;
end;
$$;
