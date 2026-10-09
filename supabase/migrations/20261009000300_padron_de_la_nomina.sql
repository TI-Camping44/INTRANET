-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- Padron de la nomina, para que el perfil llegue armado al primer ingreso
-- =====================================================================
-- EL PERFIL NO SE PUEDE PRECARGAR. `usuarios.id` es clave foranea de
-- `auth.users(id)`, y esa fila recien existe cuando la persona entra por
-- primera vez con Google. Insertar el perfil antes es imposible.
--
-- La salida es la misma que ya se uso con Sofidya: guardar la nomina
-- aparte y vincularla por correo cuando la persona ingresa. Al primer
-- ingreso el perfil deja de nacer vacio —hoy nace con el nombre de
-- Google y nada mas— y llega con su puesto, su telefono y su fecha de
-- ingreso ya puestos.
--
-- DE DONDE SALE. De la exportacion de `hr.employee` de Odoo. Es una
-- copia, no la fuente: Odoo sigue siendo donde se da de alta a la gente.
-- Si alguien cambia de puesto alla, se vuelve a cargar el padron.
--
-- QUE NO ENTRA. Solo las direcciones de los dos dominios del Workspace.
-- Direccion decidio el 9 de octubre que las cuentas de gmail, la de
-- sati.com.py y quien no tiene correo quedan fuera: sin cuenta del
-- Workspace no hay ingreso, y un padron con gente que nunca va a poder
-- entrar solo ensucia la cuenta de pendientes.
--
-- LOS DATOS NO VIVEN EN ESTE ARCHIVO. El repositorio es publico: los
-- nombres, telefonos y fechas de ingreso de 57 personas no se versionan.
-- Esta migracion crea la estructura; las filas se cargan contra la base
-- con el conector de Supabase y se vuelven a cargar igual cuando Odoo
-- cambie.
-- =====================================================================

create table public.personas_nomina (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,

  -- La clave de union. Es el correo con el que la persona entra con
  -- Google; por eso es unico y se guarda siempre en minusculas.
  correo text not null,

  nombre_completo text not null,

  -- La cedula, de «Numero de identificacion» en Odoo. Se guarda solo con
  -- digitos para que no dependa de si vino con puntos. Es la clave que
  -- distingue a dos personas con el mismo nombre, y la que deduplico los
  -- 8 legajos repetidos del export.
  cedula text,

  puesto_nombre text,
  departamento text,

  -- El lider inmediato, como lo escribe Odoo. Se guarda el NOMBRE y no
  -- una referencia: cuando se carga el padron, el jefe todavia puede no
  -- tener usuario. Lo resuelve `vincular_lideres_de_nomina()` cuando ya
  -- existan los dos.
  gerente_nombre text,

  -- De que empresa del grupo es el puesto. NO es `empresa_id`, que es el
  -- inquilino y siempre vale Camping 44.
  empresa_del_puesto text,

  telefono text,
  fecha_ingreso date,
  activo boolean not null default true,

  -- Se completa cuando la persona ingresa por primera vez.
  usuario_id uuid references public.usuarios (id) on delete set null,

  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint personas_nomina_correo_minusculas check (correo = lower(correo))
);

create unique index personas_nomina_correo_unico
  on public.personas_nomina (empresa_id, correo);

create index personas_nomina_usuario_idx on public.personas_nomina (usuario_id);
create index personas_nomina_cedula_idx on public.personas_nomina (empresa_id, cedula);

comment on table public.personas_nomina is
  'Nomina exportada de Odoo, a la espera del primer ingreso de cada persona.';
comment on column public.personas_nomina.gerente_nombre is
  'Lider inmediato tal como figura en Odoo; se resuelve a usuarios.superior_id despues.';

create trigger personas_nomina_actualizacion
  before update on public.personas_nomina
  for each row execute function public.marcar_actualizacion();

create trigger bitacora_personas_nomina
  after insert or update or delete on public.personas_nomina
  for each row execute function public.registrar_bitacora();

-- ---------------------------------------------------------------------
-- RLS. Y su `grant`: sin el, PostgreSQL corta antes de evaluar las
-- politicas y la pantalla queda vacia sin decir por que.
-- ---------------------------------------------------------------------
alter table public.personas_nomina enable row level security;

grant select, insert, update, delete on public.personas_nomina to authenticated;

-- El padron tiene telefonos y fechas de ingreso de todo el personal: lo
-- ve y lo administra solo quien ya administra usuarios.
create policy personas_nomina_lectura on public.personas_nomina
  for select using (public.misma_empresa(empresa_id) and public.es_admin_sgc());

create policy personas_nomina_gestion on public.personas_nomina
  for all
  using (public.misma_empresa(empresa_id) and public.es_admin_sgc())
  with check (public.misma_empresa(empresa_id) and public.es_admin_sgc());

-- ---------------------------------------------------------------------
-- El primer ingreso, ahora con el padron.
--
-- Si la persona esta en la nomina, el perfil nace con su puesto, su
-- telefono y su fecha de ingreso. Si no esta, nace como hasta ahora: no
-- se le niega el ingreso a nadie por no figurar en una exportacion.
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

  -- El puesto, si el nombre coincide con uno de los cargados. Sin tildes
  -- ni mayusculas de por medio: la exportacion de Odoo y la planilla de
  -- perfiles no siempre los escriben igual.
  if v_ficha.puesto_nombre is not null then
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

-- ---------------------------------------------------------------------
-- La linea de reporte, cuando ya existan los dos.
--
-- Se resuelve aparte y no en el alta porque el jefe puede entrar al
-- sistema DESPUES que su gente. Es idempotente: se puede correr cuantas
-- veces haga falta, y solo completa lo que todavia esta vacio para no
-- pisar un superior puesto a mano por el Administrador SGC.
-- ---------------------------------------------------------------------
create or replace function public.vincular_lideres_de_nomina()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vinculados integer;
begin
  if not public.es_admin_sgc() then
    raise exception 'Solo el Administrador SGC puede vincular la línea de reporte'
      using errcode = '42501';
  end if;

  with pares as (
    select
      persona.usuario_id as usuario_id,
      (
        select jefe.usuario_id
          from public.personas_nomina jefe
         where jefe.empresa_id = persona.empresa_id
           and jefe.usuario_id is not null
           and lower(public.unaccent(jefe.nombre_completo))
               = lower(public.unaccent(persona.gerente_nombre))
         limit 1
      ) as jefe_id
    from public.personas_nomina persona
    where persona.usuario_id is not null
      and persona.gerente_nombre is not null
  )
  update public.usuarios u
     set superior_id = pares.jefe_id
    from pares
   where u.id = pares.usuario_id
     and pares.jefe_id is not null
     and pares.jefe_id <> u.id          -- nadie es su propio líder
     and u.superior_id is null;

  get diagnostics v_vinculados = row_count;
  return v_vinculados;
end;
$$;

comment on function public.vincular_lideres_de_nomina() is
  'Completa usuarios.superior_id desde el padron, para quienes ya ingresaron.';
