-- ---------------------------------------------------------------------
-- Las areas de la no conformidad, con los nombres de Calidad
--
-- Tres cambios pedidos el 23 de septiembre:
--
--   * «Logistica y Operaciones» pasa a «Operaciones y Logistica». No es
--     solo el orden de las palabras: es el nombre del departamento.
--   * Se agrega «Gestion Regulatoria», que hasta ahora tenia catorce
--     objetivos del plan estrategico y ningun lugar donde registrarse.
--   * «Gestion de Calidad» pasa a «Sistema de Gestion de la Calidad».
--
-- El identificador de la primera cambia —`logistica_operaciones` a
-- `operaciones_logistica`— asi que las filas cargadas con el viejo se
-- migran. El de la tercera no cambia: lo que cambio es la etiqueta, y
-- eso vive en ETIQUETAS_AREAS (lib/constantes.ts), no en la base.
--
-- `area` es una columna de texto con CHECK, no un enumerado, asi que
-- esto se hace en una sola migracion sin el problema de los valores
-- recien agregados.
-- ---------------------------------------------------------------------

alter table public.no_conformidades drop constraint if exists no_conformidades_area_valida;

update public.no_conformidades
   set area = 'operaciones_logistica'
 where area = 'logistica_operaciones';

alter table public.no_conformidades
  add constraint no_conformidades_area_valida check (
    area is null or area in (
      'administracion',
      'tesoreria_caja',
      'creditos_cobranzas',
      'contabilidad',
      'recepcion',
      'consumidor_final',
      'mayorista',
      'marketing',
      'operaciones_logistica',
      'informatica',
      'capital_humano',
      'gestion_calidad',
      'gestion_regulatoria',
      'directorio'
    )
  );
