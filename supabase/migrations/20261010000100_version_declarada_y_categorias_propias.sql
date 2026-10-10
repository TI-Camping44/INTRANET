-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- La version se declara, y la categoria existe aunque este vacia
-- =====================================================================
-- DOS COSAS que vienen del mismo cambio de criterio: el sistema deja de
-- calcular lo que el documento de papel ya dice.
--
-- 1. LA VERSION SE ESCRIBE, NO SE CALCULA. Hasta ahora salia de
--    `version_actual`, un entero que arrancaba en 0 y subia en cada
--    aprobacion. Servia mientras el sistema llevaba el versionado; pero
--    el documento real ya viene con su version escrita y lo que hay que
--    cargar es ESA, no la que el sistema le hubiera puesto.
--
--    Va en `version_documento`, texto y no entero: la codificacion real
--    de Calidad no es necesariamente `00`, `01`. Es texto libre por la
--    misma razon por la que el codigo lo es.
--
--    Puede ir vacia —«No aplica»—, igual que el codigo: hay documentos
--    que no llevan version.
--
--    `version_actual` NO se toca. Lo sigue usando el historial de
--    aprobaciones, que cuenta cuantas veces paso por el circuito, y eso
--    es otra pregunta que la version del documento.
--
-- 2. LA CATEGORIA NECESITA TABLA PROPIA. Vivia como texto en
--    `documentos.categoria`, y la pantalla sacaba la lista de los
--    documentos cargados. Consecuencia: una categoria sin documentos no
--    existia en ningun lado. `guardarCategoria()` decia aceptar la
--    categoria vacia y no tenia donde guardarla, asi que al recargar la
--    pantalla no estaba.
--
--    Calidad arma la carpeta antes de tener los documentos adentro, asi
--    que la carpeta tiene que ser una fila.
--
--    `documentos.categoria` se mantiene como esta —es texto y lo sigue
--    siendo— para no reescribir todo el modulo de golpe. La tabla nueva
--    es la lista de carpetas; la columna dice en cual esta cada
--    documento.
-- =====================================================================

alter table public.documentos
  add column if not exists version_documento text;

comment on column public.documentos.version_documento is
  'La version que dice el documento original, escrita a mano. Nula cuando no lleva.';

-- No un texto en blanco: o dice algo, o es nula. Si no, «sin version» se
-- guarda de dos formas distintas y las pantallas tienen que contemplar
-- las dos.
alter table public.documentos
  drop constraint if exists documentos_version_declarada_no_vacia;
alter table public.documentos
  add constraint documentos_version_declarada_no_vacia
  check (version_documento is null or btrim(version_documento) <> '');

-- ---------------------------------------------------------------------
-- Las categorias de la lista maestra, como filas
-- ---------------------------------------------------------------------
create table if not exists public.documento_categorias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  nombre text not null,
  -- Donde va la carpeta en el listado. Es la misma escala que
  -- `documentos.orden_categoria`, que es quien la ordena hoy.
  orden integer,
  creado_por uuid references public.usuarios (id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint documento_categorias_nombre_valido
    check (btrim(nombre) <> '' and length(nombre) <= 60)
);

comment on table public.documento_categorias is
  'Las carpetas de la lista maestra. Existen aunque todavia no tengan documentos adentro.';

-- Sin distinguir mayusculas, que es el caso que de verdad pasa:
-- «Politicas» y «politicas» son la misma carpeta.
--
-- SIN TILDES NO SE PUEDE: `unaccent` no esta marcada IMMUTABLE y
-- PostgreSQL no la acepta en una expresion de indice. La comparacion
-- sin tildes la hace la accion de servidor antes de insertar, que es
-- donde se decide si la carpeta ya existe.
create unique index if not exists documento_categorias_unica
  on public.documento_categorias (empresa_id, lower(nombre));

drop trigger if exists documento_categorias_actualizacion on public.documento_categorias;
create trigger documento_categorias_actualizacion
  before update on public.documento_categorias
  for each row execute function public.marcar_actualizacion();

drop trigger if exists bitacora_documento_categorias on public.documento_categorias;
create trigger bitacora_documento_categorias
  after insert or update or delete on public.documento_categorias
  for each row execute function public.registrar_bitacora();

-- ---------------------------------------------------------------------
-- RLS. Una tabla nueva sin politicas es un error, no un pendiente, y
-- sin el `grant` PostgreSQL corta antes de evaluarlas: esta tabla esta
-- fuera del bucle de `..._politicas_rls.sql`.
-- ---------------------------------------------------------------------
alter table public.documento_categorias enable row level security;

grant select, insert, update, delete on public.documento_categorias to authenticated;

drop policy if exists documento_categorias_lectura on public.documento_categorias;
create policy documento_categorias_lectura on public.documento_categorias
  for select using (public.misma_empresa(empresa_id));

drop policy if exists documento_categorias_gestion on public.documento_categorias;
create policy documento_categorias_gestion on public.documento_categorias
  for all
  using (public.misma_empresa(empresa_id) and public.puede_gestionar())
  with check (public.misma_empresa(empresa_id) and public.puede_gestionar());

-- ---------------------------------------------------------------------
-- Las carpetas que ya existen, como filas
-- ---------------------------------------------------------------------
-- Salen de los documentos cargados, que es de donde las sacaba la
-- pantalla hasta ahora. Sin esto, abrir la pantalla despues de aplicar
-- la migracion mostraria la lista vacia.
insert into public.documento_categorias (empresa_id, nombre, orden)
select d.empresa_id,
       min(d.categoria)                as nombre,
       min(coalesce(d.orden_categoria, 0)) as orden
  from public.documentos d
 where d.categoria is not null
   and btrim(d.categoria) <> ''
 group by d.empresa_id, lower(d.categoria)
on conflict do nothing;
