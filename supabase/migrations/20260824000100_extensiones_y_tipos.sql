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
