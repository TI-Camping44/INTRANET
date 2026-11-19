-- ---------------------------------------------------------------------
-- Informática · Accesos por puesto
--
-- LA NC-2026-019 ENCONTRÓ QUE LOS ACCESOS SE ASIGNABAN «DE FORMA
-- INTUITIVA»: no había un listado de qué le corresponde a cada puesto,
-- así que no había contra qué demostrar el mínimo privilegio que exige
-- el MP-SOP-07 (actividad 2: «los accesos se otorgan con el principio de
-- mínimo privilegio, según el F-SOP-02-01 Perfil de Resultados del
-- Puesto»). El relevamiento del 17 de noviembre lo confirmó: doce
-- usuarios de Odoo tenían Administrador en Nómina y Empleados, entre
-- ellos asesores comerciales.
--
-- Una fila por puesto, con lo que el puesto recibe en cada sistema. Va
-- en columnas y no en filas por sistema porque los sistemas son pocos y
-- fijos —Google Workspace, la Intranet y los módulos de Odoo que usa la
-- empresa— y así la matriz se lee como lo que es: una tabla de puestos
-- por sistemas. Un sistema nuevo es una columna nueva, en una migración.
--
-- LA MATRIZ NACE COMO PROPUESTA Y SE VALIDA. La carga inicial la armó TI
-- a partir de los puestos y del relevamiento; quién necesita qué lo
-- confirma el jefe de cada área. `estado` dice cuál de las dos cosas es
-- cada fila, y `validado_por` y `validado_en` quién y cuándo.
--
-- Vive en el módulo `informatica` de la matriz de permisos: la ven
-- Dirección y el Auditor, la edita el Administrador SGC.
-- ---------------------------------------------------------------------

create table if not exists public.accesos_por_puesto (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  puesto_id uuid not null references public.puestos (id) on delete cascade,
  -- Correo corporativo y Drive. Casi todos lo tienen; se declara igual,
  -- porque un puesto que no lo necesita es justamente lo que hay que ver.
  google_workspace boolean not null default true,
  -- El rol con el que entra a la Intranet. Nulo: no entra.
  intranet_rol public.rol_usuario,
  -- En qué empresa del Odoo multiempresa trabaja. Nulo: no tiene usuario.
  odoo_empresas text,
  odoo_ventas text not null default 'sin_acceso',
  odoo_inventario text not null default 'sin_acceso',
  odoo_compras text not null default 'sin_acceso',
  odoo_contabilidad text not null default 'sin_acceso',
  odoo_empleados text not null default 'sin_acceso',
  odoo_nomina text not null default 'sin_acceso',
  odoo_flota text not null default 'sin_acceso',
  odoo_reparaciones text not null default 'sin_acceso',
  -- Planillas, tableros y demás que no son un sistema de la lista.
  otros_accesos text,
  observaciones text,
  estado text not null default 'propuesta',
  validado_por uuid references public.usuarios (id) on delete set null,
  validado_en date,
  creado_por uuid references public.usuarios (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create unique index if not exists accesos_por_puesto_un_puesto
  on public.accesos_por_puesto (puesto_id);

alter table public.accesos_por_puesto drop constraint if exists accesos_por_puesto_niveles;
alter table public.accesos_por_puesto add constraint accesos_por_puesto_niveles check (
  odoo_ventas in ('sin_acceso', 'usuario', 'responsable', 'administrador')
  and odoo_inventario in ('sin_acceso', 'usuario', 'administrador')
  and odoo_compras in ('sin_acceso', 'usuario', 'administrador')
  and odoo_contabilidad in ('sin_acceso', 'solo_lectura', 'facturacion', 'responsable', 'administrador')
  and odoo_empleados in ('sin_acceso', 'responsable', 'administrador')
  and odoo_nomina in ('sin_acceso', 'responsable', 'administrador')
  and odoo_flota in ('sin_acceso', 'responsable', 'administrador')
  and odoo_reparaciones in ('sin_acceso', 'usuario', 'administrador')
);

alter table public.accesos_por_puesto drop constraint if exists accesos_por_puesto_empresas;
alter table public.accesos_por_puesto add constraint accesos_por_puesto_empresas
  check (odoo_empresas is null or odoo_empresas in ('camping44', 'vitalica', 'ambas'));

-- Sin empresa no hay usuario de Odoo, así que no puede haber módulos.
alter table public.accesos_por_puesto drop constraint if exists accesos_por_puesto_odoo_coherente;
alter table public.accesos_por_puesto add constraint accesos_por_puesto_odoo_coherente check (
  odoo_empresas is not null
  or (odoo_ventas = 'sin_acceso' and odoo_inventario = 'sin_acceso'
      and odoo_compras = 'sin_acceso' and odoo_contabilidad = 'sin_acceso'
      and odoo_empleados = 'sin_acceso' and odoo_nomina = 'sin_acceso'
      and odoo_flota = 'sin_acceso' and odoo_reparaciones = 'sin_acceso')
);

alter table public.accesos_por_puesto drop constraint if exists accesos_por_puesto_estado;
alter table public.accesos_por_puesto add constraint accesos_por_puesto_estado check (
  (estado = 'propuesta' and validado_en is null)
  or (estado = 'validada' and validado_en is not null)
);

comment on table public.accesos_por_puesto is
  'Matriz de accesos por puesto (MP-SOP-07, actividad 2): qué recibe cada puesto en '
  'Google Workspace, la Intranet y cada módulo de Odoo. Respuesta a la NC-2026-019.';

drop trigger if exists accesos_por_puesto_actualizacion on public.accesos_por_puesto;
create trigger accesos_por_puesto_actualizacion
  before update on public.accesos_por_puesto
  for each row execute function public.marcar_actualizacion();

-- Quién le cambió los accesos a un puesto, y cuándo, es dato de
-- auditoría: es exactamente lo que va a preguntar la próxima.
drop trigger if exists bitacora_accesos_por_puesto on public.accesos_por_puesto;
create trigger bitacora_accesos_por_puesto
  after insert or update or delete on public.accesos_por_puesto
  for each row execute function public.registrar_bitacora();

alter table public.accesos_por_puesto enable row level security;
revoke all on public.accesos_por_puesto from anon;
grant select, insert, update, delete on public.accesos_por_puesto to authenticated;

drop policy if exists accesos_por_puesto_lectura on public.accesos_por_puesto;
create policy accesos_por_puesto_lectura on public.accesos_por_puesto
  for select to authenticated
  using (public.misma_empresa(empresa_id) and public.puede_ver('informatica'));

drop policy if exists accesos_por_puesto_gestion on public.accesos_por_puesto;
create policy accesos_por_puesto_gestion on public.accesos_por_puesto
  for all to authenticated
  using (public.misma_empresa(empresa_id) and public.puede_editar('informatica'))
  with check (public.misma_empresa(empresa_id) and public.puede_editar('informatica'));
