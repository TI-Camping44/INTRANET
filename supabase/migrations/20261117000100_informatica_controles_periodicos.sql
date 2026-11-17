-- ---------------------------------------------------------------------
-- Informática · Controles periódicos de TI
--
-- LA AUDITORÍA INTERNA DE NOVIEMBRE PIDIÓ UN CRONOGRAMA Y NO HABÍA DÓNDE
-- PONERLO. La NC-2026-022 dice: «Se solicita programar en el módulo de
-- TI de la Intranet el cronograma de controles que establece el
-- proceso», y la NC-2026-014 encontró que el checklist mensual del
-- MP-SOP-03 no tenía ni formulario ni programación que lo disparara.
-- Los dos procesos, el MP-SOP-03 y el MP-SOP-07, fijan controles con
-- frecuencia —mensual, trimestral, semestral, anual— y la intranet no
-- tenía ningún lugar para decir cuándo toca cada uno ni para dejar la
-- evidencia de que se hizo.
--
-- Son dos tablas:
--
--   controles_ti              qué se controla, cada cuánto, desde qué
--                             mes y quién responde.
--   control_ti_ejecuciones    cada vez que se hizo: el período que
--                             cubre, la fecha, el resultado y las
--                             observaciones. La evidencia va en
--                             `adjuntos` con
--                             `entidad = 'control_ti_ejecuciones'`, sin
--                             esquema nuevo.
--
-- EL CRONOGRAMA NO SE GUARDA, SE CALCULA: los períodos programados salen
-- de `primer_periodo` y `frecuencia_meses`. Guardar una fila por mes
-- programado obligaría a generarlas por adelantado y a regenerarlas
-- cada vez que cambia la frecuencia, y dos verdades sobre el mismo
-- cronograma terminan diciendo cosas distintas.
--
-- El módulo es `informatica`, nuevo en la matriz de permisos. Lo ven
-- Dirección y el Auditor —es justamente lo que se audita— y lo edita el
-- Administrador SGC por su piso. Los demás roles no lo ven.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1. El módulo nuevo en la matriz
-- ---------------------------------------------------------------------

alter table public.permisos drop constraint if exists permisos_modulo_valido;
alter table public.permisos add constraint permisos_modulo_valido check (modulo in (
  'inicio', 'directorio', 'aplicaciones', 'mis_ventas',
  'panel', 'documentos', 'riesgos', 'objetivos', 'auditorias', 'cambios',
  'no_conformidades', 'acciones', 'reclamos', 'satisfaccion', 'activos',
  'personas', 'proveedores',
  'informatica',
  'usuarios', 'padron', 'ingresos', 'bitacora'
));

-- Una fila por rol y empresa, para que la pantalla de permisos muestre
-- la casilla con su valor en vez de un hueco. Dirección y el Auditor lo
-- ven; editar, ninguno: el Administrador SGC no se consulta, tiene piso.
do $carga$
declare
  v_empresa uuid;
  v_rol public.rol_usuario;
begin
  for v_empresa in select id from public.empresas loop
    foreach v_rol in array enum_range(null::public.rol_usuario) loop
      insert into public.permisos (empresa_id, rol, modulo, ver, editar)
      values (
        v_empresa,
        v_rol,
        'informatica',
        v_rol in ('administrador_sgc', 'direccion', 'auditor'),
        v_rol = 'administrador_sgc'
      )
      on conflict (empresa_id, rol, modulo) do nothing;
    end loop;
  end loop;
end
$carga$;

-- ---------------------------------------------------------------------
-- 2. Los controles
-- ---------------------------------------------------------------------

create table if not exists public.controles_ti (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  codigo text not null,
  nombre text not null,
  descripcion text,
  -- De dónde sale la obligación: el proceso y su actividad. Texto libre
  -- porque la Información Documentada todavía no tiene cargados estos
  -- dos procesos, y un control no puede esperar a que se carguen.
  documento_origen text,
  -- El formulario donde queda el registro, si tiene uno.
  formulario text,
  frecuencia_meses smallint not null,
  -- El primer mes del ciclo. Siempre el día 1: un control mensual se
  -- hace en el mes, no en un día puntual.
  primer_periodo date not null,
  responsable_id uuid references public.usuarios (id) on delete set null,
  -- Un control que el proceso dejó de exigir no se borra: se deja de
  -- programar y su historial queda.
  vigente boolean not null default true,
  es_demostracion boolean not null default false,
  creado_por uuid references public.usuarios (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table public.controles_ti drop constraint if exists controles_ti_frecuencia;
alter table public.controles_ti add constraint controles_ti_frecuencia
  check (frecuencia_meses in (1, 3, 6, 12));

alter table public.controles_ti drop constraint if exists controles_ti_primer_dia;
alter table public.controles_ti add constraint controles_ti_primer_dia
  check (extract(day from primer_periodo) = 1);

alter table public.controles_ti drop constraint if exists controles_ti_textos;
alter table public.controles_ti add constraint controles_ti_textos
  check (length(trim(codigo)) between 2 and 20 and length(trim(nombre)) >= 5);

create unique index if not exists controles_ti_codigo_unico
  on public.controles_ti (empresa_id, upper(codigo));

comment on table public.controles_ti is
  'Controles periódicos de TI que exigen el MP-SOP-03 y el MP-SOP-07. El '
  'cronograma se calcula de primer_periodo y frecuencia_meses.';

-- ---------------------------------------------------------------------
-- 3. Las ejecuciones
-- ---------------------------------------------------------------------

create table if not exists public.control_ti_ejecuciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  control_id uuid not null references public.controles_ti (id) on delete cascade,
  -- El período programado que esta ejecución cubre, el día 1 del mes.
  periodo date not null,
  fecha_ejecucion date not null,
  resultado text not null,
  observaciones text,
  ejecutado_por uuid references public.usuarios (id) on delete set null,
  creado_por uuid references public.usuarios (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table public.control_ti_ejecuciones drop constraint if exists control_ti_ejecuciones_resultado;
alter table public.control_ti_ejecuciones add constraint control_ti_ejecuciones_resultado
  check (resultado in ('conforme', 'con_observaciones', 'no_conforme'));

alter table public.control_ti_ejecuciones drop constraint if exists control_ti_ejecuciones_primer_dia;
alter table public.control_ti_ejecuciones add constraint control_ti_ejecuciones_primer_dia
  check (extract(day from periodo) = 1);

-- Un resultado que no es conforme sin decir qué se encontró no le sirve
-- a nadie: la observación es lo que después se sigue.
alter table public.control_ti_ejecuciones drop constraint if exists control_ti_ejecuciones_observacion;
alter table public.control_ti_ejecuciones add constraint control_ti_ejecuciones_observacion
  check (resultado = 'conforme' or length(trim(coalesce(observaciones, ''))) >= 10);

-- Un período se ejecuta una vez. Si hay que corregirlo, se corrige esa
-- fila; dos registros del mismo mes no dicen cuál vale.
create unique index if not exists control_ti_ejecuciones_periodo_unico
  on public.control_ti_ejecuciones (control_id, periodo);

create index if not exists control_ti_ejecuciones_control
  on public.control_ti_ejecuciones (control_id, periodo desc);

comment on table public.control_ti_ejecuciones is
  'Cada ejecución de un control de TI. La evidencia va en adjuntos con '
  'entidad = ''control_ti_ejecuciones''.';

-- ---------------------------------------------------------------------
-- 4. Disparadores: actualización y bitácora
--
-- Cuándo se hizo un control y con qué resultado es exactamente lo que
-- pregunta una auditoría: va a la bitácora por disparador, así ningún
-- camino de escritura la evade.
-- ---------------------------------------------------------------------

drop trigger if exists controles_ti_actualizacion on public.controles_ti;
create trigger controles_ti_actualizacion
  before update on public.controles_ti
  for each row execute function public.marcar_actualizacion();

drop trigger if exists control_ti_ejecuciones_actualizacion on public.control_ti_ejecuciones;
create trigger control_ti_ejecuciones_actualizacion
  before update on public.control_ti_ejecuciones
  for each row execute function public.marcar_actualizacion();

drop trigger if exists bitacora_controles_ti on public.controles_ti;
create trigger bitacora_controles_ti
  after insert or update or delete on public.controles_ti
  for each row execute function public.registrar_bitacora();

drop trigger if exists bitacora_control_ti_ejecuciones on public.control_ti_ejecuciones;
create trigger bitacora_control_ti_ejecuciones
  after insert or update or delete on public.control_ti_ejecuciones
  for each row execute function public.registrar_bitacora();

-- ---------------------------------------------------------------------
-- 5. RLS y grant
--
-- Las dos tablas están fuera del bucle de `..._politicas_rls.sql`, así
-- que el grant va explícito: sin él PostgreSQL corta antes de evaluar
-- las políticas y la pantalla queda vacía sin decir por qué.
-- ---------------------------------------------------------------------

alter table public.controles_ti enable row level security;
alter table public.control_ti_ejecuciones enable row level security;

revoke all on public.controles_ti from anon;
revoke all on public.control_ti_ejecuciones from anon;
grant select, insert, update, delete on public.controles_ti to authenticated;
grant select, insert, update, delete on public.control_ti_ejecuciones to authenticated;

drop policy if exists controles_ti_lectura on public.controles_ti;
create policy controles_ti_lectura on public.controles_ti
  for select to authenticated
  using (public.misma_empresa(empresa_id) and public.puede_ver('informatica'));

drop policy if exists controles_ti_gestion on public.controles_ti;
create policy controles_ti_gestion on public.controles_ti
  for all to authenticated
  using (public.misma_empresa(empresa_id) and public.puede_editar('informatica'))
  with check (public.misma_empresa(empresa_id) and public.puede_editar('informatica'));

drop policy if exists control_ti_ejecuciones_lectura on public.control_ti_ejecuciones;
create policy control_ti_ejecuciones_lectura on public.control_ti_ejecuciones
  for select to authenticated
  using (public.misma_empresa(empresa_id) and public.puede_ver('informatica'));

drop policy if exists control_ti_ejecuciones_gestion on public.control_ti_ejecuciones;
create policy control_ti_ejecuciones_gestion on public.control_ti_ejecuciones
  for all to authenticated
  using (public.misma_empresa(empresa_id) and public.puede_editar('informatica'))
  with check (public.misma_empresa(empresa_id) and public.puede_editar('informatica'));
