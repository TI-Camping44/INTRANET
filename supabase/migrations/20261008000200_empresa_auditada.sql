-- ---------------------------------------------------------------------
-- A que empresa del grupo se audita.
--
-- Camping 44 S.A. y Vitalica E.A.S. son el mismo grupo y la misma gente
-- las administra, asi que `empresa_id` —el predicado de
-- `misma_empresa()`— siempre vale Camping 44 y no puede usarse para
-- decir a cual se audita. Va en una columna propia, como ya se hizo con
-- `proveedores.empresa_compradora_id`, `puestos.empresa_del_puesto_id` y
-- `no_conformidades.empresa_afectada_id`.
--
-- La auditoria que ya estaba cargada queda en Camping 44, que es de
-- donde venia.
--
-- Reemplaza a la sede en la ficha: Direccion pidio el 8 de octubre ver
-- la empresa y no la sede, que nunca se cargo en ninguna auditoria.
-- ---------------------------------------------------------------------

alter table public.auditorias
  add column if not exists empresa_auditada_id uuid references public.empresas (id);

update public.auditorias
set empresa_auditada_id = '11111111-1111-4111-8111-111111111111'
where empresa_auditada_id is null;

comment on column public.auditorias.empresa_auditada_id is
  'A que empresa del grupo se audita. No confundir con empresa_id, que es el acotamiento de RLS.';
