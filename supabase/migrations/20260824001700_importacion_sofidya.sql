-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 017 · Soporte para la importacion unica desde Sofidya
-- =====================================================================
-- Sofidya expone su informacion por comandos. La mayoria tiene una tabla
-- equivalente en este esquema; dos casos no la tienen:
--
--   · get_personas: las personas no se pueden insertar en public.usuarios
--     porque ese identificador proviene de auth.users, que se crea recien
--     en el primer ingreso con Google. Se guardan aparte y se vinculan
--     por correo cuando la persona ingresa.
--   · get_inf_listados_predef: son listados propios de Sofidya sin
--     equivalente directo. Se conservan en crudo para no perder nada.

create table public.personas_sofidya (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  codigo_externo text not null,
  nombre_completo text not null,
  correo text,
  documento text,
  puesto_nombre text,
  sede_nombre text,
  area text,
  activo boolean not null default true,
  -- Se completa cuando la persona ingresa por primera vez al sistema.
  usuario_id uuid references public.usuarios (id) on delete set null,
  importado_en timestamptz not null default now()
);

create unique index personas_sofidya_codigo_unico
  on public.personas_sofidya (empresa_id, codigo_externo);
create index personas_sofidya_correo_idx on public.personas_sofidya (lower(correo));

comment on table public.personas_sofidya is
  'Nomina importada desde Sofidya, a la espera del primer ingreso de cada persona.';

-- ---------------------------------------------------------------------
-- Bitacora de cada corrida del script de importacion.
-- ---------------------------------------------------------------------
create table public.importaciones_sofidya (
  id bigint generated always as identity primary key,
  comando text not null,
  registros_recibidos integer not null default 0,
  registros_importados integer not null default 0,
  tabla_destino text,
  observacion text,
  datos_crudos jsonb,
  ejecutado_en timestamptz not null default now()
);

create index importaciones_sofidya_comando_idx
  on public.importaciones_sofidya (comando, ejecutado_en desc);

comment on table public.importaciones_sofidya is
  'Registro de cada corrida del script scripts/migrar-sofidya.ts.';

-- ---------------------------------------------------------------------
-- Al crearse un usuario se lo vincula con su ficha importada, si existe.
-- ---------------------------------------------------------------------
create or replace function public.vincular_persona_sofidya()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.personas_sofidya
     set usuario_id = new.id
   where usuario_id is null
     and lower(correo) = lower(new.correo);

  return new;
end;
$$;

create trigger usuarios_vincular_persona_sofidya
  after insert on public.usuarios
  for each row execute function public.vincular_persona_sofidya();

-- ---------------------------------------------------------------------
-- RLS: ambas tablas son de administracion del sistema.
-- ---------------------------------------------------------------------
alter table public.personas_sofidya enable row level security;
alter table public.importaciones_sofidya enable row level security;

revoke all on public.personas_sofidya from anon;
revoke all on public.importaciones_sofidya from anon;
grant select, insert, update, delete on public.personas_sofidya to authenticated;
grant select on public.importaciones_sofidya to authenticated;

create policy "personas_sofidya_lectura" on public.personas_sofidya
  for select to authenticated
  using (public.puede_gestionar() and public.misma_empresa(empresa_id));

create policy "personas_sofidya_gestion" on public.personas_sofidya
  for all to authenticated
  using (public.es_admin_sgc() and public.misma_empresa(empresa_id))
  with check (public.es_admin_sgc() and public.misma_empresa(empresa_id));

create policy "importaciones_sofidya_lectura" on public.importaciones_sofidya
  for select to authenticated
  using (public.es_admin_sgc() or public.es_auditor());
