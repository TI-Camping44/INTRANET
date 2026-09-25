-- =====================================================================
-- Intranet - Camping 44 S.A.
-- El resumen de ventas, guardado, en vez de leido en cada pantalla
-- =====================================================================
-- POR QUE. La pantalla «Mis ventas» leia las dos hojas publicadas del
-- informe comercial en el momento de dibujarse. Medido: la hoja DATA son
-- 5,5 MB y 15.594 lineas y Google tarda 13 segundos en generar su CSV;
-- CONFIG tarda 14. Eso contradice la regla del proyecto —nada que dependa
-- de un servicio externo debe demorar la respuesta que ve la persona— y
-- ademas deja la pantalla a merced de que Google conteste.
--
-- Ahora lo lee un trabajo programado y deja el resultado aca. La pantalla
-- consulta una tabla chica y responde al instante; si Google se cae, se
-- sigue viendo el ultimo dato bueno con su fecha, en vez de un error.
--
-- Y EL PERMISO VUELVE A RLS. Mientras el dato salia de un CSV, Postgres
-- no lo veia y el filtro de que ve cada jefe tenia que resolverse en el
-- componente de servidor. Con la tabla, el permiso es una politica, que
-- es donde el proyecto dice que tienen que resolverse los permisos.

-- ---------------------------------------------------------------------
-- Una fila por vendedor y mes
-- ---------------------------------------------------------------------
create table if not exists public.ventas_mensuales (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  anio integer not null,
  mes integer not null,

  -- El vendedor tal como figura en la planilla, ya normalizado.
  vendedor text not null,

  -- A quien corresponde en la intranet, si esa persona ya entro alguna
  -- vez. LO RESUELVE EL TRABAJO, no una politica: la union tolera que el
  -- nombre este mas corto en una hoja que en la otra, y esa regla vive en
  -- TypeScript, donde esta probada. Nulo = ese vendedor todavia no tiene
  -- usuario, y entonces su fila solo la ven los jefes y Direccion.
  usuario_id uuid references public.usuarios (id) on delete set null,

  canal text not null default '',
  meta numeric,
  venta numeric not null default 0,
  devoluciones numeric not null default 0,
  actualizado_en timestamptz not null default now(),

  constraint ventas_mensuales_mes_valido check (mes between 1 and 12)
);

create unique index if not exists ventas_mensuales_unico
  on public.ventas_mensuales (empresa_id, anio, mes, vendedor);
create index if not exists ventas_mensuales_usuario_idx
  on public.ventas_mensuales (usuario_id);
create index if not exists ventas_mensuales_periodo_idx
  on public.ventas_mensuales (empresa_id, anio, mes);

comment on table public.ventas_mensuales is
  'Resumen por vendedor y mes que deja el trabajo programado leyendo la '
  'planilla del informe comercial. La intranet no recalcula: suma lo que '
  'el informe ya resolvio.';

-- ---------------------------------------------------------------------
-- El estado de la ultima sincronizacion
-- ---------------------------------------------------------------------
-- Va aparte porque no es por vendedor: es el corte del informe, los dias
-- habiles y de cuando es el dato. La pantalla lo necesita para decir
-- «actualizado al...», que es lo que evita que alguien tome una decision
-- creyendo que mira el minuto a minuto.
create table if not exists public.ventas_sincronizacion (
  empresa_id uuid primary key references public.empresas (id) on delete cascade,
  mes_en_curso integer not null,
  anio_en_curso integer not null,
  dias_mes numeric not null default 0,
  dias_transcurridos numeric not null default 0,
  filas integer not null default 0,
  actualizado_en timestamptz not null default now(),

  -- Del ultimo intento, haya salido bien o mal. Un trabajo que falla en
  -- silencio es peor que uno que no corre: al menos el segundo se nota.
  ultimo_intento_en timestamptz,
  ultimo_error text
);

comment on table public.ventas_sincronizacion is
  'Estado de la ultima lectura de la planilla comercial: mes de corte, '
  'dias habiles, cuando se actualizo y el error del ultimo intento si lo hubo.';

-- ---------------------------------------------------------------------
-- Que canales puede ver quien esta mirando
-- ---------------------------------------------------------------------
-- SECURITY DEFINER porque la politica de ventas_mensuales necesita leer
-- usuarios, y sin esto la lectura de usuarios pasaria por su propia
-- politica. Es el mismo motivo por el que son SECURITY DEFINER las demas
-- funciones de apoyo de RLS.
create or replace function public.canales_de_ventas_visibles()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(ventas_canales, '{}')::text[]
    from public.usuarios
   where id = auth.uid();
$$;

grant execute on function public.canales_de_ventas_visibles() to authenticated;

-- ---------------------------------------------------------------------
-- RLS, grants y politicas
-- ---------------------------------------------------------------------
-- Tablas nuevas: el bucle de ..._politicas_rls.sql corrio sobre las que
-- existian entonces, asi que van explicitas.
--
-- SOLO SE OTORGA SELECT. Estas tablas las escribe unicamente el trabajo
-- programado, que corre con la clave de servicio e ignora RLS. Nadie
-- desde la interfaz tiene por que poder escribir aca, y no otorgarlo es
-- mas simple y mas seguro que otorgarlo y despues prohibirlo con una
-- politica.
alter table public.ventas_mensuales enable row level security;
revoke all on public.ventas_mensuales from anon;
revoke all on public.ventas_mensuales from authenticated;
grant select on public.ventas_mensuales to authenticated;

drop policy if exists "ventas_mensuales_lectura" on public.ventas_mensuales;
create policy "ventas_mensuales_lectura" on public.ventas_mensuales
  for select to authenticated
  using (
    public.misma_empresa(empresa_id)
    and (
      -- Lo propio.
      usuario_id = auth.uid()
      -- Direccion ve todo: es el punto del rol.
      or public.es_direccion()
      -- Un jefe ve los canales que le asignaron.
      or canal = any (public.canales_de_ventas_visibles())
    )
  );

alter table public.ventas_sincronizacion enable row level security;
revoke all on public.ventas_sincronizacion from anon;
revoke all on public.ventas_sincronizacion from authenticated;
grant select on public.ventas_sincronizacion to authenticated;

-- Esta no lleva ventas de nadie: es la fecha del dato y los dias habiles.
-- La puede leer cualquiera de la empresa.
drop policy if exists "ventas_sincronizacion_lectura" on public.ventas_sincronizacion;
create policy "ventas_sincronizacion_lectura" on public.ventas_sincronizacion
  for select to authenticated using (public.misma_empresa(empresa_id));

-- ---------------------------------------------------------------------
-- Traer la planilla a mano
-- ---------------------------------------------------------------------
-- El trabajo programado corre con la clave de servicio e ignora RLS, pero
-- Calidad tiene que poder traer la planilla sin esperar al dia siguiente,
-- igual que el boton «Reindexar» de Documentacion. Se resuelve con
-- politica y no con la clave de servicio: la clave de servicio nunca
-- atiende una peticion de la interfaz.
grant insert, update, delete on public.ventas_mensuales to authenticated;
grant insert, update, delete on public.ventas_sincronizacion to authenticated;

drop policy if exists "ventas_mensuales_escritura" on public.ventas_mensuales;
create policy "ventas_mensuales_escritura" on public.ventas_mensuales
  for all to authenticated
  using (public.es_admin_sgc() and public.misma_empresa(empresa_id))
  with check (public.es_admin_sgc() and public.misma_empresa(empresa_id));

drop policy if exists "ventas_sincronizacion_escritura" on public.ventas_sincronizacion;
create policy "ventas_sincronizacion_escritura" on public.ventas_sincronizacion
  for all to authenticated
  using (public.es_admin_sgc() and public.misma_empresa(empresa_id))
  with check (public.es_admin_sgc() and public.misma_empresa(empresa_id));
