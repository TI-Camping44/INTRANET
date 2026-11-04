-- El cierre deja de exigir los cinco porques y pasa a exigir la causa raiz.
--
-- Calidad pidio el 4 de noviembre sacar el analisis de los cinco porques
-- del modulo de no conformidades. El formulario ya no los pregunta, pero
-- `cerrar_no_conformidad_por_respuesta()` cortaba con «Complete los cinco
-- porques» si `nc_porques` tenia menos de cinco filas: con el formulario
-- afuera, toda no conformidad nueva habria quedado sin poder cerrarse por
-- esa via.
--
-- HOY ESA FUNCION NO LA LLAMA NADA —no hay disparador ni llamador en la
-- aplicacion; el cierre en uso es `cerrarNoConformidad()`, que solo pide
-- que exista la accion correctiva— asi que esto no arregla una pantalla
-- rota: evita que quien la reconecte se encuentre con una regla que la
-- aplicacion ya no puede satisfacer.
--
-- LO QUE SE EXIGE EN SU LUGAR ES LA CAUSA RAIZ, no nada. La norma pide
-- determinar la causa de la desviacion; los cinco porques eran un metodo
-- para llegar a ella, no el requisito. El campo sigue siendo obligatorio
-- en el formulario y acá queda su control del lado de la base, que es la
-- unica capa que no se puede evadir.
--
-- `nc_porques` NO SE TOCA. Seis no conformidades tienen su cadena
-- cargada; es parte de su registro y la ficha la sigue mostrando.

create or replace function public.cerrar_no_conformidad_por_respuesta(
  p_no_conformidad_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
  v_causa text;
begin
  if public.es_direccion() then
    raise exception 'Su perfil es de solo lectura.' using errcode = '42501';
  end if;

  select empresa_id, conclusion_causa_raiz
    into v_empresa, v_causa
    from public.no_conformidades
   where id = p_no_conformidad_id;

  if v_empresa is null then
    raise exception 'La no conformidad no existe.' using errcode = 'P0002';
  end if;

  -- La funcion ignora RLS, asi que el limite de empresa se controla aca.
  if not public.misma_empresa(v_empresa) then
    raise exception 'La no conformidad es de otra empresa del grupo.' using errcode = '42501';
  end if;

  if not exists (
    select 1
      from public.nc_acciones a
     where a.no_conformidad_id = p_no_conformidad_id
       and a.descargo is not null
       and length(btrim(a.descargo)) > 0
  ) then
    raise exception
      'Para cerrar la no conformidad hace falta la accion correctiva con su descargo.'
      using errcode = '23514';
  end if;

  if v_causa is null or length(btrim(v_causa)) = 0 then
    raise exception
      'Declare la causa raiz: sin ella la accion correctiva no tiene contra que medirse.'
      using errcode = '23514';
  end if;

  -- La accion NO se toca: queda abierta, que es lo que se controla.
  update public.no_conformidades
     set estado = 'cerrada'
   where id = p_no_conformidad_id
     and estado <> 'cerrada';
end;
$$;

comment on function public.cerrar_no_conformidad_por_respuesta(uuid) is
  'Cierre por respuesta. Hoy no la llama nada: el cierre en uso es cerrarNoConformidad(). '
  'Exige la accion correctiva con descargo y la causa raiz declarada; los cinco porques '
  'salieron el 4 de noviembre a pedido de Calidad.';
