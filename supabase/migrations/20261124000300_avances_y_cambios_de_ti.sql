-- ---------------------------------------------------------------------
-- Informática · Avances y cambios de TI
--
-- EL TRABAJO DEL ÁREA NO TENÍA DÓNDE QUEDAR ESCRITO EN LA INTRANET. Lo
-- pidió el Responsable de TI el 24 de noviembre, después de corregir una
-- automatización de Odoo que había generado 50 traslados erróneos
-- (TI-0142): quedó en la ticketera y en ningún otro lado, porque la
-- Intranet solo tenía controles periódicos y la matriz de accesos. La
-- única salida era cargarlo como no conformidad, y un cambio de sistema
-- no es una desviación.
--
-- Es un registro y nada más: qué se hizo, en qué sistema, para qué
-- empresa del grupo, cuándo y con qué ticket. No tiene estados ni
-- plazos —eso vive en la ticketera, que es donde se pide y se sigue el
-- trabajo—; esto es lo que quedó hecho, para que Dirección y la
-- auditoría puedan ver qué cambió en los sistemas sin pedirle a nadie
-- que lo cuente.
--
-- EL TICKET ES TEXTO Y OPCIONAL. Hay cambios que no nacen de un pedido
-- —un mantenimiento, una corrección que encontró el propio TI— y la
-- ticketera vive en una planilla de Google, fuera de la base, así que
-- no hay a qué apuntar con una clave foránea.
--
-- Usa el módulo `informatica` de la matriz: lo ven Dirección y el
-- Auditor y lo edita el Administrador SGC por su piso.
-- ---------------------------------------------------------------------

create table if not exists public.avances_ti (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  fecha date not null,
  titulo text not null,
  tipo text not null,
  sistema text not null,
  -- De qué empresa del grupo habla el cambio. Nulo quiere decir «del
  -- grupo»: un cambio en Google Workspace o en la propia intranet vale
  -- para las dos. NUNCA va en `empresa_id`, que es el inquilino de RLS.
  empresa_afectada_id uuid references public.empresas (id) on delete set null,
  ticket text,
  descripcion text not null,
  -- Qué cambia para la gente: a quién afecta y qué tiene que hacer
  -- distinto. Opcional, porque muchos cambios no se notan desde afuera.
  impacto text,
  es_demostracion boolean not null default false,
  creado_por uuid references public.usuarios (id) on delete set null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Las dos listas viven también en `lib/avances-ti.ts`: si cambian,
-- cambian en los dos lados.
alter table public.avances_ti drop constraint if exists avances_ti_tipo;
alter table public.avances_ti add constraint avances_ti_tipo check (tipo in (
  'implementacion', 'mejora', 'correccion', 'configuracion', 'incidente', 'mantenimiento'
));

alter table public.avances_ti drop constraint if exists avances_ti_sistema;
alter table public.avances_ti add constraint avances_ti_sistema check (sistema in (
  'odoo', 'google_workspace', 'apps_script', 'intranet', 'sitios_web',
  'red_e_infraestructura', 'equipos', 'otro'
));

alter table public.avances_ti drop constraint if exists avances_ti_textos;
alter table public.avances_ti add constraint avances_ti_textos check (
  length(trim(titulo)) between 5 and 200
  and length(trim(descripcion)) >= 10
);

-- El formato de la ticketera: TI-0142.
alter table public.avances_ti drop constraint if exists avances_ti_ticket;
alter table public.avances_ti add constraint avances_ti_ticket
  check (ticket is null or ticket ~ '^TI-[0-9]{4}$');

create index if not exists avances_ti_fecha on public.avances_ti (empresa_id, fecha desc);

comment on table public.avances_ti is
  'Registro de los avances y cambios que hace el área de TI en los sistemas. '
  'El seguimiento del pedido vive en la ticketera; esto es lo que quedó hecho.';

-- ---------------------------------------------------------------------
-- Disparadores: actualización y bitácora. Qué cambió en un sistema y
-- quién lo escribió es justo lo que pregunta una auditoría.
-- ---------------------------------------------------------------------

drop trigger if exists avances_ti_actualizacion on public.avances_ti;
create trigger avances_ti_actualizacion
  before update on public.avances_ti
  for each row execute function public.marcar_actualizacion();

drop trigger if exists bitacora_avances_ti on public.avances_ti;
create trigger bitacora_avances_ti
  after insert or update or delete on public.avances_ti
  for each row execute function public.registrar_bitacora();

-- ---------------------------------------------------------------------
-- RLS y grant. Fuera del bucle de `..._politicas_rls.sql`, así que el
-- grant va explícito.
-- ---------------------------------------------------------------------

alter table public.avances_ti enable row level security;

revoke all on public.avances_ti from anon;
grant select, insert, update, delete on public.avances_ti to authenticated;

drop policy if exists avances_ti_lectura on public.avances_ti;
create policy avances_ti_lectura on public.avances_ti
  for select to authenticated
  using (public.misma_empresa(empresa_id) and public.puede_ver('informatica'));

drop policy if exists avances_ti_gestion on public.avances_ti;
create policy avances_ti_gestion on public.avances_ti
  for all to authenticated
  using (public.misma_empresa(empresa_id) and public.puede_editar('informatica'))
  with check (public.misma_empresa(empresa_id) and public.puede_editar('informatica'));
