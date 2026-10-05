-- =====================================================================
-- Intranet - Camping 44 S.A.
-- El estado «anulado» de un documento
-- =====================================================================
-- Va solo en su migracion: PostgreSQL no deja usar un valor de enumerado
-- en la misma transaccion en que se lo agrega, y la restriccion que lo
-- nombra viene en la siguiente.
-- ---------------------------------------------------------------------

alter type public.estado_documento add value if not exists 'anulado';
