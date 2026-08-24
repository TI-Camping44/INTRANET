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
