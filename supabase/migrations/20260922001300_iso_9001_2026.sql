-- ---------------------------------------------------------------------
-- ISO 9001:2026 reemplaza a la edicion 2015
--
-- La fila se actualiza en lugar de crear una nueva a proposito: es la
-- misma norma en una edicion nueva, y los documentos, las auditorias y
-- las no conformidades que la referencian por `norma_id` tienen que
-- seguir apuntando a ella. Crear una fila nueva dejaria todo lo cargado
-- colgado de una norma que ya no rige.
--
-- La edicion queda en `version`, que es la columna que existe para eso.
-- Si mas adelante Calidad necesita distinguir que se audito contra 2015
-- y que contra 2026, eso se resuelve con la fecha de la auditoria y no
-- duplicando la norma.
--
-- El texto libre que cita clausulas —criterios de auditoria, requisito
-- incumplido de una no conformidad— no se toca: dice contra que se
-- audito en su momento y reescribirlo seria falsear el registro.
-- ---------------------------------------------------------------------

update public.normas
   set codigo = 'ISO 9001:2026',
       version = '2026',
       descripcion =
         'Edicion 2026. Reemplaza a ISO 9001:2015. Incorpora, entre otros, la '
         'determinacion obligatoria sobre cambio climatico en el contexto (4.1) y '
         'el apartado propio de acciones para abordar las oportunidades (6.1.3).'
 where lower(codigo) = 'iso 9001:2015';
