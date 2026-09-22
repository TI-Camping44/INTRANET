-- ---------------------------------------------------------------------
-- Protocolo como tipo de documento
--
-- Calidad definio la lista de tipos que usa Camping 44: manual de
-- proceso, instructivo, protocolo, formulario y politica. «Protocolo» no
-- estaba en el enumerado y hay que agregarlo.
--
-- Los demas valores —procedimiento, registro, plan, externo— quedan en el
-- enumerado, igual que se hizo con los origenes de no conformidad
-- retirados: de un tipo de PostgreSQL no se saca un valor sin reescribir
-- la columna, y hay documentos cargados que los usan. Lo que cambia es
-- que la interfaz deja de ofrecerlos en el alta (TIPOS_DOCUMENTO_VIGENTES
-- en lib/constantes.ts). Un documento ya cargado con un tipo retirado se
-- sigue viendo con su etiqueta.
--
-- El valor por defecto de la columna pasa de 'procedimiento' —que ya no
-- se ofrece— a 'manual'.
-- ---------------------------------------------------------------------

alter type public.tipo_documento add value if not exists 'protocolo';

alter table public.documentos alter column tipo set default 'manual';
