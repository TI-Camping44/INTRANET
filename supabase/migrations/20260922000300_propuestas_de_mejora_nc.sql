-- ---------------------------------------------------------------------
-- Propuestas de mejora en la no conformidad
--
-- Calidad pidio un campo mas debajo de la correccion inmediata, y que se
-- pueda cargar mas de una: de una misma desviacion suelen salir varias
-- ideas y hasta ahora terminaban todas apiladas en un solo parrafo.
--
-- Es un arreglo de texto y no una tabla aparte a proposito. Una propuesta
-- de mejora no tiene estado, ni responsable, ni fecha: no es una accion
-- correctiva —para eso esta `nc_acciones`— sino una idea anotada en el
-- momento de registrar el hallazgo. Cuando una se decide ejecutar, se
-- carga como accion de tipo 'mejora' y ahi si tiene dueno y plazo.
--
-- `not null default '{}'` para que el codigo no tenga que distinguir
-- entre «sin propuestas» y «nulo».
-- ---------------------------------------------------------------------

alter table public.no_conformidades
  add column if not exists propuestas_mejora text[] not null default '{}';

comment on column public.no_conformidades.propuestas_mejora is
  'Ideas de mejora anotadas al registrar la desviacion. Sin responsable ni plazo: '
  'la que se decide ejecutar se carga como accion de tipo mejora en nc_acciones.';
