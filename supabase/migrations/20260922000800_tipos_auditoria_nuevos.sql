-- ---------------------------------------------------------------------
-- Tipos de auditoria segun Calidad
--
-- Los cuatro que usa Camping 44: por proceso, interna, externa y a
-- terceros. Faltaban dos en el enumerado.
--
-- Los valores viejos —'proveedor' y 'seguimiento'— quedan: de un tipo de
-- PostgreSQL no se saca un valor y puede haber auditorias cargadas con
-- ellos. La normalizacion de esas filas va en la migracion siguiente y no
-- aca, porque un valor recien agregado a un enumerado no se puede usar en
-- la misma transaccion en que se agrego.
-- ---------------------------------------------------------------------

alter type public.tipo_auditoria add value if not exists 'por_proceso';
alter type public.tipo_auditoria add value if not exists 'terceros';
