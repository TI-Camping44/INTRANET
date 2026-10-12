-- La resolucion del caso: como se soluciono
--
-- El paso «Registrar la resolucion» pedia la fecha y la compensacion,
-- pero no COMO se soluciono el caso. Son dos cosas distintas: la
-- compensacion es lo que se le dio al cliente, y la resolucion es lo que
-- se hizo para que el problema deje de existir. Un caso puede resolverse
-- sin compensacion ninguna, y ahi quedaba sin registro de nada.
--
-- Lo pidio Calidad el 12 de octubre, junto con que el paso se habilite
-- recien cuando todas las acciones del plan estan ejecutadas: mientras
-- queda una abierta, el caso no esta resuelto.

alter table public.reclamos
  add column if not exists resolucion_detalle text;

comment on column public.reclamos.resolucion_detalle is
  'Como se soluciono el caso. Distinto de compensacion_detalle, que es '
  'lo que se le dio al cliente: un caso puede resolverse sin compensacion.';
