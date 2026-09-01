-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- Anunciar un documento en el inicio
-- =====================================================================
--
-- Cuando Calidad pone en vigencia un procedimiento, la gente tiene que
-- enterarse. Hoy hay dos caminos y ninguno alcanza solo: la difusion
-- notifica a una lista de personas, y el muro del inicio es lo que se
-- mira todos los dias sin que nadie lo pida.
--
-- Este vinculo permite lo segundo: publicar el documento como anuncio.
-- La publicacion no copia el documento, lo referencia. Asi el anuncio
-- puede llevar a la ficha, y desde la ficha se ve si ya se anuncio y
-- cuando.
--
-- `on delete set null` y no `cascade`: si el documento se elimina, el
-- anuncio queda. Lo que se le dijo a la empresa se dijo, y borrarlo del
-- muro seria reescribir lo que la gente ya leyo.
-- =====================================================================

alter table public.publicaciones
  add column if not exists documento_id uuid references public.documentos (id)
    on delete set null;

comment on column public.publicaciones.documento_id is
  'Documento que origino el anuncio. La publicacion lo referencia, no lo copia.';

create index if not exists publicaciones_documento_idx
  on public.publicaciones (documento_id)
  where documento_id is not null;
