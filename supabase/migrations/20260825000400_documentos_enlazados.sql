-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 023 · Documentos: enlace al archivo vigente y tipo "plan"
-- =====================================================================
-- Direccion pidio un repositorio de procedimientos vigentes con numero de
-- version y fecha, para que nadie use la version equivocada.
--
-- La forma barata de resolverlo mal seria subir una copia de cada archivo
-- a la intranet. En dos meses habria dos versiones de cada documento y
-- nadie sabria cual rige, que es exactamente el problema a evitar.
--
-- La intranet es el indice: codigo, titulo, version, fecha y estado. El
-- archivo sigue viviendo donde ya vive, y se enlaza. Cuando Calidad lo
-- actualiza ahi, la intranet muestra lo nuevo sin hacer nada.

alter table public.documentos
  add column if not exists url_documento text;

comment on column public.documentos.url_documento is
  'Enlace al archivo vigente. La intranet indexa y enlaza; no duplica el contenido.';

-- El juego documental de Camping 44 incluye planes, que el enum no
-- contemplaba: el "PLAN-IT-04 Plan de Contingencia Informatica" no es un
-- procedimiento ni un manual.
alter type public.tipo_documento add value if not exists 'plan';
