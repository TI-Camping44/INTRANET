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
