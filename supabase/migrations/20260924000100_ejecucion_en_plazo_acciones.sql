-- ---------------------------------------------------------------------
-- Cada accion planificada se cierra a mano, en plazo o fuera de plazo
--
-- Es el mismo criterio que se aplico a la no conformidad el 23 de
-- septiembre, un nivel mas abajo: la desviacion se cierra «en plazo» o
-- «fuera de plazo», y ahora cada tarea del plan tambien.
--
-- No se agregan valores al enumerado `estado_accion` por la misma razon
-- de siempre: 'ejecutada' esta consultado en el listado transversal, en
-- el panel y en el trabajo programado de alertas. Los dos cierres son
-- ese mismo estado con una columna que dice si entro en plazo.
--
-- Mientras no se cierre a mano, la accion queda abierta y la pantalla
-- cuenta los dias desde que se cargo. El paso automatico a 'ejecutada'
-- no existe: si nadie dice que se hizo, no se hizo.
-- ---------------------------------------------------------------------

alter table public.nc_acciones
  add column if not exists ejecucion_en_plazo boolean;

comment on column public.nc_acciones.ejecucion_en_plazo is
  'Solo cuando estado = ejecutada o verificada. true: se ejecuto dentro de la fecha limite. '
  'false: despues. El sistema lo sugiere comparando fechas, pero lo elige quien cierra.';

-- Lo ya ejecutado se clasifica con la misma regla, para que el listado
-- no muestre cierres a medias en lo que ya estaba.
update public.nc_acciones
   set ejecucion_en_plazo = (fecha_ejecucion <= fecha_limite)
 where estado in ('ejecutada', 'verificada')
   and fecha_ejecucion is not null
   and fecha_limite is not null
   and ejecucion_en_plazo is null;
