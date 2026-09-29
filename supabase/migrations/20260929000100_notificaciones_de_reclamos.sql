-- =====================================================================
-- Intranet - Camping 44 S.A.
-- Tipos de notificacion de Reclamos de Clientes
-- =====================================================================
-- El modulo de reclamos vive de sus plazos: 24 horas habiles para el
-- primer contacto, y 3, 7 o 15 dias habiles para resolver segun el plan.
-- Un plazo que nadie mira no es un plazo, asi que el trabajo programado
-- tiene que poder avisar. Para eso necesita sus propios tipos.
--
-- VAN COMO TIPOS PROPIOS Y NO COMO «general» a proposito: la persona
-- filtra sus notificaciones por tipo, y un aviso de reclamo mezclado con
-- todo lo demas es un aviso que no se encuentra.
--
-- `add value if not exists` para que reaplicar la migracion no falle. Un
-- valor de enumerado no se puede quitar despues: estos cuatro son los que
-- el procedimiento necesita y no hay un quinto de reserva.
-- ---------------------------------------------------------------------

alter type public.tipo_notificacion add value if not exists 'reclamo_asignado';
alter type public.tipo_notificacion add value if not exists 'reclamo_por_vencer';
alter type public.tipo_notificacion add value if not exists 'reclamo_vencido';
alter type public.tipo_notificacion add value if not exists 'reclamo_verificacion_pendiente';
