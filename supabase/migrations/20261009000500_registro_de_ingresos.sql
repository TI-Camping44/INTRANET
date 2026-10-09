-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- Registro de ingresos al sistema
-- =====================================================================
-- Hasta ahora lo unico que quedaba de un ingreso era
-- `usuarios.ultimo_ingreso`, que se pisa cada vez. Alcanza para saber si
-- alguien entra; no alcanza para una auditoria, que pregunta cuando
-- entro cada quien y cuantas veces.
--
-- POR QUE UN DISPARADOR Y NO UN INSERT DE LA APLICACION. Es la misma
-- razon que la bitacora: si lo escribe la aplicacion, cualquier camino
-- que no pase por ahi queda sin registrar, y un registro de accesos con
-- agujeros no sirve para auditar. `auth.sessions` recibe una fila por
-- cada ingreso, lo haga quien lo haga y por donde sea, asi que el
-- disparador va ahi.
--
-- `auth.audit_log_entries` hubiera sido la fuente natural, pero en este
-- proyecto esta vacia: Supabase la purga. Por eso se guarda aca.
--
-- NO SE PUEDE BORRAR NI EDITAR. Igual que la bitacora: solo lectura para
-- quien audita, y ninguna politica de `update` o `delete`.
-- =====================================================================

create table public.ingresos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  ocurrido_en timestamptz not null default now(),

  -- Con que entro. Sirve para distinguir un ingreso desde el celular en
  -- el piso de venta de uno desde una computadora del deposito.
  agente text,
  ip text
);

create index ingresos_usuario_idx on public.ingresos (usuario_id, ocurrido_en desc);
create index ingresos_fecha_idx on public.ingresos (ocurrido_en desc);

comment on table public.ingresos is
  'Un registro por ingreso al sistema. Lo alimenta un disparador sobre auth.sessions.';

alter table public.ingresos enable row level security;

-- Solo lectura, y solo para quien audita. Nadie escribe por aca: la
-- unica escritura viene del disparador, que es SECURITY DEFINER.
grant select on public.ingresos to authenticated;

create policy ingresos_lectura on public.ingresos
  for select using (public.es_admin_sgc() or public.es_auditor() or public.es_direccion());

-- ---------------------------------------------------------------------
-- El disparador.
--
-- Si la persona todavia no tiene perfil no se anota nada: la clave
-- foranea fallaria y, peor, haria fallar el ingreso. El perfil se crea
-- en el mismo momento por `crear_perfil_usuario()`, asi que esto solo
-- protege contra un orden inesperado.
-- ---------------------------------------------------------------------
create or replace function public.registrar_ingreso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.usuarios where id = new.user_id) then
    insert into public.ingresos (usuario_id, ocurrido_en, agente, ip)
    values (new.user_id, coalesce(new.created_at, now()), new.user_agent, host(new.ip));
  end if;

  return new;
end;
$$;

create trigger al_iniciar_sesion
  after insert on auth.sessions
  for each row execute function public.registrar_ingreso();
