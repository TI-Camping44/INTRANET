-- =====================================================================
-- Intranet - Camping 44 S.A.
-- Planificacion y Gestion de Cambios (ISO 9001:2026 - 6.3)
-- =====================================================================
-- Calidad definio el procedimiento y pidio el modulo. La regla de fondo:
-- todo cambio significativo al SGC se registra ACA antes de hacerse, con
-- lo que hay que pensar antes y no despues.
--
-- QUE ES UN CAMBIO SIGNIFICATIVO, como minimo: alta o baja de un proceso,
-- cambio de responsable de un proceso, nueva habilitacion o perdida de
-- una habilitacion, cambio de sistema (ERP, Intranet), mudanza de
-- deposito o local, nueva linea de productos controlados, y cambios de la
-- Ley 7411/2024 o de resoluciones de la DIGEMABEL. El enumerado es esa
-- lista, con `otro` al final porque «como minimo» quiere decir que la
-- lista no se cierra.
--
-- EL CICLO. Se propone, se aprueba, se implementa, se le da seguimiento
-- en una fecha fijada de antemano, y se cierra. No se puede llegar al
-- final sin haber definido el indicador y el criterio de exito ANTES de
-- implementar: eso es lo que separa este modulo de una lista de avisos.
--
-- SI FALLA, HAY QUE DECIDIR: ajuste, reversion o accion correctiva. La
-- tercera abre una no conformidad de verdad, con su numero y su plazo, y
-- queda enlazada; no alcanza con anotar que fallo.
--
-- LO QUE ESTE MODULO NO HACE. No aprueba solo, no capacita solo y no
-- actualiza la documentacion solo: registra quien lo hizo y cuando. La
-- trazabilidad es el producto.

-- ---------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'tipo_cambio') then
    create type public.tipo_cambio as enum (
      'alta_proceso',
      'baja_proceso',
      'cambio_responsable_proceso',
      'nueva_habilitacion',
      'perdida_habilitacion',
      'cambio_sistema',
      'mudanza_deposito_local',
      'nueva_linea_productos_controlados',
      'cambio_normativo',
      'otro'
    );
  end if;

  -- `en_aprobacion` existe para que se vea la diferencia entre lo que
  -- todavia se esta escribiendo y lo que ya esta esperando una firma.
  if not exists (select 1 from pg_type where typname = 'estado_cambio') then
    create type public.estado_cambio as enum (
      'borrador',
      'en_aprobacion',
      'aprobado',
      'rechazado',
      'implementado',
      'cerrado'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'resultado_cambio') then
    create type public.resultado_cambio as enum ('pendiente', 'eficaz', 'no_eficaz');
  end if;

  if not exists (select 1 from pg_type where typname = 'decision_cambio') then
    create type public.decision_cambio as enum ('ajuste', 'reversion', 'accion_correctiva');
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Tabla
-- ---------------------------------------------------------------------
create table if not exists public.cambios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  codigo text not null,
  titulo text not null,
  tipo public.tipo_cambio not null default 'otro',
  estado public.estado_cambio not null default 'borrador',
  proceso_id uuid references public.procesos (id) on delete set null,

  -- Lo que el procedimiento exige documentar de cada cambio. Van como
  -- columnas y no como un texto libre para que ninguna se pueda saltear
  -- en silencio.
  proposito text not null,
  consecuencias_potenciales text not null,
  impacto_integridad_sgc text not null,
  recursos_necesarios text not null,
  responsabilidades text not null,

  -- Plan de comunicacion: a quien, cuando y por que canal. Separado en
  -- tres porque en un solo parrafo siempre falta uno de los tres.
  comunicacion_a_quien text not null,
  comunicacion_cuando text not null,
  comunicacion_canal text not null,

  -- Material controlado: si el cambio toca procesos con material
  -- controlado, hay que decir que pasa con la trazabilidad de la Ley
  -- 7411/2024. Es lo unico de este modulo que puede terminar en una
  -- inspeccion de la DIGEMABEL.
  afecta_material_controlado boolean not null default false,
  impacto_trazabilidad text,

  -- Antes de implementar. Sin esto no se puede aprobar.
  indicador_exito text not null,
  criterio_exito text not null,
  fecha_revision date not null,

  responsable_id uuid references public.usuarios (id) on delete set null,

  -- Aprobacion.
  aprobado_por uuid references public.usuarios (id) on delete set null,
  fecha_aprobacion date,
  motivo_rechazo text,

  -- Implementacion y capacitacion del personal afectado (MP-SOP-01).
  fecha_implementacion date,
  capacitacion_realizada boolean not null default false,
  capacitacion_detalle text,

  -- Seguimiento de la eficacia, en la fecha prevista.
  resultado public.resultado_cambio not null default 'pendiente',
  seguimiento_observacion text,
  decision public.decision_cambio,
  fecha_seguimiento date,
  seguido_por uuid references public.usuarios (id) on delete set null,
  no_conformidad_id uuid references public.no_conformidades (id) on delete set null,

  -- Un cambio eficaz puede y debe disparar la actualizacion de la
  -- informacion documentada pertinente.
  requiere_actualizar_documentacion boolean not null default false,
  documentacion_actualizada text,

  es_demostracion boolean not null default false,
  creado_por uuid references public.usuarios (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint cambios_codigo_formato check (codigo ~ '^CAM-[0-9]{4}-[0-9]{3}$'),

  -- Decir que toca material controlado y no decir que pasa con la
  -- trazabilidad deja el registro sin lo unico que a Calidad le van a
  -- pedir en una inspeccion.
  constraint cambios_trazabilidad_necesaria check (
    afecta_material_controlado is not true
    or (impacto_trazabilidad is not null and length(btrim(impacto_trazabilidad)) > 0)
  ),

  -- Rechazar sin decir por que no le sirve a quien tiene que corregir.
  constraint cambios_motivo_rechazo_necesario check (
    estado <> 'rechazado'
    or (motivo_rechazo is not null and length(btrim(motivo_rechazo)) > 0)
  ),

  -- Si el cambio no fue eficaz hay que decidir que se hace: ajuste,
  -- reversion o accion correctiva. Dejarlo en «no eficaz» y nada mas es
  -- exactamente lo que el procedimiento quiere evitar.
  constraint cambios_decision_necesaria check (
    resultado <> 'no_eficaz' or decision is not null
  )
);

create unique index if not exists cambios_codigo_unico
  on public.cambios (empresa_id, upper(codigo));
create index if not exists cambios_estado_idx on public.cambios (empresa_id, estado);
create index if not exists cambios_proceso_idx on public.cambios (proceso_id);
create index if not exists cambios_responsable_idx on public.cambios (responsable_id);
create index if not exists cambios_revision_idx on public.cambios (empresa_id, fecha_revision);

comment on table public.cambios is
  'Planificacion y Gestion de Cambios (ISO 9001:2026 - 6.3). Un registro '
  'por cambio significativo al SGC, desde que se propone hasta que se '
  'verifica su eficacia.';

-- ---------------------------------------------------------------------
-- Correlativo, igual que las no conformidades
-- ---------------------------------------------------------------------
create or replace function public.siguiente_codigo_cambio(p_empresa_id uuid)
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
    from public.cambios
   where empresa_id = p_empresa_id
     and codigo like 'CAM-' || v_anio || '-%';

  return 'CAM-' || v_anio || '-' || lpad(v_secuencia::text, 3, '0');
end;
$$;

grant execute on function public.siguiente_codigo_cambio(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- RLS, grants y disparadores
-- ---------------------------------------------------------------------
-- El bucle de ..._politicas_rls.sql corrio sobre las tablas que existian
-- entonces. Una tabla nueva necesita las tres cosas explicitas: RLS, el
-- grant y sus politicas. Sin el grant, PostgreSQL corta antes de evaluar
-- las politicas y la pantalla queda vacia sin decir por que.
alter table public.cambios enable row level security;
revoke all on public.cambios from anon;
grant select, insert, update, delete on public.cambios to authenticated;

drop policy if exists "cambios_lectura" on public.cambios;
create policy "cambios_lectura" on public.cambios
  for select to authenticated using (public.misma_empresa(empresa_id));

drop policy if exists "cambios_alta" on public.cambios;
create policy "cambios_alta" on public.cambios
  for insert to authenticated
  with check (public.puede_gestionar() and public.misma_empresa(empresa_id));

drop policy if exists "cambios_edicion" on public.cambios;
create policy "cambios_edicion" on public.cambios
  for update to authenticated
  using (
    public.misma_empresa(empresa_id)
    and (public.es_admin_sgc()
         or public.es_direccion()
         or responsable_id = auth.uid()
         or public.es_responsable_de_proceso(proceso_id))
  )
  with check (public.misma_empresa(empresa_id));

drop policy if exists "cambios_baja" on public.cambios;
create policy "cambios_baja" on public.cambios
  for delete to authenticated
  using (public.es_admin_sgc() and public.misma_empresa(empresa_id));

drop trigger if exists cambios_actualizado_en on public.cambios;
create trigger cambios_actualizado_en
  before update on public.cambios
  for each row execute function public.marcar_actualizacion();

-- La bitacora se alimenta por disparador y no desde la aplicacion, para
-- que ningun camino de escritura la pueda evadir. Es requisito de
-- auditoria, no es opcional.
drop trigger if exists bitacora_cambios on public.cambios;
create trigger bitacora_cambios
  after insert or update or delete on public.cambios
  for each row execute function public.registrar_bitacora();
