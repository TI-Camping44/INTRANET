-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 012 · Funciones de apoyo para las politicas RLS
-- =====================================================================
-- Todas son SECURITY DEFINER para poder consultar "usuarios" sin quedar
-- atrapadas en la propia politica de esa tabla (recursion infinita).

create or replace function public.rol_actual()
returns rol_usuario
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.usuarios where id = auth.uid() and activo;
$$;

create or replace function public.empresa_actual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select empresa_id from public.usuarios where id = auth.uid() and activo;
$$;

create or replace function public.es_admin_sgc()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.rol_actual() = 'administrador_sgc', false);
$$;

create or replace function public.es_auditor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.rol_actual() = 'auditor', false);
$$;

create or replace function public.es_direccion()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.rol_actual() = 'direccion', false);
$$;

-- Puede escribir sobre el sistema: Calidad y los responsables de proceso.
create or replace function public.puede_gestionar()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.rol_actual() in ('administrador_sgc', 'responsable_proceso'), false);
$$;

-- Verifica si el usuario actual es responsable del proceso indicado.
create or replace function public.es_responsable_de_proceso(p_proceso_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.procesos
     where id = p_proceso_id
       and responsable_id = auth.uid()
  );
$$;

-- Pertenencia a la misma empresa que el registro consultado.
create or replace function public.misma_empresa(p_empresa_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_empresa_id = public.empresa_actual();
$$;

-- ---------------------------------------------------------------------
-- Alta automatica del perfil en el primer ingreso con Google.
-- Valida el dominio del lado del servidor: aunque alguien evada la
-- interfaz, la base rechaza cualquier correo fuera de camping44.com.py.
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
  if new.email is null or lower(split_part(new.email, '@', 2)) <> 'camping44.com.py' then
    raise exception 'Dominio de correo no autorizado: %', coalesce(new.email, '(sin correo)')
      using errcode = '42501';
  end if;

  -- Empresa por defecto del sistema: Camping 44 S.A.
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

create trigger al_crear_usuario_auth
  after insert on auth.users
  for each row execute function public.crear_perfil_usuario();

-- Refuerzo adicional: la tabla de perfiles tampoco admite otro dominio.
create or replace function public.validar_dominio_usuario()
returns trigger
language plpgsql
as $$
begin
  if lower(split_part(new.correo, '@', 2)) <> 'camping44.com.py' then
    raise exception 'Solo se admiten cuentas del dominio camping44.com.py'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger usuarios_validar_dominio
  before insert or update of correo on public.usuarios
  for each row execute function public.validar_dominio_usuario();

-- ---------------------------------------------------------------------
-- Funciones de visibilidad del modulo de documentos.
--
-- Las politicas de "documentos" y de sus tablas hijas se necesitan
-- mutuamente. Si esa consulta cruzada se escribiera dentro de la propia
-- politica, PostgreSQL detectaria una recursion infinita. Al encapsularla
-- en funciones SECURITY DEFINER la evaluacion ocurre fuera de RLS y la
-- regla de negocio queda en un unico lugar.
-- ---------------------------------------------------------------------
create or replace function public.es_revisor_de_documento(p_documento_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.documento_versiones v
      join public.documento_revisores r on r.version_id = v.id
     where v.documento_id = p_documento_id
       and r.usuario_id = auth.uid()
  );
$$;

create or replace function public.puede_ver_documento(p_documento_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.documentos d
     where d.id = p_documento_id
       and d.empresa_id = public.empresa_actual()
       and (
         d.estado = 'vigente'
         or public.es_admin_sgc()
         or public.es_auditor()
         or public.es_direccion()
         or d.responsable_id = auth.uid()
         or d.elaborador_id = auth.uid()
         or d.aprobador_id = auth.uid()
         or d.creado_por = auth.uid()
         or public.es_responsable_de_proceso(d.proceso_id)
         or public.es_revisor_de_documento(d.id)
       )
  );
$$;

create or replace function public.puede_gestionar_documento(p_documento_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.documentos d
     where d.id = p_documento_id
       and d.empresa_id = public.empresa_actual()
       and (
         public.es_admin_sgc()
         or d.responsable_id = auth.uid()
         or d.elaborador_id = auth.uid()
         or public.es_responsable_de_proceso(d.proceso_id)
       )
  );
$$;

create or replace function public.documento_de_version(p_version_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select documento_id from public.documento_versiones where id = p_version_id;
$$;
