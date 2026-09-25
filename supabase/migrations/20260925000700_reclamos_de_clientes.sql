-- =====================================================================
-- Intranet - Camping 44 S.A.
-- Reclamos de Clientes (MP-EST-04, ISO 9001:2026 - 8.2.1 y 9.1.2)
-- =====================================================================
-- Carlos paso el procedimiento de Experiencia y Fidelizacion de Clientes.
-- El propio documento nombra a este modulo como «fuente unica de
-- trazabilidad del caso»: si el reclamo no esta aca, no existe.
--
-- LA GRAVEDAD DEL HECHO DEFINE EL PLAN, no la intensidad del reclamo. Leve
-- da Plan A, Real da Plan B, Grave da Plan C, y cada plan trae sus plazos:
-- primer contacto, definicion del plan y resolucion. Eso es lo que separa
-- este modulo de una lista de quejas.
--
-- DOS COSAS SUBEN EL PLAN, nunca lo bajan:
--   · La reincidencia —segunda falla al mismo cliente en seis meses— sube
--     un nivel. Si el hecho ya es Grave, no hay nivel superior.
--   · El rechazo del cliente escala al plan siguiente para una segunda
--     propuesta. Rechazado el Plan C, queda la oferta final o el cierre
--     como «No conciliado».
-- Por eso el plan se guarda y no se deriva de la gravedad al vuelo: el
-- plan vigente puede ser mayor que el que le tocaba al hecho.
--
-- QUIEN ORIGINO LA FALLA NO GESTIONA EL CONTACTO. Es la regla de
-- imparcialidad del procedimiento y la base la hace cumplir.
--
-- LO QUE ESTE MODULO NO HACE TODAVIA, y esta pendiente de definicion de
-- Calidad: quien puede autorizar cada tramo de compensacion. Los cargos
-- del procedimiento —Supervisor del Canal Consumidor Final, Jefe del
-- Canal Consumidor Final— no coinciden con los puestos cargados, y
-- adivinar quien firma plata es exactamente lo que no hay que adivinar.
-- El monto, el tramo que corresponde y quien autorizo SI se registran.

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'gravedad_reclamo') then
    create type public.gravedad_reclamo as enum ('leve', 'real', 'grave');
  end if;

  if not exists (select 1 from pg_type where typname = 'plan_reclamo') then
    create type public.plan_reclamo as enum ('a', 'b', 'c');
  end if;

  if not exists (select 1 from pg_type where typname = 'estado_reclamo') then
    create type public.estado_reclamo as enum (
      'registrado', 'contactado', 'plan_definido', 'resuelto', 'cerrado', 'no_conciliado');
  end if;

  if not exists (select 1 from pg_type where typname = 'estado_cliente_reclamo') then
    create type public.estado_cliente_reclamo as enum (
      'en_gestion', 'recuperado', 'en_observacion', 'perdido', 'no_conciliado');
  end if;

  -- Como se entero la empresa. Sale de la lista de activacion del
  -- procedimiento: no todo reclamo llega como reclamo.
  if not exists (select 1 from pg_type where typname = 'origen_reclamo') then
    create type public.origen_reclamo as enum (
      'encuesta_nps', 'reclamo_directo', 'resena_negativa', 'devolucion_cambio',
      'error_facturacion', 'incumplimiento_entrega', 'falla_servicio_tecnico',
      'incumplimiento_condicion', 'queja_verbal');
  end if;

  -- Donde se origino la falla. Es la tabla de la actividad 3 del
  -- procedimiento, que ademas dice a que responsable le corresponde.
  if not exists (select 1 from pg_type where typname = 'tipo_falla_reclamo') then
    create type public.tipo_falla_reclamo as enum (
      'picking_despacho_entrega', 'facturacion_cobro_credito', 'tecnica_producto_garantia',
      'tramite_regulatorio', 'atencion_salon_stand_instruccion', 'pedido_mayorista',
      'producto_defectuoso_proveedor', 'otro');
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- El caso
-- ---------------------------------------------------------------------
create table if not exists public.reclamos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  codigo text not null,
  titulo text not null,
  descripcion text not null,

  -- El cliente. SIN CLIENTE IDENTIFICADO NO HAY REINCIDENCIA: la regla de
  -- las dos fallas en seis meses necesita saber que es la misma persona.
  -- Se admite nulo porque en salon hay ventas sin cliente cargado, y el
  -- nombre queda igual para poder buscarlo.
  cliente_id uuid references public.clientes (id) on delete set null,
  cliente_nombre text not null,

  origen public.origen_reclamo not null default 'reclamo_directo',
  tipo_falla public.tipo_falla_reclamo not null default 'otro',

  -- Cuando la falla toca a mas de un departamento, el principal es
  -- `tipo_falla` y los demas quedan aca.
  departamentos_intervinientes text[] not null default '{}',

  gravedad public.gravedad_reclamo not null,
  plan public.plan_reclamo not null,
  estado public.estado_reclamo not null default 'registrado',
  estado_cliente public.estado_cliente_reclamo not null default 'en_gestion',

  -- Quien gestiona el caso y quien responde por el area donde se origino.
  -- No pueden ser la misma persona: es la regla de imparcialidad.
  gestor_id uuid references public.usuarios (id) on delete set null,
  responsable_area_id uuid references public.usuarios (id) on delete set null,

  es_reincidencia boolean not null default false,
  rechazos integer not null default 0,

  -- Material controlado. El plazo se suspende mientras dure el tramite
  -- ante la DIGEMABEL, y eso hay que poder demostrarlo.
  material_controlado boolean not null default false,
  tramite_digemabel boolean not null default false,
  suspendido_desde date,
  notificado_gerencia boolean not null default false,

  fecha_deteccion date not null default current_date,
  fecha_limite_contacto date not null,
  fecha_contacto date,
  fecha_limite_plan date not null,
  fecha_definicion_plan date,
  fecha_limite_resolucion date not null,
  fecha_resolucion date,
  fecha_cierre date,

  -- Plan C: verificacion con el cliente a los 30 dias del cierre.
  fecha_verificacion date,
  verificacion_observacion text,

  -- Compensacion. El porcentaje se calcula sobre el monto de la factura
  -- afectada y no sobre el perjuicio estimado: lo dice el procedimiento.
  compensacion_detalle text,
  compensacion_monto numeric,
  monto_factura numeric,
  conformidad_firmada boolean not null default false,
  autorizado_por uuid references public.usuarios (id) on delete set null,
  fecha_autorizacion date,

  motivo_no_conciliado text,
  no_conformidad_id uuid references public.no_conformidades (id) on delete set null,

  es_demostracion boolean not null default false,
  creado_por uuid references public.usuarios (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint reclamos_codigo_formato check (codigo ~ '^REC-[0-9]{4}-[0-9]{3}$'),

  -- El plan puede ser MAYOR que el que le toca a la gravedad —por
  -- reincidencia o por rechazo del cliente— pero nunca menor. Sin esto,
  -- un caso grave podria terminar con los plazos de uno leve.
  constraint reclamos_plan_no_baja check (
    case gravedad
      when 'leve' then true
      when 'real' then plan in ('b', 'c')
      when 'grave' then plan = 'c'
    end
  ),

  -- Quien origino la falla no gestiona el contacto con el cliente.
  constraint reclamos_imparcialidad check (
    gestor_id is null or responsable_area_id is null or gestor_id <> responsable_area_id
  ),

  -- Cerrar como «no conciliado» sin decir por que deja el caso sin la
  -- unica informacion que sirve para revisarlo despues.
  constraint reclamos_motivo_no_conciliado check (
    estado <> 'no_conciliado'
    or (motivo_no_conciliado is not null and length(btrim(motivo_no_conciliado)) > 0)
  ),

  -- Toda compensacion economica exige la conformidad firmada del cliente
  -- ANTES de ejecutarse.
  constraint reclamos_conformidad_necesaria check (
    compensacion_monto is null or compensacion_monto <= 0 or conformidad_firmada
  ),

  -- El tramite ante la DIGEMABEL suspende el plazo desde una fecha, no
  -- «desde siempre».
  constraint reclamos_suspension_con_fecha check (
    tramite_digemabel is not true or suspendido_desde is not null
  )
);

create unique index if not exists reclamos_codigo_unico
  on public.reclamos (empresa_id, upper(codigo));
create index if not exists reclamos_estado_idx on public.reclamos (empresa_id, estado);
create index if not exists reclamos_cliente_idx on public.reclamos (cliente_id, fecha_deteccion);
create index if not exists reclamos_gestor_idx on public.reclamos (gestor_id);
create index if not exists reclamos_limite_idx on public.reclamos (empresa_id, fecha_limite_resolucion);

comment on table public.reclamos is
  'Reclamos de Clientes (MP-EST-04). Fuente unica de trazabilidad del caso, '
  'desde la deteccion hasta el cierre con el estado final del cliente.';

-- ---------------------------------------------------------------------
-- Las acciones del plan
-- ---------------------------------------------------------------------
-- El procedimiento pide que quede registrado «que acciones se toman,
-- quien las ejecuta y en que fecha». Van en su propia tabla y no en un
-- parrafo: de un caso salen varias y cada una la ejecuta alguien distinto.
create table if not exists public.reclamo_acciones (
  id uuid primary key default gen_random_uuid(),
  reclamo_id uuid not null references public.reclamos (id) on delete cascade,
  descripcion text not null,
  responsable_id uuid references public.usuarios (id) on delete set null,
  fecha_limite date,
  ejecutada_en date,
  observacion text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists reclamo_acciones_reclamo_idx on public.reclamo_acciones (reclamo_id);
create index if not exists reclamo_acciones_responsable_idx
  on public.reclamo_acciones (responsable_id);

-- ---------------------------------------------------------------------
-- Correlativo
-- ---------------------------------------------------------------------
create or replace function public.siguiente_codigo_reclamo(p_empresa_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anio text := to_char(now() at time zone 'America/Asuncion', 'YYYY');
  v_secuencia integer;
begin
  select coalesce(max(split_part(codigo, '-', 3)::integer), 0) + 1
    into v_secuencia
    from public.reclamos
   where empresa_id = p_empresa_id
     and codigo like 'REC-' || v_anio || '-%';

  return 'REC-' || v_anio || '-' || lpad(v_secuencia::text, 3, '0');
end;
$$;

grant execute on function public.siguiente_codigo_reclamo(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Reincidencia
-- ---------------------------------------------------------------------
-- Segunda falla al mismo cliente en seis meses. Se resuelve en la base
-- porque la respuesta depende de lo que ya esta guardado, y asi vale
-- igual si el caso se carga desde la pantalla o desde un script.
create or replace function public.hay_reincidencia_de_reclamo(
  p_cliente_id uuid,
  p_fecha date default current_date,
  p_excluir uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.reclamos
     where cliente_id is not null
       and cliente_id = p_cliente_id
       and (p_excluir is null or id <> p_excluir)
       and fecha_deteccion >= p_fecha - 180
       and fecha_deteccion <= p_fecha
  );
$$;

grant execute on function public.hay_reincidencia_de_reclamo(uuid, date, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- RLS, grants y disparadores
-- ---------------------------------------------------------------------
alter table public.reclamos enable row level security;
revoke all on public.reclamos from anon;
grant select, insert, update, delete on public.reclamos to authenticated;

drop policy if exists "reclamos_lectura" on public.reclamos;
create policy "reclamos_lectura" on public.reclamos
  for select to authenticated using (public.misma_empresa(empresa_id));

drop policy if exists "reclamos_alta" on public.reclamos;
create policy "reclamos_alta" on public.reclamos
  for insert to authenticated
  with check (public.puede_gestionar() and public.misma_empresa(empresa_id));

drop policy if exists "reclamos_edicion" on public.reclamos;
create policy "reclamos_edicion" on public.reclamos
  for update to authenticated
  using (
    public.misma_empresa(empresa_id)
    and (public.es_admin_sgc()
         or gestor_id = auth.uid()
         or responsable_area_id = auth.uid())
  )
  with check (public.misma_empresa(empresa_id));

drop policy if exists "reclamos_baja" on public.reclamos;
create policy "reclamos_baja" on public.reclamos
  for delete to authenticated
  using (public.es_admin_sgc() and public.misma_empresa(empresa_id));

alter table public.reclamo_acciones enable row level security;
revoke all on public.reclamo_acciones from anon;
grant select, insert, update, delete on public.reclamo_acciones to authenticated;

-- Se cuelga del caso: si puede ver el caso, puede ver sus acciones.
drop policy if exists "reclamo_acciones_lectura" on public.reclamo_acciones;
create policy "reclamo_acciones_lectura" on public.reclamo_acciones
  for select to authenticated
  using (exists (select 1 from public.reclamos r where r.id = reclamo_id));

drop policy if exists "reclamo_acciones_gestion" on public.reclamo_acciones;
create policy "reclamo_acciones_gestion" on public.reclamo_acciones
  for all to authenticated
  using (public.puede_gestionar() or responsable_id = auth.uid())
  with check (public.puede_gestionar() or responsable_id = auth.uid());

drop trigger if exists reclamos_actualizado_en on public.reclamos;
create trigger reclamos_actualizado_en before update on public.reclamos
  for each row execute function public.marcar_actualizacion();

drop trigger if exists reclamo_acciones_actualizado_en on public.reclamo_acciones;
create trigger reclamo_acciones_actualizado_en before update on public.reclamo_acciones
  for each row execute function public.marcar_actualizacion();

-- La bitacora por disparador, que es requisito de auditoria.
drop trigger if exists bitacora_reclamos on public.reclamos;
create trigger bitacora_reclamos
  after insert or update or delete on public.reclamos
  for each row execute function public.registrar_bitacora();

drop trigger if exists bitacora_reclamo_acciones on public.reclamo_acciones;
create trigger bitacora_reclamo_acciones
  after insert or update or delete on public.reclamo_acciones
  for each row execute function public.registrar_bitacora();
