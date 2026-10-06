-- ---------------------------------------------------------------------
-- El RUC real de las dos empresas del grupo, y el membrete que lo lleva.
--
-- Los que estaban cargados —80012345-6 y 80098765-4— eran marcadores de
-- posicion del armado inicial. Por eso la carta de evaluacion no
-- imprimia el RUC: un numero inventado en un documento que se le entrega
-- a un Asociado de Negocio es peor que no ponerlo.
--
-- Facundo paso los verdaderos el 6 de octubre.
--
-- EL MEMBRETE TIENE SU PROPIA FUNCION y no sale de un select a
-- `empresas`: esa tabla la acota RLS a la propia, asi que el RUC de
-- Vitalica no llegaria a la carta de un Asociado de Negocio suyo.
--
-- Se agrega una funcion aparte en vez de ampliar `empresas_del_grupo()`:
-- cambiarle el tipo de retorno obliga a borrarla y volver a crearla, y
-- esa funcion la usan seis pantallas. Una funcion nueva no toca nada de
-- lo que ya anda.
-- ---------------------------------------------------------------------

update public.empresas set ruc = '80020336-4'
where id = '11111111-1111-4111-8111-111111111111';

update public.empresas set ruc = '80142159-4'
where id = '22222222-2222-4222-8222-222222222222';

create or replace function public.empresa_del_membrete(id_empresa uuid)
returns table (razon_social text, ruc text)
language sql
stable
security definer
set search_path = public
as $$
  -- La razon social y el RUC de cualquiera de las dos empresas del
  -- grupo, para el membrete de los documentos que se entregan afuera.
  select e.razon_social, e.ruc
  from public.empresas e
  where e.id = id_empresa;
$$;

grant execute on function public.empresa_del_membrete(uuid) to authenticated;
