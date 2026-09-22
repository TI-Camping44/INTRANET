-- ---------------------------------------------------------------------
-- Cerrar la no conformidad al responderla, sin ensanchar la edicion
--
-- La migracion anterior dejo que cualquiera cargue la accion correctiva y
-- el analisis de una desviacion que no es suya. Pero cerrar la no
-- conformidad es un `update` sobre `no_conformidades`, y esa politica
-- —`no_conformidades_edicion`— solo la permite a Calidad, al responsable,
-- a quien la detecto y al responsable del proceso. Para todos los demas
-- el update no falla: no alcanza ninguna fila y el cierre no ocurre en
-- silencio, que es peor que un error.
--
-- La salida no es abrir la edicion de la tabla —eso dejaria a cualquiera
-- cambiar severidad, area o responsable de cualquier desviacion— sino una
-- funcion acotada que hace exactamente una cosa: cerrar, y solo si estan
-- el descargo y los cinco porques. Es el criterio de siempre: cuando hace
-- falta pasar por encima de RLS, se hace en una funcion de la base con un
-- alcance escrito, no con la clave de servicio desde la interfaz.
--
-- El disparador `controlar_cierre_nc()` se conserva: esta funcion es el
-- camino normal, y el disparador es el que cuida cualquier otro.
-- ---------------------------------------------------------------------

create or replace function public.cerrar_no_conformidad_por_respuesta(p_no_conformidad_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa uuid;
begin
  if public.es_direccion() then
    raise exception 'Su perfil es de solo lectura.' using errcode = '42501';
  end if;

  select empresa_id into v_empresa
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

  if (
    select count(*) from public.nc_porques p where p.no_conformidad_id = p_no_conformidad_id
  ) < 5 then
    raise exception
      'Complete los cinco porques: la cadena tiene que llegar hasta la causa raiz.'
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
  'Cierra la no conformidad cuando fue respondida: exige descargo en alguna accion y los '
  'cinco porques. Deja la accion correctiva abierta. Existe para no ensanchar '
  'no_conformidades_edicion, que seguiria acotada a Calidad y a los responsables.';

revoke all on function public.cerrar_no_conformidad_por_respuesta(uuid) from public;
grant execute on function public.cerrar_no_conformidad_por_respuesta(uuid) to authenticated;
