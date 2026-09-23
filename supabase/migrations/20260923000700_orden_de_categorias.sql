-- ---------------------------------------------------------------------
-- Las categorias del control documental tambien se ordenan
--
-- Hasta ahora la carpeta se ordenaba por dentro —cada documento dentro
-- de su categoria— pero las categorias entre si salian alfabeticamente.
-- Calidad pidio poder moverlas enteras: bajar «Politicas» debajo de
-- «Procesos de soporte» y que se lleve sus documentos con ella.
--
-- La posicion va en una columna del documento y no en una tabla de
-- categorias, por la misma razon por la que la categoria es texto
-- libre: una categoria es el conjunto de documentos que la llevan
-- escrita, no una entidad aparte. Todos los documentos de una categoria
-- comparten el mismo `orden_categoria`, y quien lo mueve lo escribe en
-- todos de una vez.
--
-- «Sin categoria» es una categoria mas a estos efectos: tambien tiene
-- posicion y tambien se puede mover. Antes iba siempre primera, que es
-- justo donde no conviene que este una vez que la carpeta esta armada.
-- ---------------------------------------------------------------------

alter table public.documentos
  add column if not exists orden_categoria integer;

comment on column public.documentos.orden_categoria is
  'Posicion de la categoria dentro del listado. Igual en todos los documentos de la misma '
  'categoria. De a diez, para intercalar sin renumerar.';

create index if not exists documentos_orden_categoria_idx
  on public.documentos (empresa_id, orden_categoria, categoria, orden);

-- El orden inicial es el que hoy se ve: alfabetico, con «Sin categoria»
-- primera. Sin esto todas arrancan en nulo y el primer movimiento
-- reordenaria la pantalla entera de golpe.
with categorias as (
  select distinct empresa_id, categoria from public.documentos
),
ranking as (
  select empresa_id,
         categoria,
         row_number() over (
           partition by empresa_id
           order by categoria nulls first
         ) * 10 as posicion
    from categorias
)
update public.documentos d
   set orden_categoria = r.posicion
  from ranking r
 where d.empresa_id = r.empresa_id
   and d.categoria is not distinct from r.categoria
   and d.orden_categoria is null;
