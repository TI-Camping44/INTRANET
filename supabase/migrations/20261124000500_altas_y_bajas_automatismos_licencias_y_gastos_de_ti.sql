-- ---------------------------------------------------------------------
-- Informática · Altas y bajas de accesos, estado de los automatismos,
-- licencias con su costo y gastos de TI
--
-- Lo pidió el Responsable de TI el 24 de noviembre: «agrega todo», y
-- después «hasta gastos inclusive». Son cuatro piezas que se apoyan en
-- lo que ya existía, no al lado:
--
--   1. LAS LICENCIAS YA ERAN ACTIVOS. Los quince intangibles —Odoo,
--      Workspace, Claude, ESET, GitHub, Vercel, Supabase, el hosting,
--      dos dominios y tres certificados— viven en `activos` desde la
--      NC-2026-024, con vencimiento y alerta a 30 días. Una tabla de
--      licencias aparte habría sido el mismo error que `cambios_ti`.
--      Lo que les faltaba para cumplir el control 3.3 —cuántas hay,
--      cuántas se usan y cuánto cuestan— se agrega como columnas del
--      activo, y la pantalla de Informática las lee de ahí. La carga sale
--      de la planilla «Inventario de Licencias de Software - Camping 44»,
--      relevada al 17/11/2026.
--
--   2. GASTOS DE TI (`gastos_ti`): cada pago o factura, con su moneda y
--      la empresa a la que se imputa. Las licencias de Vitalica se pagan
--      con la tarjeta o la factura de Camping 44, así que «quién pagó» y
--      «de quién es el gasto» son dos preguntas distintas. Lo leen quien
--      edita Informática y Dirección; el Auditor no, porque es un dato
--      económico y no hace a ningún control del sistema.
--
--   3. ESTADO DE LOS AUTOMATISMOS (`automatismos_ti`): un Apps Script
--      que pierde su activador o su autorización deja de existir sin
--      avisar a nadie. Varios llevan meses caídos. Ahora cada script
--      avisa que corrió llamando a `registrar_latido()`, y la pantalla y
--      el trabajo programado de las 11:00 marcan los que se callaron.
--      Mismo diseño que la ticketera: el script empuja con un secreto
--      cuyo hash vive en `secretos_de_integracion`.
--
--   4. ALTAS Y BAJAS DE ACCESOS (`movimientos_accesos_ti` y sus pasos):
--      la matriz de accesos dice qué corresponde a cada puesto; esto
--      registra qué se hizo con cada persona que entra o sale, paso por
--      paso. Es la evidencia de la NC-2026-019. Los pasos los arma la
--      acción de servidor a partir de la matriz, al dar de alta el
--      movimiento, y quedan fijos: si después cambia la matriz, lo que se
--      hizo con esta persona no cambia.
--
-- Todo usa el módulo `informatica` de la matriz de permisos.
-- ---------------------------------------------------------------------

-- =====================================================================
-- 1. Licencias: cuántas hay, cuántas se usan y cuánto cuestan
-- =====================================================================

alter table public.activos add column if not exists cantidad_contratada integer;
alter table public.activos add column if not exists cantidad_en_uso integer;
alter table public.activos add column if not exists costo_ciclo numeric(14, 2);
alter table public.activos add column if not exists moneda_costo text;
-- Cada cuántos meses se paga: 1 mensual, 12 anual, 24 o 36 plurianual,
-- 0 sin costo. El costo mensual equivalente es costo_ciclo / ciclo_meses.
alter table public.activos add column if not exists ciclo_meses integer;

alter table public.activos drop constraint if exists activos_licencia_cantidades;
alter table public.activos add constraint activos_licencia_cantidades check (
  (cantidad_contratada is null or cantidad_contratada >= 0)
  and (cantidad_en_uso is null or cantidad_en_uso >= 0)
  and (cantidad_contratada is null or cantidad_en_uso is null
       or cantidad_en_uso <= cantidad_contratada)
);

alter table public.activos drop constraint if exists activos_licencia_costo;
alter table public.activos add constraint activos_licencia_costo check (
  (costo_ciclo is null or costo_ciclo >= 0)
  and (moneda_costo is null or moneda_costo in ('USD', 'PYG'))
  and (costo_ciclo is null or moneda_costo is not null)
  and (ciclo_meses is null or ciclo_meses in (0, 1, 3, 6, 12, 24, 36))
);

comment on column public.activos.cantidad_contratada is
  'Licencias o plazas contratadas. Solo para intangibles (control 3.3).';
comment on column public.activos.cantidad_en_uso is
  'Licencias asignadas, incluidas las que ocupa Vitalica.';
comment on column public.activos.costo_ciclo is
  'Lo que se paga en cada ciclo, en moneda_costo.';
comment on column public.activos.ciclo_meses is
  'Cada cuántos meses se paga: 1, 3, 6, 12, 24 o 36; 0 si no tiene costo.';

-- Carga desde la planilla «Inventario de Licencias de Software» (17/11).
-- Lo que la planilla deja «a relevar» queda nulo: un cero inventado
-- diría que es gratis.
update public.activos set cantidad_contratada = 44, cantidad_en_uso = 39,
       costo_ciclo = 308.44, moneda_costo = 'USD', ciclo_meses = 1
 where codigo = 'C44-LIC-002';  -- Google Workspace Business Starter
update public.activos set cantidad_contratada = 15, cantidad_en_uso = 15,
       costo_ciclo = 210.15, moneda_costo = 'USD', ciclo_meses = 1
 where codigo = 'C44-LIC-003';  -- Google Workspace Business Standard
update public.activos set cantidad_contratada = 48, cantidad_en_uso = 43,
       costo_ciclo = 10240.94, moneda_costo = 'USD', ciclo_meses = 12
 where codigo = 'C44-LIC-001';  -- Odoo 17 Enterprise
update public.activos set cantidad_contratada = 15, cantidad_en_uso = 15,
       costo_ciclo = 375.00, moneda_costo = 'USD', ciclo_meses = 1
 where codigo = 'C44-LIC-004';  -- Claude Team
update public.activos set cantidad_contratada = 2, cantidad_en_uso = 2,
       costo_ciclo = 200.00, moneda_costo = 'USD', ciclo_meses = 1
 where codigo = 'C44-LIC-005';  -- Claude Max, 2 suscripciones de USD 100
update public.activos set cantidad_contratada = 1, cantidad_en_uso = 1,
       costo_ciclo = 0, moneda_costo = 'USD', ciclo_meses = 0
 where codigo = 'C44-LIC-007';  -- Supabase Free
update public.activos set costo_ciclo = 1224000, moneda_costo = 'PYG', ciclo_meses = 12
 where codigo = 'C44-LIC-010';  -- Hosting de vitalica.com.py (valor ya cargado)
update public.activos set costo_ciclo = 150000, moneda_costo = 'PYG', ciclo_meses = 12
 where codigo = 'C44-DOM-001';  -- camping44.com.py, renovación de noviembre

-- =====================================================================
-- 2. Gastos de TI
-- =====================================================================

create table if not exists public.gastos_ti (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  fecha date not null,
  proveedor text not null,
  concepto text not null,
  categoria text not null,
  monto numeric(14, 2) not null,
  moneda text not null,
  -- De qué empresa del grupo es el gasto, que no siempre es la que
  -- pagó. Nulo quiere decir «compartido». NUNCA va en `empresa_id`.
  empresa_imputada_id uuid references public.empresas (id) on delete set null,
  -- La licencia o el activo al que corresponde, si corresponde a uno.
  activo_id uuid references public.activos (id) on delete set null,
  comprobante text,
  enlace_comprobante text,
  medio_pago text,
  observaciones text,
  creado_por uuid references public.usuarios (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- La lista vive también en `lib/gastos-ti.ts`.
alter table public.gastos_ti drop constraint if exists gastos_ti_categoria;
alter table public.gastos_ti add constraint gastos_ti_categoria check (categoria in (
  'licencias', 'soporte', 'equipos', 'servicios', 'desarrollo', 'comunicaciones', 'otros'
));

alter table public.gastos_ti drop constraint if exists gastos_ti_monto;
alter table public.gastos_ti add constraint gastos_ti_monto check (
  monto > 0 and moneda in ('USD', 'PYG')
);

alter table public.gastos_ti drop constraint if exists gastos_ti_textos;
alter table public.gastos_ti add constraint gastos_ti_textos check (
  length(trim(proveedor)) between 2 and 120
  and length(trim(concepto)) between 3 and 200
);

-- Un enlace que la pantalla dibuja tal cual: solo https, como en
-- Aplicaciones, para que nadie cuele un `javascript:`.
alter table public.gastos_ti drop constraint if exists gastos_ti_enlace;
alter table public.gastos_ti add constraint gastos_ti_enlace
  check (enlace_comprobante is null or enlace_comprobante ~ '^https://');

create index if not exists gastos_ti_fecha on public.gastos_ti (empresa_id, fecha desc);

comment on table public.gastos_ti is
  'Pagos y facturas del área de TI, con la empresa del grupo a la que se imputan.';

drop trigger if exists gastos_ti_actualizacion on public.gastos_ti;
create trigger gastos_ti_actualizacion
  before update on public.gastos_ti
  for each row execute function public.marcar_actualizacion();

drop trigger if exists bitacora_gastos_ti on public.gastos_ti;
create trigger bitacora_gastos_ti
  after insert or update or delete on public.gastos_ti
  for each row execute function public.registrar_bitacora();

alter table public.gastos_ti enable row level security;
revoke all on public.gastos_ti from anon;
grant select, insert, update, delete on public.gastos_ti to authenticated;

drop policy if exists gastos_ti_lectura on public.gastos_ti;
create policy gastos_ti_lectura on public.gastos_ti
  for select to authenticated
  using (
    public.misma_empresa(empresa_id)
    and (public.puede_editar('informatica') or public.es_direccion())
  );

drop policy if exists gastos_ti_gestion on public.gastos_ti;
create policy gastos_ti_gestion on public.gastos_ti
  for all to authenticated
  using (public.misma_empresa(empresa_id) and public.puede_editar('informatica'))
  with check (public.misma_empresa(empresa_id) and public.puede_editar('informatica'));

-- Lo que consta en el correo: facturas y montos verificados.
insert into public.gastos_ti
  (empresa_id, fecha, proveedor, concepto, categoria, monto, moneda,
   empresa_imputada_id, activo_id, comprobante, medio_pago, observaciones)
select e.id, g.fecha, g.proveedor, g.concepto, g.categoria, g.monto, g.moneda,
       e.id, (select a.id from public.activos a where a.codigo = g.activo), g.comprobante,
       g.medio_pago, g.observaciones
  from (select id from public.empresas order by creado_en limit 1) e,
  (values
    ('2026-08-03'::date, 'Odoo Inc.', 'Odoo Enterprise — factura de la suscripción',
     'licencias', 210.12, 'USD', 'C44-LIC-001', 'saj/2026/091860 (SO2026/8077265)',
     'Pago a Odoo Inc. en USD', 'Factura reenviada por Ariel Kemper el 03/08/2026; figura pagada.'),
    ('2026-10-09'::date, 'OLAM S.R.L.', 'Google Workspace — 42 Starter + 15 Standard',
     'licencias', 504.57, 'USD', 'C44-LIC-002', '001-005-0009016',
     'Factura mensual de OLAM',
     'IVA incluido. Incluye 2 licencias Starter de Vitalica (Osmar Falcón y Hugo Jara, USD 14,02). '
     'Desde noviembre son 3 (USD 21,03) y el estimado mensual pasa a USD 518,59.'),
    ('2026-11-14'::date, 'NIC.PY (CNC-UNA)', 'Renovación anual del dominio camping44.com.py',
     'servicios', 150000, 'PYG', 'C44-DOM-001', null,
     null, 'Nuevo vencimiento: 25/11/2027. El comprobante llega al contacto de facturación del dominio.')
  ) as g(fecha, proveedor, concepto, categoria, monto, moneda, activo, comprobante, medio_pago, observaciones)
 where not exists (select 1 from public.gastos_ti);

-- =====================================================================
-- 3. Estado de los automatismos
-- =====================================================================

create table if not exists public.automatismos_ti (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  -- Con lo que se identifica el script al avisar. No cambia nunca.
  clave text not null,
  nombre text not null,
  donde_vive text,
  descripcion text,
  -- Cada cuántas horas tiene que avisar. Nulo: corre por un evento —un
  -- formulario, una edición— y no tiene un ritmo que controlar.
  frecuencia_horas integer,
  vigente boolean not null default true,
  responsable_id uuid references public.usuarios (id) on delete set null,
  creado_por uuid references public.usuarios (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (empresa_id, clave)
);

alter table public.automatismos_ti drop constraint if exists automatismos_ti_clave;
alter table public.automatismos_ti add constraint automatismos_ti_clave
  check (clave ~ '^[a-z0-9][a-z0-9._-]{2,79}$');

alter table public.automatismos_ti drop constraint if exists automatismos_ti_frecuencia;
alter table public.automatismos_ti add constraint automatismos_ti_frecuencia
  check (frecuencia_horas is null or frecuencia_horas between 1 and 8784);

-- Los latidos van en su propia tabla y NO en columnas del automatismo:
-- así la bitácora registra los cambios de configuración y no un renglón
-- por cada hora que corre un script.
create table if not exists public.automatismo_latidos (
  id bigserial primary key,
  automatismo_id uuid not null references public.automatismos_ti (id) on delete cascade,
  en timestamptz not null default now(),
  resultado text not null,
  mensaje text,
  duracion_segundos numeric(10, 2)
);

alter table public.automatismo_latidos drop constraint if exists automatismo_latidos_resultado;
alter table public.automatismo_latidos add constraint automatismo_latidos_resultado
  check (resultado in ('ok', 'error'));

create index if not exists automatismo_latidos_ultimo
  on public.automatismo_latidos (automatismo_id, en desc);

comment on table public.automatismos_ti is
  'Los automatismos de TI (Apps Script y otros) y cada cuánto tienen que avisar que corrieron.';
comment on table public.automatismo_latidos is
  'Cada aviso de un automatismo. Se conservan 60 días.';

drop trigger if exists automatismos_ti_actualizacion on public.automatismos_ti;
create trigger automatismos_ti_actualizacion
  before update on public.automatismos_ti
  for each row execute function public.marcar_actualizacion();

drop trigger if exists bitacora_automatismos_ti on public.automatismos_ti;
create trigger bitacora_automatismos_ti
  after insert or update or delete on public.automatismos_ti
  for each row execute function public.registrar_bitacora();

alter table public.automatismos_ti enable row level security;
revoke all on public.automatismos_ti from anon;
grant select, insert, update, delete on public.automatismos_ti to authenticated;

drop policy if exists automatismos_ti_lectura on public.automatismos_ti;
create policy automatismos_ti_lectura on public.automatismos_ti
  for select to authenticated
  using (public.misma_empresa(empresa_id) and public.puede_ver('informatica'));

drop policy if exists automatismos_ti_gestion on public.automatismos_ti;
create policy automatismos_ti_gestion on public.automatismos_ti
  for all to authenticated
  using (public.misma_empresa(empresa_id) and public.puede_editar('informatica'))
  with check (public.misma_empresa(empresa_id) and public.puede_editar('informatica'));

-- Los latidos solo se leen: los escribe `registrar_latido()`.
alter table public.automatismo_latidos enable row level security;
revoke all on public.automatismo_latidos from anon, authenticated;
grant select on public.automatismo_latidos to authenticated;

drop policy if exists automatismo_latidos_lectura on public.automatismo_latidos;
create policy automatismo_latidos_lectura on public.automatismo_latidos
  for select to authenticated
  using (exists (
    select 1 from public.automatismos_ti a
     where a.id = automatismo_id
       and public.misma_empresa(a.empresa_id)
       and public.puede_ver('informatica')
  ));

-- Cada automatismo con su último aviso y los errores de la semana. Corre
-- con los permisos de quien consulta, así RLS sigue mandando.
create or replace view public.vista_automatismos_ti
with (security_invoker = true) as
select a.*,
       u.en as ultimo_latido_en,
       u.resultado as ultimo_resultado,
       u.mensaje as ultimo_mensaje,
       (select count(*) from public.automatismo_latidos l
         where l.automatismo_id = a.id and l.resultado = 'error'
           and l.en > now() - interval '7 days')::integer as errores_7_dias,
       (select count(*) from public.automatismo_latidos l
         where l.automatismo_id = a.id
           and l.en > now() - interval '7 days')::integer as latidos_7_dias
  from public.automatismos_ti a
  left join lateral (
    select l.en, l.resultado, l.mensaje
      from public.automatismo_latidos l
     where l.automatismo_id = a.id
     order by l.en desc
     limit 1
  ) u on true;

grant select on public.vista_automatismos_ti to authenticated;

-- El script avisa que corrió. Si la clave no existe todavía, se crea el
-- automatismo sin frecuencia: así conectar un script nuevo es pegar el
-- código y nada más, y la pantalla lo muestra para completarle el ritmo.
create or replace function public.registrar_latido(
  p_secreto text,
  p_clave text,
  p_resultado text default 'ok',
  p_mensaje text default null,
  p_duracion_segundos numeric default null,
  p_nombre text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_empresa uuid;
  v_id uuid;
  v_clave text := lower(trim(coalesce(p_clave, '')));
  v_resultado text := case when lower(coalesce(p_resultado, 'ok')) = 'error' then 'error' else 'ok' end;
begin
  select hash_secreto into v_hash
    from public.secretos_de_integracion
   where nombre = 'automatismos_ti';

  if v_hash is null
     or p_secreto is null
     or encode(sha256(convert_to(p_secreto, 'UTF8')), 'hex') <> v_hash then
    raise exception 'Secreto de integración inválido.' using errcode = '28000';
  end if;

  if v_clave !~ '^[a-z0-9][a-z0-9._-]{2,79}$' then
    raise exception 'La clave del automatismo va en minúsculas, sin espacios: por ejemplo ticketera.revisar-sla.';
  end if;

  select id into v_empresa from public.empresas order by creado_en limit 1;

  insert into public.automatismos_ti (empresa_id, clave, nombre)
  values (v_empresa, v_clave, coalesce(nullif(trim(p_nombre), ''), v_clave))
  on conflict (empresa_id, clave) do nothing;

  select id into v_id from public.automatismos_ti
   where empresa_id = v_empresa and clave = v_clave;

  insert into public.automatismo_latidos (automatismo_id, resultado, mensaje, duracion_segundos)
  values (v_id, v_resultado, left(nullif(trim(p_mensaje), ''), 2000), p_duracion_segundos);

  delete from public.automatismo_latidos
   where automatismo_id = v_id and en < now() - interval '60 days';

  return jsonb_build_object('automatismo', v_clave, 'resultado', v_resultado, 'en', now());
end;
$$;

revoke all on function public.registrar_latido(text, text, text, text, numeric, text) from public;
grant execute on function public.registrar_latido(text, text, text, text, numeric, text)
  to anon, authenticated;

comment on function public.registrar_latido(text, text, text, text, numeric, text) is
  'La llaman los automatismos de TI para avisar que corrieron. Protegida por el secreto automatismos_ti.';

alter type public.tipo_notificacion add value if not exists 'automatismo_caido';

-- Lo que se sabe de cada automatismo. La frecuencia queda nula donde no
-- está confirmada: mejor que la pantalla pida completarla a que marque
-- caído algo que nunca tuvo ese ritmo.
insert into public.automatismos_ti
  (empresa_id, clave, nombre, donde_vive, descripcion, frecuencia_horas, responsable_id)
select e.id, a.clave, a.nombre, a.donde_vive, a.descripcion, a.frecuencia,
       (select u.id from public.usuarios u where u.correo = 'facundocolman@camping44.com.py')
  from (select id from public.empresas order by creado_en limit 1) e,
  (values
    ('ticketera.envio-a-la-intranet', 'Envío de la ticketera a la Intranet',
     'Tickets TI - Automatización · IntranetTickets.gs',
     'Copia la planilla TICKETS - BASE al Seguimiento de tickets.', 1),
    ('ticketera.revisar-sla', 'Tickets fuera de SLA',
     'Tickets TI - Automatización · revisarSLA',
     'Correo diario con los tickets fuera de SLA.', 24),
    ('ticketera.revisar-espera', 'Tickets en espera del usuario',
     'Tickets TI - Automatización · revisarEspera', null, null),
    ('ticketera.buscar-respuestas', 'Respuestas por correo a los tickets',
     'Tickets TI - Automatización · buscarRespuestas', null, null),
    ('ticketera.sincronizar-directorio', 'Directorio de la ticketera',
     'Tickets TI - Automatización · sincronizarDirectorio', null, null),
    ('ticketera.resumen-semanal', 'Resumen semanal de tickets',
     'Tickets TI - Automatización · resumenSemanal', null, 168),
    ('ticketera.informe-semanal', 'Informe semanal de TI',
     'Tickets TI - Automatización · informeSemanalAutomatico', null, 168),
    ('ticketera.informe-mensual', 'Informe mensual de TI',
     'Tickets TI - Automatización · informeMensualAutomatico', null, 744),
    ('facturas.problemas-envio-vitalica', 'Facturas con problemas de envío · Vitalica',
     null, 'Aviso de facturas electrónicas de Vitalica con problemas de envío.', 4),
    ('facturas.problemas-envio-camping44', 'Facturas con problemas de envío · Camping 44',
     null, 'Caído desde el 27/04/2026 según el último relevamiento.', null),
    ('logistica.tareas-fuera-de-plazo', 'Logística · tareas fuera de plazo',
     'Tablero de Logística', 'Correo diario con las tareas fuera de plazo.', 24),
    ('administracion.resumen-semanal', 'Administración · resumen semanal',
     'Tablero de Administración y Finanzas', 'Resumen de los lunes.', 168),
    ('creditos.refresco-motor-b2c', 'Créditos B2C · refresco del motor de crédito',
     null, null, null),
    ('cobranzas.reporte', 'Reporte de Cobranzas',
     null, 'Quedó como prueba el 28/08/2026: nunca pasó a producción.', null)
  ) as a(clave, nombre, donde_vive, descripcion, frecuencia)
on conflict (empresa_id, clave) do nothing;

-- =====================================================================
-- 4. Altas y bajas de accesos
-- =====================================================================

create table if not exists public.movimientos_accesos_ti (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  tipo text not null,
  persona_nombre text not null,
  persona_correo text,
  puesto_id uuid references public.puestos (id) on delete set null,
  -- De qué empresa del grupo es la persona. NUNCA va en `empresa_id`.
  empresa_de_la_persona_id uuid references public.empresas (id) on delete set null,
  fecha_efectiva date not null,
  ticket text,
  origen text,
  observaciones text,
  creado_por uuid references public.usuarios (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table public.movimientos_accesos_ti drop constraint if exists movimientos_accesos_ti_tipo;
alter table public.movimientos_accesos_ti add constraint movimientos_accesos_ti_tipo
  check (tipo in ('alta', 'baja'));

alter table public.movimientos_accesos_ti drop constraint if exists movimientos_accesos_ti_textos;
alter table public.movimientos_accesos_ti add constraint movimientos_accesos_ti_textos check (
  length(trim(persona_nombre)) between 3 and 160
  and (ticket is null or ticket ~ '^TI-[0-9]{4}$')
);

create table if not exists public.movimiento_accesos_pasos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  movimiento_id uuid not null references public.movimientos_accesos_ti (id) on delete cascade,
  orden integer not null,
  sistema text not null,
  descripcion text not null,
  estado text not null default 'pendiente',
  observacion text,
  resuelto_en timestamptz,
  resuelto_por uuid references public.usuarios (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

alter table public.movimiento_accesos_pasos drop constraint if exists movimiento_accesos_pasos_estado;
alter table public.movimiento_accesos_pasos add constraint movimiento_accesos_pasos_estado
  check (estado in ('pendiente', 'hecho', 'no_aplica'));

-- «No aplica» se explica: es lo que lee la auditoría cuando un paso que
-- la matriz pedía no se hizo.
alter table public.movimiento_accesos_pasos drop constraint if exists movimiento_accesos_pasos_motivo;
alter table public.movimiento_accesos_pasos add constraint movimiento_accesos_pasos_motivo
  check (estado <> 'no_aplica' or length(trim(coalesce(observacion, ''))) >= 3);

create index if not exists movimientos_accesos_ti_fecha
  on public.movimientos_accesos_ti (empresa_id, fecha_efectiva desc);
create index if not exists movimiento_accesos_pasos_movimiento
  on public.movimiento_accesos_pasos (movimiento_id, orden);

comment on table public.movimientos_accesos_ti is
  'Ingresos y desvinculaciones con lo que TI tiene que hacer en cada sistema (NC-2026-019).';

drop trigger if exists movimientos_accesos_ti_actualizacion on public.movimientos_accesos_ti;
create trigger movimientos_accesos_ti_actualizacion
  before update on public.movimientos_accesos_ti
  for each row execute function public.marcar_actualizacion();

drop trigger if exists movimiento_accesos_pasos_actualizacion on public.movimiento_accesos_pasos;
create trigger movimiento_accesos_pasos_actualizacion
  before update on public.movimiento_accesos_pasos
  for each row execute function public.marcar_actualizacion();

drop trigger if exists bitacora_movimientos_accesos_ti on public.movimientos_accesos_ti;
create trigger bitacora_movimientos_accesos_ti
  after insert or update or delete on public.movimientos_accesos_ti
  for each row execute function public.registrar_bitacora();

drop trigger if exists bitacora_movimiento_accesos_pasos on public.movimiento_accesos_pasos;
create trigger bitacora_movimiento_accesos_pasos
  after insert or update or delete on public.movimiento_accesos_pasos
  for each row execute function public.registrar_bitacora();

alter table public.movimientos_accesos_ti enable row level security;
alter table public.movimiento_accesos_pasos enable row level security;
revoke all on public.movimientos_accesos_ti from anon;
revoke all on public.movimiento_accesos_pasos from anon;
grant select, insert, update, delete on public.movimientos_accesos_ti to authenticated;
grant select, insert, update, delete on public.movimiento_accesos_pasos to authenticated;

drop policy if exists movimientos_accesos_ti_lectura on public.movimientos_accesos_ti;
create policy movimientos_accesos_ti_lectura on public.movimientos_accesos_ti
  for select to authenticated
  using (public.misma_empresa(empresa_id) and public.puede_ver('informatica'));

drop policy if exists movimientos_accesos_ti_gestion on public.movimientos_accesos_ti;
create policy movimientos_accesos_ti_gestion on public.movimientos_accesos_ti
  for all to authenticated
  using (public.misma_empresa(empresa_id) and public.puede_editar('informatica'))
  with check (public.misma_empresa(empresa_id) and public.puede_editar('informatica'));

drop policy if exists movimiento_accesos_pasos_lectura on public.movimiento_accesos_pasos;
create policy movimiento_accesos_pasos_lectura on public.movimiento_accesos_pasos
  for select to authenticated
  using (public.misma_empresa(empresa_id) and public.puede_ver('informatica'));

drop policy if exists movimiento_accesos_pasos_gestion on public.movimiento_accesos_pasos;
create policy movimiento_accesos_pasos_gestion on public.movimiento_accesos_pasos
  for all to authenticated
  using (public.misma_empresa(empresa_id) and public.puede_editar('informatica'))
  with check (public.misma_empresa(empresa_id) and public.puede_editar('informatica'));
