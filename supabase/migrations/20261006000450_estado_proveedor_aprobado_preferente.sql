-- ---------------------------------------------------------------------
-- «Aprobado preferente», el resultado nuevo del Asociado de Negocio
--
-- Va solo en esta migracion: PostgreSQL no deja usar un valor de
-- enumerado en la misma transaccion que lo agrega.
-- ---------------------------------------------------------------------

alter type public.estado_proveedor add value if not exists 'aprobado_preferente';
