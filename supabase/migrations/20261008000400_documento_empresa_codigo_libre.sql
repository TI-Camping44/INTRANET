-- ---------------------------------------------------------------------
-- Informacion Documentada: empresa, codigo libre y proceso documentado.
--
-- EL CODIGO DEJA DE TENER FORMATO IMPUESTO. La restriccion exigia
-- `^[A-Z]{1,4}(-[A-Z0-9]{1,4}){1,4}$`, que es la forma que invento el
-- proyecto —`MP-SOP-01`, `F-COM-01-02`—. La codificacion real de Calidad
-- es otra y no tiene por que entrar en ese molde: se saca la
-- restriccion y el codigo se escribe como Calidad lo usa.
--
-- A QUE EMPRESA PERTENECE EL DOCUMENTO. Camping 44 S.A. y Vitalica
-- E.A.S. llevan su informacion documentada por separado, y el listado se
-- parte en dos con los botones de arriba. Columna propia: `empresa_id`
-- es el predicado de `misma_empresa()` y siempre vale Camping 44.
--
-- EL PROCESO ES UN DOCUMENTO, NO UNA LISTA FIJA. Hasta ahora el campo
-- «Proceso» ofrecia los diecinueve del mapa, estuvieran o no cargados en
-- Informacion Documentada. Lo que sirve es atar un instructivo, un
-- protocolo o un formulario a SU manual de proceso, y ese manual es un
-- documento mas. `proceso_id` queda para los registros ya cargados.
-- ---------------------------------------------------------------------

alter table public.documentos drop constraint if exists documentos_codigo_formato;

alter table public.documentos
  add column if not exists empresa_documento_id uuid references public.empresas (id),
  add column if not exists proceso_documento_id uuid references public.documentos (id) on delete set null;

update public.documentos
set empresa_documento_id = '11111111-1111-4111-8111-111111111111'
where empresa_documento_id is null;

comment on column public.documentos.empresa_documento_id is
  'A que empresa del grupo pertenece el documento. No confundir con empresa_id, que es el acotamiento de RLS.';
comment on column public.documentos.proceso_documento_id is
  'El manual de proceso al que pertenece este documento. Reemplaza a proceso_id: el proceso es un documento cargado, no una lista fija.';
