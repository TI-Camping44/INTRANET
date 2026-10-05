-- =====================================================================
-- Intranet - Camping 44 S.A.
-- Anular un documento en vez de borrarlo
-- =====================================================================
-- UN DOCUMENTO QUE ESTUVO VIGENTE NUNCA SE BORRA. Lo fijo Calidad el 5 de
-- octubre y es lo que pide la trazabilidad de la informacion documentada:
-- una version que estuvo en uso no puede desaparecer del registro, porque
-- una auditoria va a preguntar por ella.
--
-- Se anula: queda fuera de uso, con el motivo escrito, quien lo hizo y
-- cuando, y se sigue pudiendo abrir.
--
-- DISTINTO DE «OBSOLETO»: obsoleto es el que quedo atras porque salio una
-- version nueva, y sigue siendo parte de la cadena. Anulado es el que se
-- saca de circulacion sin reemplazo —se discontinuo el proceso, cambio la
-- ley que lo exigia, se cargo por error.
--
-- El valor del enumerado va en su propia migracion porque PostgreSQL no
-- deja usarlo en la misma transaccion en que se lo agrega, y la
-- restriccion de aca abajo lo nombra.
-- ---------------------------------------------------------------------

alter table public.documentos
  add column if not exists motivo_anulacion text,
  add column if not exists anulado_por uuid references public.usuarios (id) on delete set null,
  add column if not exists fecha_anulacion date;

alter table public.documentos
  drop constraint if exists documentos_motivo_anulacion;

-- El motivo es obligatorio: un documento anulado sin explicacion deja a
-- quien lo busca dentro de un año sin saber si se reemplazo, se
-- discontinuo o fue un error de carga.
alter table public.documentos
  add constraint documentos_motivo_anulacion check (
    estado <> 'anulado'
    or (motivo_anulacion is not null and length(btrim(motivo_anulacion)) > 0)
  );

comment on column public.documentos.motivo_anulacion is
  'Por que se anulo. Obligatorio cuando el estado es anulado.';
