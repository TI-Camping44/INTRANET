-- ---------------------------------------------------------------------
-- Opciones de tratamiento del instructivo de valoracion
--
-- El instructivo de Calidad define seis opciones, y lo importante no es
-- el nombre sino que cada una dice QUE FACTOR puede bajar en el residual:
--
--   eliminar_fuente       la probabilidad baja a 1, y muchas veces el
--                         riesgo deja de existir.
--   cambiar_probabilidad  baja la probabilidad; la severidad no cambia.
--                         Mantenimiento, capacitacion, verificacion doble.
--   cambiar_consecuencia  baja la severidad; la probabilidad no cambia.
--                         Contingencia, stock de respaldo, protocolo.
--   compartir             baja la severidad, casi siempre solo en la
--                         dimension economica. Seguros, traslado
--                         contractual.
--   evitar                se discontinua la actividad. No se valora
--                         residual: la fila se cierra.
--   asumir                el residual es igual al inherente. Hay que
--                         registrar quien lo decidio y con que fundamento.
--
-- Las cinco viejas —evitar, mitigar, transferir, aceptar, explotar—
-- quedan en el enumerado porque hay siete riesgos cargados con ellas y de
-- un tipo de PostgreSQL no se saca un valor. Dejan de ofrecerse. Calidad
-- tiene que decir a cual de las seis pasa cada uno: «mitigar» puede ser
-- cambiar la probabilidad o cambiar la consecuencia, y adivinarlo seria
-- inventar el criterio que el instructivo justamente viene a fijar.
--
-- Va en su propia migracion porque un valor recien agregado a un
-- enumerado no se puede usar en la misma transaccion en que se agrego.
-- ---------------------------------------------------------------------

alter type public.tratamiento_riesgo add value if not exists 'eliminar_fuente';
alter type public.tratamiento_riesgo add value if not exists 'cambiar_probabilidad';
alter type public.tratamiento_riesgo add value if not exists 'cambiar_consecuencia';
alter type public.tratamiento_riesgo add value if not exists 'compartir';
alter type public.tratamiento_riesgo add value if not exists 'asumir';
