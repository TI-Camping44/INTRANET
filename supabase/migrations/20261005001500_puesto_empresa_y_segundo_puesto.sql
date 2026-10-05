-- ---------------------------------------------------------------------
-- El puesto declara a que empresa del grupo corresponde, y una persona
-- puede ocupar hasta dos puestos
--
-- Lo pidio Direccion el 5 de octubre.
--
-- 1 · LA EMPRESA DEL PUESTO NO VA EN `empresa_id`.
--
--     `empresa_id` es la llave de inquilino: RLS la usa en todas las
--     politicas por medio de `misma_empresa(empresa_id)`, que compara
--     contra `empresa_actual()`. Si un puesto se guardara con el id de
--     Vitalica, la politica `puestos_lectura` lo dejaria fuera y el
--     puesto desapareceria de la pantalla para todos —incluido quien lo
--     acaba de crear—; peor aun, el `with check` de
--     `puestos_administracion` rechazaria el alta de entrada.
--
--     Entonces se agrega una columna aparte, que es un DATO del puesto y
--     no un control de acceso. Es exactamente lo que ya se hizo en
--     `no_conformidades`: `empresa_id` para el inquilino,
--     `empresa_afectada_id` para la empresa del grupo a la que el
--     registro se refiere.
--
--     Los diecisiete puestos cargados quedan en Camping 44, que es la
--     unica que opera hoy.
--
-- 2 · HASTA DOS PUESTOS POR PERSONA, NI UNO MAS.
--
--     Se resuelve con una segunda columna y no con una tabla de union.
--     El tope de dos queda garantizado por la forma de la tabla: no hay
--     forma de escribir un tercero. Con una tabla de union el limite
--     habria que sostenerlo con un disparador que cuente filas, y
--     ademas habria que rehacer el directorio, el organigrama, los
--     listados y los contadores, que hoy leen `puesto_id` directo.
--
--     El segundo puesto no puede ser igual al primero ni existir sin el:
--     una persona sin puesto principal no tiene un «segundo» puesto,
--     tiene uno solo mal cargado.
-- ---------------------------------------------------------------------

alter table public.puestos
  add column if not exists empresa_del_puesto_id uuid references public.empresas (id);

comment on column public.puestos.empresa_del_puesto_id is
  'A que empresa del grupo corresponde el puesto: Camping 44 S.A. o Vitalica E.A.S. '
  'Es un dato del puesto, no un control de acceso: el inquilino lo sigue '
  'decidiendo `empresa_id`, que es la columna que mira RLS.';

-- Los ya cargados son de Camping 44: es la unica que opera.
update public.puestos
   set empresa_del_puesto_id = empresa_id
 where empresa_del_puesto_id is null;

create index if not exists puestos_empresa_del_puesto_idx
  on public.puestos (empresa_del_puesto_id);

-- ---------------------------------------------------------------------

alter table public.usuarios
  add column if not exists puesto_secundario_id uuid references public.puestos (id);

comment on column public.usuarios.puesto_secundario_id is
  'Segundo puesto de la persona, cuando ocupa dos. El tope de dos lo impone la '
  'forma de la tabla: no hay lugar para un tercero.';

alter table public.usuarios
  drop constraint if exists usuarios_segundo_puesto_valido;

alter table public.usuarios
  add constraint usuarios_segundo_puesto_valido check (
    puesto_secundario_id is null
    or (puesto_id is not null and puesto_secundario_id <> puesto_id)
  );

create index if not exists usuarios_puesto_secundario_idx
  on public.usuarios (puesto_secundario_id);

-- ---------------------------------------------------------------------
-- 3 · El segundo puesto se protege igual que el primero
--
-- `proteger_campos_del_perfil()` impide que una persona se asigne a si
-- misma el puesto contra la API. Sin agregar la columna nueva a esa
-- lista, el control quedaria con la puerta de al lado abierta: bastaria
-- escribir `puesto_secundario_id` para adjudicarse cualquier puesto.
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
  -- RLS. Aca solo importa la propia.
  if new.id <> auth.uid() then return new; end if;

  if new.rol is distinct from old.rol
     or new.activo is distinct from old.activo
     or new.empresa_id is distinct from old.empresa_id
     or new.correo is distinct from old.correo
     or new.puesto_id is distinct from old.puesto_id
     or new.puesto_secundario_id is distinct from old.puesto_secundario_id
     or new.proceso_id is distinct from old.proceso_id
     or new.superior_id is distinct from old.superior_id then
    raise exception
      'El rol, el estado, la empresa, el correo, los puestos, el proceso y el líder '
      'inmediato los asigna el Administrador SGC: no se pueden cambiar desde el '
      'propio perfil.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$fn$;
