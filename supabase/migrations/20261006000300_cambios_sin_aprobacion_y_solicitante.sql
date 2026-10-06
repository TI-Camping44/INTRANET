-- ---------------------------------------------------------------------
-- Planificacion y Gestion de Cambios: sin aprobacion, y con solicitante
--
-- Calidad definio el 6 de octubre que en este modulo la aprobacion no
-- aplica. El recorrido queda borrador → implementado → cerrado.
--
-- NO SE TOCA EL ENUMERADO. `en_aprobacion`, `aprobado` y `rechazado`
-- siguen existiendo —en PostgreSQL un valor no se puede quitar— y los
-- registros que esten en esos estados siguen teniendo salida:
-- CAM-2026-001 quedo «en aprobacion» y sin salida se habria trabado
-- para siempre. Lo que se retira es la ENTRADA: desde borrador ya no se
-- va a aprobacion. Eso vive en `TRANSICIONES_CAMBIO`, en `lib/cambios.ts`.
--
-- EL SOLICITANTE Y LA FECHA DE SOLICITUD no los pedia el formulario y
-- las dos columnas del listado salian siempre vacias. No hacia falta
-- pedirlos: quien registra el cambio es quien lo solicita, y la fecha es
-- la del registro. El alta ya los completa; esta migracion arregla los
-- dos que estaban cargados.
-- ---------------------------------------------------------------------

update public.cambios
   set solicitante_id = coalesce(solicitante_id, creado_por),
       fecha_solicitud = coalesce(fecha_solicitud, (creado_en at time zone 'America/Asuncion')::date)
 where solicitante_id is null
    or fecha_solicitud is null;
