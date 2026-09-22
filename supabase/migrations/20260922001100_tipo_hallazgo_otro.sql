-- ---------------------------------------------------------------------
-- Tipos de hallazgo segun Calidad
--
-- Los que usa Camping 44 son cuatro: no conformidad menor, no conformidad
-- mayor, observacion/recomendacion y otros. Faltaba «otros».
--
-- «Oportunidad de mejora» y «Fortaleza» quedan en el enumerado —de un
-- tipo de PostgreSQL no se saca un valor y puede haber hallazgos
-- cargados con ellos— pero dejan de ofrecerse. Es el mismo criterio que
-- con los origenes de no conformidad y los tipos de documento retirados.
--
-- «Otros» NO genera no conformidad, igual que los dos retirados:
-- `generar_no_conformidad_desde_hallazgo()` ya limita esa derivacion a
-- los tres primeros y no hace falta tocarla. La etiqueta de
-- «Observacion» pasa a «Observacion/Recomendacion», que es como la
-- nombra el formulario de Calidad y como ya se llama la severidad
-- equivalente de la no conformidad.
-- ---------------------------------------------------------------------

alter type public.tipo_hallazgo add value if not exists 'otro';
