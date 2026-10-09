-- ---------------------------------------------------------------------
-- De que version viene un documento.
--
-- La columna queda preparada para el dia que Calidad prefiera que
-- actualizar de version parta el registro en dos documentos —el viejo
-- obsoleto y el nuevo vigente— en vez de llevar las versiones adentro
-- del mismo registro, que es como funciona hoy.
--
-- OJO SI SE TOMA ESE CAMINO: `documentos_codigo_unico` es un indice
-- unico sobre (empresa_id, upper(codigo)) SIN condicion, asi que dos
-- documentos no pueden compartir codigo. Habria que reemplazarlo por uno
-- parcial, que es el que deja repetir el codigo entre un documento y su
-- version retirada:
--
--   drop index public.documentos_codigo_unico;
--   create unique index documentos_codigo_unico
--     on public.documentos (empresa_id, upper(codigo))
--     where estado not in ('obsoleto', 'anulado');
--
-- No se hace en esta migracion porque no hace falta todavia: hoy la
-- version anterior se muestra en «Obsoletos» leyendo
-- `documento_versiones`, sin duplicar el documento.
-- ---------------------------------------------------------------------

alter table public.documentos
  add column if not exists documento_anterior_id uuid references public.documentos (id) on delete set null;

comment on column public.documentos.documento_anterior_id is
  'La version que este documento reemplaza, si alguna vez se parte el registro en dos.';

create index if not exists documentos_anterior_idx
  on public.documentos (documento_anterior_id);
