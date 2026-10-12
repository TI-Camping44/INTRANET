-- El puesto del padron se puede corregir a mano
--
-- El padron sale de la exportacion de Odoo, y Odoo tiene cargos
-- desactualizados: gente que cambio de puesto y nadie lo actualizo en el
-- ERP. La regla era «se corrige en Odoo y se vuelve a cargar», y no
-- sirve: Calidad necesita el puesto correcto HOY, y actualizar Odoo no
-- esta en sus manos.
--
-- Es el mismo problema que la linea de reporte, y se resuelve igual: una
-- columna de ajuste a mano que la proxima carga del padron NO pisa.
--
-- HACEN FALTA DOS COLUMNAS, no una. `puesto_manual_fijado` distingue
-- «todavia nadie lo corrigio» de «se decidio que no tiene puesto
-- equivalente», que con un solo nulo se verian igual. Es la misma razon
-- por la que `lider_manual_fijado` existe.
--
-- GUARDA UN ID, NO UN TEXTO. El texto de Odoo ya vive en
-- `puesto_nombre`; lo que se corrige a mano es contra que cargo cargado
-- resuelve esa persona, y eso es una fila de `puestos`. Con texto libre
-- se volveria a caer en el problema que la correccion viene a resolver.
--
-- Precedencia, de mas fuerte a mas debil:
--   1. el ajuste a mano  2. `usuarios.puesto_id`  3. el cargo de Odoo
--
-- Para quien YA INGRESO el puesto se edita en su ficha y vive en
-- `usuarios.puesto_id`, que la carga del padron tampoco toca. El ajuste
-- de aca es para quien todavia no entro, y `crear_perfil_usuario()` lo
-- traslada a su perfil en el primer ingreso: sin eso, la correccion se
-- perderia justo el dia en que la persona entra.

alter table public.personas_nomina
  add column if not exists puesto_manual_id uuid
    references public.puestos (id) on delete set null,
  add column if not exists puesto_manual_fijado boolean not null default false;

comment on column public.personas_nomina.puesto_manual_id is
  'El cargo correcto, corregido a mano desde la intranet. Manda sobre el '
  'puesto_nombre que trae Odoo. La carga del padron no lo toca.';

comment on column public.personas_nomina.puesto_manual_fijado is
  'Distingue «nadie lo corrigio» de «se decidio que no tiene puesto».';

-- ---------------------------------------------------------------------
-- El alta del perfil respeta la correccion a mano.
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

  -- EL AJUSTE A MANO MANDA. Si alguien corrigio el cargo desde la
  -- intranet, el perfil nace con ese y no con el de Odoo: la correccion
  -- se hizo justamente porque el de Odoo esta desactualizado. Cuando la
  -- bandera esta puesta y el id es nulo, es una decision —«no tiene
  -- puesto equivalente»— y tambien se respeta.
  if v_ficha.puesto_manual_fijado then
    v_puesto_id := v_ficha.puesto_manual_id;

  -- Si nadie lo corrigio, el cargo de Odoo, si su nombre coincide con
  -- uno de los cargados. Sin tildes ni mayusculas de por medio: la
  -- exportacion y la planilla de perfiles no siempre los escriben igual.
  elsif v_ficha.puesto_nombre is not null then
    select p.id into v_puesto_id
      from public.puestos p
     where p.empresa_id = v_empresa_id
       and lower(public.unaccent(p.nombre)) = lower(public.unaccent(v_ficha.puesto_nombre))
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
