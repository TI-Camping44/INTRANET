-- =====================================================================
-- Intranet - Camping 44 S.A.
-- Aviso de los controles periodicos de TI
-- =====================================================================
-- El cronograma de Informatica calcula que control toca cada mes, pero
-- solo lo veia quien abria la pantalla. Desde ahora el trabajo
-- programado de las 11:00 avisa al responsable de cada control tres
-- veces por periodo como maximo: cuando empieza el mes que le toca,
-- cuando quedan siete dias para que termine y sigue sin registro, y una
-- vez cuando el mes termino sin registro.
--
-- Lo pidio el Responsable de TI el 17/11/2026, al sumar la copia
-- trimestral de Google Workspace (CTI-10) y adelantar a noviembre la
-- prueba de restauracion (CTI-04): «dejar ya tarea programada».
--
-- Tipo propio y no «general»: la campana se filtra por tipo.
-- ---------------------------------------------------------------------

alter type public.tipo_notificacion add value if not exists 'control_ti_pendiente';
