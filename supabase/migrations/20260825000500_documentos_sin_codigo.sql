-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- Documentos sin codigo controlado
-- =====================================================================
-- Al cargar la unidad compartida del SGC aparecio un caso que el esquema
-- no contemplaba: no todos los documentos vigentes tienen codigo.
--
-- Los manuales de proceso, los formularios y los protocolos si lo tienen
-- (MP-SOP-01, F-SOP-05-01, P-SOP-01-01). En cambio la Matriz FODA, la
-- Matriz de Partes Interesadas, el Alcance del SGC, la Politica de
-- Calidad, el Proposito, Mision y Vision, los Valores Institucionales,
-- la Politica de Garantia y la Estructura Organizacional no lo llevan:
-- el documento se identifica por su titulo, su version y su vigencia.
-- Se verifico abriendo los archivos, no suponiendolo por el nombre.
--
-- Antes que inventarles un codigo -- que despues circularia como si
-- fuera el oficial -- se permite que la columna quede vacia. Cuando
-- Calidad los codifique, se completa y el formato vuelve a exigirse.
--
-- El alta desde la interfaz sigue pidiendo codigo: un documento nuevo
-- nace codificado. La columna vacia es para lo que ya existe asi.

alter table public.documentos
  alter column codigo drop not null;

-- El formato se sigue exigiendo cuando hay codigo. El indice unico ya
-- trata los nulos como distintos entre si, de modo que varios
-- documentos sin codigo conviven sin chocar.
alter table public.documentos
  drop constraint if exists documentos_codigo_formato;

alter table public.documentos
  add constraint documentos_codigo_formato
  check (codigo is null or codigo ~ '^[A-Z]{1,4}(-[A-Z0-9]{1,4}){1,4}$')
  not valid;

-- Se valida aparte para que la migracion se pueda volver a correr sin
-- chocar: el `drop constraint if exists` de arriba la quita primero.
alter table public.documentos validate constraint documentos_codigo_formato;
