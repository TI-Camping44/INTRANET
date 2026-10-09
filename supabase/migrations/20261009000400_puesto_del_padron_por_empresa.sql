-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- El puesto del padron se elige por empresa, no al azar
-- =====================================================================
-- EL MISMO CARGO EXISTE EN LAS DOS EMPRESAS DEL GRUPO. «Asesor Comercial
-- Consumidor Final» esta cargado una vez con `empresa_del_puesto_id` de
-- Camping 44 y otra con el de Vitalica. Parecian dos registros repetidos
-- y no lo son: es el mismo puesto en cada empresa, que es justamente
-- como el proyecto modela al grupo.
--
-- La busqueda del puesto en el primer ingreso comparaba solo por nombre
-- y cerraba con `limit 1`, asi que elegia cualquiera de los dos. Con
-- ocho personas apuntando a ese cargo, era cuestion de tiempo que
-- alguien de Camping 44 quedara colgado del perfil de Vitalica —y de ahi
-- salen despues las competencias que se le exigen.
--
-- Ahora desempata con `personas_nomina.empresa_del_puesto`, que es lo
-- que la exportacion de Odoo dice de cada persona. Si no hay version
-- para su empresa, toma la que haya: es mejor un puesto que ninguno.
--
-- De paso exige `activo`: un puesto retirado no se le asigna a nadie.
--
-- Al aplicar esto, las 55 personas del padron resuelven puesto.
--
-- Nota: «Asistente Comercial» no estaba en la lista de Calidad y el
-- cargo existe, asi que se creo con el perfil vacio para que Calidad lo
-- complete. Como el resto de los datos del padron, se cargo contra la
-- base y no se versiona aca.
-- =====================================================================

create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa_id uuid;
  v_nombre text;
  v_correo text;
  v_ficha public.personas_nomina%rowtype;
  v_puesto_id uuid;
begin
  if new.email is null
     or lower(split_part(new.email, '@', 2))
        not in ('camping44.com.py', 'vitalica.com.py') then
    raise exception 'Dominio de correo no autorizado: %', coalesce(new.email, '(sin correo)')
      using errcode = '42501';
  end if;

  v_correo := lower(new.email);

  -- Empresa por defecto del sistema: Camping 44 S.A. Es el inquilino,
  -- no la empresa de la que habla el registro.
  select id into v_empresa_id
    from public.empresas
   where activa
   order by creado_en
   limit 1;

  if v_empresa_id is null then
    raise exception 'No hay ninguna empresa registrada. Ejecute el seed inicial.';
  end if;

  select * into v_ficha
    from public.personas_nomina
   where empresa_id = v_empresa_id
     and correo = v_correo
     and activo
   limit 1;

  -- El nombre del padron gana sobre el de Google: es el de la nomina, y
  -- es el que despues tiene que coincidir con los papeles.
  v_nombre := coalesce(
    nullif(v_ficha.nombre_completo, ''),
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(new.email, '@', 1)
  );

  if v_ficha.puesto_nombre is not null then
    select q.id into v_puesto_id
      from public.puestos q
      left join public.empresas e on e.id = q.empresa_del_puesto_id
     where q.empresa_id = v_empresa_id
       and q.activo
       and lower(public.unaccent(q.nombre)) = lower(public.unaccent(v_ficha.puesto_nombre))
     order by
       -- Primero el del grupo que corresponde; si no hay, cualquiera.
       ((coalesce(v_ficha.empresa_del_puesto, '') ilike 'VITALICA%')
        = (coalesce(e.nombre, '') ilike 'Vitalica%')) desc,
       q.creado_en
     limit 1;
  end if;

  insert into public.usuarios (
    id, empresa_id, correo, nombre_completo, rol, url_avatar,
    puesto_id, telefono, fecha_ingreso
  )
  values (
    new.id,
    v_empresa_id,
    v_correo,
    v_nombre,
    'colaborador',                      -- el Administrador SGC ajusta el rol
    new.raw_user_meta_data ->> 'avatar_url',
    v_puesto_id,
    nullif(v_ficha.telefono, ''),
    v_ficha.fecha_ingreso
  )
  on conflict (id) do update
    set nombre_completo = excluded.nombre_completo,
        url_avatar = coalesce(excluded.url_avatar, public.usuarios.url_avatar),
        puesto_id = coalesce(public.usuarios.puesto_id, excluded.puesto_id),
        telefono = coalesce(public.usuarios.telefono, excluded.telefono),
        fecha_ingreso = coalesce(public.usuarios.fecha_ingreso, excluded.fecha_ingreso),
        ultimo_ingreso = now();

  if v_ficha.id is not null then
    update public.personas_nomina
       set usuario_id = new.id
     where id = v_ficha.id;
  end if;

  return new;
end;
$$;
