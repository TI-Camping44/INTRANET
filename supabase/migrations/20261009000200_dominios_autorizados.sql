-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- Admitir tambien el dominio de Vitalica
-- =====================================================================
-- Las dos funciones que validan el dominio tenian 'camping44.com.py'
-- escrito a mano y rechazaban cualquier otra cosa. Eso dejaba sin poder
-- entrar a la gente de Vitalica que usa una direccion @vitalica.com.py.
--
-- POR QUE SE ABRE. `vitalica.com.py` es un dominio SECUNDARIO del mismo
-- Google Workspace de Camping 44, no una organizacion aparte: las
-- cuentas las crea y las da de baja la misma gente, con la misma
-- politica. No es abrir el sistema a un tercero.
--
-- La decision la tomo Direccion el 9 de octubre, y corrige el supuesto
-- que el proyecto traia desde el principio —«no hay ni va a haber
-- usuarios de Vitalica»—, que la exportacion de Odoo demostro falso:
-- de los 11 empleados de Vitalica, 7 ya tienen direccion
-- @camping44.com.py y 2 tienen @vitalica.com.py.
--
-- QUE NO CAMBIA: la empresa del perfil. `usuarios.empresa_id` sigue
-- siendo Camping 44 para todos, porque esa columna es el predicado de
-- `misma_empresa()` —a que inquilino pertenece el registro—, no «de que
-- empresa del grupo habla». Si a la gente de Vitalica se le pusiera
-- Vitalica ahi, RLS la dejaria sin ver absolutamente nada. De que
-- empresa es cada registro lo siguen diciendo las columnas propias:
-- `no_conformidades.empresa_afectada_id`, `puestos.empresa_del_puesto_id`
-- y las demas.
--
-- La lista vive en tres lugares y los tres tienen que coincidir:
-- `lib/constantes.ts`, `lib/supabase/middleware.ts` y este archivo.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Alta automatica del perfil en el primer ingreso con Google.
-- ---------------------------------------------------------------------
create or replace function public.crear_perfil_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_empresa_id uuid;
  v_nombre text;
begin
  if new.email is null
     or lower(split_part(new.email, '@', 2))
        not in ('camping44.com.py', 'vitalica.com.py') then
    raise exception 'Dominio de correo no autorizado: %', coalesce(new.email, '(sin correo)')
      using errcode = '42501';
  end if;

  -- Empresa por defecto del sistema: Camping 44 S.A. Es el inquilino,
  -- no la empresa de la que habla el registro. Vale para todos, sea cual
  -- sea el dominio de su correo.
  select id into v_empresa_id
    from public.empresas
   where activa
   order by creado_en
   limit 1;

  if v_empresa_id is null then
    raise exception 'No hay ninguna empresa registrada. Ejecute el seed inicial.';
  end if;

  v_nombre := coalesce(
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'name', ''),
    split_part(new.email, '@', 1)
  );

  insert into public.usuarios (id, empresa_id, correo, nombre_completo, rol, url_avatar)
  values (
    new.id,
    v_empresa_id,
    lower(new.email),
    v_nombre,
    'colaborador',                      -- el Administrador SGC ajusta el rol
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set nombre_completo = excluded.nombre_completo,
        url_avatar = coalesce(excluded.url_avatar, public.usuarios.url_avatar),
        ultimo_ingreso = now();

  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Refuerzo en la tabla de perfiles: tampoco admite otro dominio.
-- ---------------------------------------------------------------------
create or replace function public.validar_dominio_usuario()
returns trigger
language plpgsql
as $$
begin
  if lower(split_part(new.correo, '@', 2))
     not in ('camping44.com.py', 'vitalica.com.py') then
    raise exception 'Solo se admiten cuentas de camping44.com.py o vitalica.com.py'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function public.validar_dominio_usuario() is
  'Rechaza perfiles fuera de los dominios del Workspace de Camping 44.';
