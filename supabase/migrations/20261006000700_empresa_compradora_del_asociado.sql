-- ---------------------------------------------------------------------
-- Para que empresa del grupo se evalua al Asociado de Negocio.
--
-- Camping 44 S.A. y Vitalica E.A.S. son un mismo grupo y la misma gente
-- las administra: no hay usuarios de Vitalica ni los va a haber, asi que
-- `empresa_id` —que es el predicado de `misma_empresa()` y define quien
-- ve el registro— siempre vale Camping 44 y no puede usarse para decir
-- de que empresa se trata.
--
-- Se separa en una columna propia, como ya se hizo con
-- `puestos.empresa_del_puesto_id` y con
-- `no_conformidades.empresa_afectada_id`. La carta de evaluacion firma
-- con esta, no con `empresa_id`: es lo que decide el logotipo y la razon
-- social del membrete que recibe el Asociado de Negocio.
--
-- Los cuatro Asociados ya cargados quedan en Camping 44, que es de donde
-- venian.
-- ---------------------------------------------------------------------

alter table public.proveedores
  add column if not exists empresa_compradora_id uuid references public.empresas (id);

update public.proveedores
set empresa_compradora_id = empresa_id
where empresa_compradora_id is null;

alter table public.proveedores
  alter column empresa_compradora_id set not null;

comment on column public.proveedores.empresa_compradora_id is
  'Empresa del grupo que le compra a este Asociado de Negocio y firma su carta de evaluacion. No confundir con empresa_id, que es el acotamiento de RLS.';
