-- ---------------------------------------------------------------------
-- Los permisos pasan a ser configurables, en vez de estar escritos
--
-- HASTA HOY LOS ROLES CASI NO SE DISTINGUIAN EN LECTURA. Se midio el 12
-- de octubre con un usuario de cada rol contra las politicas reales: un
-- Colaborador veia las mismas filas que el Administrador SGC en
-- riesgos, no conformidades, auditorias, objetivos, proveedores,
-- activos, competencias y puestos. Lo unico realmente separado era la
-- escritura, mas la bitacora y el padron. Y el menu tampoco lo tapaba:
-- de 61 entradas, solo 5 declaraban rol, todas de Configuraciones.
--
-- Ocultar la entrada del menu nunca fue el control: escribiendo la
-- direccion a mano se entraba igual. Asi que el permiso se guarda en
-- una tabla, lo aplican las politicas RLS y el menu sale de la MISMA
-- tabla, para que lo que se ve y lo que se puede leer no se separen.
--
-- Esta migracion trae la tabla, las dos funciones y los valores
-- iniciales. Las politicas que las usan van en la siguiente: asi, si
-- hay que volver atras, se revierte el corte sin perder la matriz que
-- Calidad haya cargado.
-- ---------------------------------------------------------------------

create table if not exists public.permisos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  rol public.rol_usuario not null,
  modulo text not null,
  ver boolean not null default false,
  editar boolean not null default false,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Las dos restricciones van fuera del `create table` a proposito: con
-- `if not exists`, una tabla que ya existe salta el bloque entero y la
-- restriccion nunca se aplicaria. Asi agregar un modulo es cambiar esta
-- lista en una migracion nueva.
--
-- Las mismas claves que `CLAVES_MODULO` en `lib/permisos.ts`. Si se
-- agrega un modulo, se agrega en los dos lados.
alter table public.permisos drop constraint if exists permisos_modulo_valido;
alter table public.permisos add constraint permisos_modulo_valido check (modulo in (
  'inicio', 'directorio', 'aplicaciones', 'mis_ventas',
  'panel', 'documentos', 'riesgos', 'objetivos', 'auditorias', 'cambios',
  'no_conformidades', 'acciones', 'reclamos', 'satisfaccion', 'activos',
  'personas', 'proveedores',
  'usuarios', 'padron', 'ingresos', 'bitacora'
));

-- Editar sin ver no significa nada: la pantalla a la que se entraria
-- esta cerrada. Se evita que la matriz pueda quedar en ese estado.
alter table public.permisos drop constraint if exists permisos_editar_exige_ver;
alter table public.permisos add constraint permisos_editar_exige_ver check (not editar or ver);

create unique index if not exists permisos_rol_modulo
  on public.permisos (empresa_id, rol, modulo);

comment on table public.permisos is
  'Que ve y que edita cada rol, modulo por modulo. Lo lee la base en '
  'puede_ver() y puede_editar(), y el menu de la aplicacion.';

comment on column public.permisos.editar is
  'Incluye crear, modificar y dar de baja. Exige ver.';

drop trigger if exists permisos_actualizacion on public.permisos;
create trigger permisos_actualizacion
  before update on public.permisos
  for each row execute function public.marcar_actualizacion();

-- QUIEN TOCO LOS PERMISOS Y CUANDO ES DATO DE AUDITORIA, y de los mas
-- sensibles: es el registro de quien se dio acceso a que.
drop trigger if exists bitacora_permisos on public.permisos;
create trigger bitacora_permisos
  after insert or update or delete on public.permisos
  for each row execute function public.registrar_bitacora();

-- ---------------------------------------------------------------------
-- RLS. La tabla esta fuera del bucle de `..._politicas_rls.sql`, asi
-- que necesita su grant explicito: sin el, PostgreSQL corta antes de
-- evaluar las politicas y la pantalla queda vacia sin decir por que.
-- ---------------------------------------------------------------------

alter table public.permisos enable row level security;
revoke all on public.permisos from anon;
grant select, insert, update, delete on public.permisos to authenticated;

-- LA LECTURA ES PARA CUALQUIERA DE LA EMPRESA, a proposito: el menu de
-- cada persona se arma leyendo esta tabla. Saber que un rol tiene
-- acceso a un modulo no da acceso a nada.
drop policy if exists permisos_lectura on public.permisos;
create policy permisos_lectura on public.permisos
  for select to authenticated
  using (public.misma_empresa(empresa_id));

-- La escritura, solo el Administrador SGC. Y no se usa puede_ver() ni
-- puede_editar() aca: la tabla que decide los permisos no puede
-- depender de si misma para saber quien la edita.
drop policy if exists permisos_administracion on public.permisos;
create policy permisos_administracion on public.permisos
  for all to authenticated
  using (public.es_admin_sgc() and public.misma_empresa(empresa_id))
  with check (public.es_admin_sgc() and public.misma_empresa(empresa_id));

-- ---------------------------------------------------------------------
-- Las dos funciones que van a consultar las politicas
--
-- SECURITY DEFINER y `search_path = public`, como el resto: una
-- politica que consulta `permisos` dentro de la politica de `permisos`
-- provocaria la recursion de siempre.
--
-- STABLE, y es necesario por el costo: las politicas las llaman con una
-- constante, asi que PostgreSQL las evalua una vez por consulta y no
-- una vez por fila.
-- ---------------------------------------------------------------------

create or replace function public.puede_ver(p_modulo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  -- EL PISO DEL ADMINISTRADOR SGC. Se corta antes de mirar la tabla:
  -- una matriz configurable permite dejar al sistema sin nadie capaz de
  -- entrar a arreglarla, y de este modo su fila no se consulta nunca.
  select case
    when public.rol_actual() = 'administrador_sgc' then true
    else exists (
      select 1 from public.permisos p
      where p.rol = public.rol_actual()
        and p.modulo = p_modulo
        and p.empresa_id = public.empresa_actual()
        and p.ver
    )
  end
$$;

create or replace function public.puede_editar(p_modulo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.rol_actual() = 'administrador_sgc' then true
    else exists (
      select 1 from public.permisos p
      where p.rol = public.rol_actual()
        and p.modulo = p_modulo
        and p.empresa_id = public.empresa_actual()
        and p.editar
    )
  end
$$;

comment on function public.puede_ver(text) is
  'Si el rol de quien consulta puede leer el modulo. El Administrador '
  'SGC siempre puede: su fila no se mira.';

comment on function public.puede_editar(text) is
  'Si el rol de quien consulta puede crear, modificar o dar de baja en '
  'el modulo. El Administrador SGC siempre puede.';

grant execute on function public.puede_ver(text) to authenticated;
grant execute on function public.puede_editar(text) to authenticated;

-- ---------------------------------------------------------------------
-- Valores iniciales
--
-- Reproducen lo que ya decian las descripciones de rol del sistema, con
-- una sola decision nueva: EL COLABORADOR DEJA DE VER lo que no usa
-- —riesgos, auditorias, objetivos, cambios, asociados de negocio y el
-- panel de calidad—. Hoy los ve, y es el agujero que se viene a cerrar.
--
-- Son valores iniciales, no reglas: Calidad los corrige desde
-- Configuraciones sin tocar codigo. Por eso van con `on conflict do
-- nothing`, para que volver a correr la migracion no pise lo que se
-- haya ajustado despues.
--
-- El Administrador SGC NO SE CARGA: su piso esta en las funciones.
-- ---------------------------------------------------------------------

do $carga$
declare
  v_empresa uuid;
  v_rol public.rol_usuario;
  v_modulo text;
  v_ver boolean;
  v_editar boolean;
begin
  for v_empresa in select id from public.empresas loop
    foreach v_modulo in array array[
      'inicio', 'directorio', 'aplicaciones', 'mis_ventas',
      'panel', 'documentos', 'riesgos', 'objetivos', 'auditorias', 'cambios',
      'no_conformidades', 'acciones', 'reclamos', 'satisfaccion', 'activos',
      'personas', 'proveedores',
      'usuarios', 'padron', 'ingresos', 'bitacora'
    ] loop
      foreach v_rol in array array[
        'direccion', 'responsable_proceso', 'auditor', 'colaborador'
      ]::public.rol_usuario[] loop

        v_ver := false;
        v_editar := false;

        case v_rol

          -- DIRECCION VE TODO Y NO EDITA NADA. La unica excepcion es el
          -- organigrama, y es deliberada: la linea de reporte la conoce
          -- Direccion. El permiso fino sigue en mover_en_organigrama().
          --
          -- Menos el padron y los usuarios, que quedan como ya estaban:
          -- en el padron estan la cedula y el telefono de las 55
          -- personas, y por eso `personas_nomina` es del Administrador
          -- SGC desde que se cargo. Esto no lo cambia.
          when 'direccion' then
            v_ver := v_modulo not in ('usuarios', 'padron');
            v_editar := (v_modulo = 'directorio');

          -- EL AUDITOR LEE TODO EL SGC y edita unicamente auditorias.
          -- La bitacora y los ingresos los ve: son su herramienta de
          -- trabajo, y es lo que el menu ya le ofrecia.
          when 'auditor' then
            v_ver := v_modulo not in ('usuarios', 'padron', 'mis_ventas');
            v_editar := (v_modulo = 'auditorias');

          -- EL RESPONSABLE DE PROCESO lee todo el SGC y edita lo
          -- operativo. Que filas le tocan de cada modulo lo sigue
          -- decidiendo la politica, con es_responsable_de_proceso().
          when 'responsable_proceso' then
            v_ver := v_modulo not in ('usuarios', 'padron', 'ingresos', 'bitacora');
            v_editar := v_modulo in (
              'inicio', 'documentos', 'riesgos', 'objetivos', 'cambios',
              'no_conformidades', 'acciones', 'reclamos', 'satisfaccion',
              'activos', 'personas', 'proveedores'
            );

          -- EL COLABORADOR: la intranet entera, la documentacion
          -- vigente, y levantar reclamos y no conformidades. Es lo que
          -- cambia respecto de hoy.
          when 'colaborador' then
            v_ver := v_modulo in (
              'inicio', 'directorio', 'aplicaciones', 'mis_ventas',
              'documentos', 'no_conformidades', 'acciones', 'reclamos'
            );
            v_editar := v_modulo in ('no_conformidades', 'acciones', 'reclamos');

          else
            null;
        end case;

        insert into public.permisos (empresa_id, rol, modulo, ver, editar)
        values (v_empresa, v_rol, v_modulo, v_ver, v_editar)
        on conflict (empresa_id, rol, modulo) do nothing;

      end loop;
    end loop;
  end loop;
end
$carga$;
