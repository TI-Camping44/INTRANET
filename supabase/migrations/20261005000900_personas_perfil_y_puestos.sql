-- ---------------------------------------------------------------------
-- Personas: el nombre en dos campos, el cumpleaños y el puesto sin codigo
--
-- Lo pidio Direccion el 5 de octubre, al partir el modulo Personas en
-- dos submodulos: «Perfil de Resultados de Puesto» y «Formacion y
-- Competencia».
--
-- 1 · NOMBRES Y APELLIDOS POR SEPARADO. Hasta ahora habia un solo campo,
--     `nombre_completo`, que se llenaba con lo que Google devuelve en el
--     primer ingreso. Calidad necesita los dos por separado: el legajo y
--     el perfil de puesto se ordenan por apellido.
--
--     `nombre_completo` NO SE RETIRA. Lo usa media aplicacion —el
--     directorio, las notificaciones, cada listado con un responsable— y
--     los perfiles ya cargados solo lo tienen a el. Queda como el campo
--     que se muestra, y un disparador lo arma a partir de los dos nuevos
--     cuando estan, para que no puedan contradecirse.
--
-- 2 · LA FECHA DE NACIMIENTO ya existia y estaba vacia: nadie la cargaba
--     porque no se pedia en ningun lado. Ahora se pide en el primer
--     ingreso y alimenta los cumpleaños del mes de la portada.
--
-- 3 · EL PUESTO YA NO LLEVA CODIGO. Los codigos P-101 en adelante los
--     definio el proyecto, no Calidad, y quedaron sin confirmar desde
--     entonces. Direccion pidio sacar el campo del formulario: la
--     columna queda —los diecisiete puestos cargados tienen el suyo— pero
--     deja de ser obligatoria. El indice unico sigue sirviendo: en
--     PostgreSQL varios nulos no chocan entre si.
-- ---------------------------------------------------------------------

alter table public.usuarios
  add column if not exists nombres text,
  add column if not exists apellidos text;

comment on column public.usuarios.nombres is
  'Nombres de pila, separados del apellido. Se piden en el primer ingreso.';
comment on column public.usuarios.apellidos is
  'Apellidos. El legajo y el perfil de puesto se ordenan por este campo.';

-- `nombre_completo` se arma de los dos cuando los dos estan. Asi no
-- pueden contradecirse: un perfil que diga «Juan Perez» en un campo y
-- «Juan Carlos» en otro es un perfil en el que no se puede confiar.
create or replace function public.armar_nombre_completo()
returns trigger
language plpgsql
as $fn$
begin
  if new.nombres is not null and new.apellidos is not null
     and btrim(new.nombres) <> '' and btrim(new.apellidos) <> '' then
    new.nombre_completo := btrim(new.nombres) || ' ' || btrim(new.apellidos);
  end if;
  return new;
end;
$fn$;

comment on function public.armar_nombre_completo() is
  'Mantiene `nombre_completo` a partir de `nombres` y `apellidos`. No lo pisa '
  'cuando alguno falta: los perfiles viejos solo tienen el completo.';

drop trigger if exists usuarios_armar_nombre on public.usuarios;
create trigger usuarios_armar_nombre
  before insert or update of nombres, apellidos on public.usuarios
  for each row execute function public.armar_nombre_completo();

-- El puesto sin codigo obligatorio.
alter table public.puestos alter column codigo drop not null;

comment on column public.puestos.codigo is
  'Opcional. Los codigos P-101 en adelante los definio el proyecto y nunca los '
  'confirmo Calidad: el formulario dejo de pedirlos el 5 de octubre de 2026. '
  'Los puestos ya cargados conservan el suyo.';

-- ---------------------------------------------------------------------
-- 4 · Que nadie se ascienda a si mismo
--
-- `usuarios_actualiza_propio` permite a cada persona escribir su propia
-- fila, y es necesaria: el perfil del primer ingreso, el telefono y el
-- avatar los carga uno mismo. Pero la politica no distingue columnas, y
-- `authenticated` tiene `update` sobre todas: hasta hoy cualquiera podia
-- hacer, contra la API y sin pasar por la interfaz,
--
--   update usuarios set rol = 'administrador_sgc' where id = auth.uid();
--
-- y quedar de Administrador SGC. Lo mismo con `activo`, `puesto_id` o
-- `empresa_id`, que saltaria el aislamiento entre empresas.
--
-- La correccion va en un disparador y no en la politica porque RLS
-- decide sobre la fila, no sobre la columna. Deja pasar:
--   · al Administrador SGC, que para eso tiene su politica;
--   · a los trabajos del servidor, que corren sin `auth.uid()`.
--
-- Al resto le permite escribir solo lo suyo: nombres, apellidos, fecha
-- de nacimiento, telefono y avatar. El puesto lo asigna Calidad.
-- ---------------------------------------------------------------------

create or replace function public.proteger_campos_del_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  -- Sin `auth.uid()` es un trabajo del servidor o la consola: pasa.
  if auth.uid() is null then return new; end if;

  -- El Administrador SGC administra: para eso esta.
  if public.es_admin_sgc() then return new; end if;

  -- Sobre la fila de otro no decide este disparador: eso ya lo corta
  -- RLS. Acá solo importa la propia.
  if new.id <> auth.uid() then return new; end if;

  if new.rol is distinct from old.rol
     or new.activo is distinct from old.activo
     or new.empresa_id is distinct from old.empresa_id
     or new.correo is distinct from old.correo
     or new.puesto_id is distinct from old.puesto_id
     or new.proceso_id is distinct from old.proceso_id
     or new.superior_id is distinct from old.superior_id then
    raise exception
      'El rol, el estado, la empresa, el correo, el puesto, el proceso y el líder '
      'inmediato los asigna el Administrador SGC: no se pueden cambiar desde el '
      'propio perfil.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$fn$;

drop trigger if exists usuarios_proteger_perfil on public.usuarios;
create trigger usuarios_proteger_perfil
  before update on public.usuarios
  for each row execute function public.proteger_campos_del_perfil();
