-- ---------------------------------------------------------------------
-- Una auditoria puede abarcar varios procesos
--
-- `auditorias.proceso_id` admitia uno solo, y una auditoria interna del
-- SGC recorre cinco o seis. Quien planificaba tenia que elegir uno y
-- escribir los demas en el alcance, que es texto libre y no se puede
-- contar ni filtrar.
--
-- Se agrega la tabla de union. `proceso_id` se conserva por ahora: lo
-- usan el listado y la ficha, y retirarlo es una migracion aparte una vez
-- que todo lea de la tabla nueva. Las auditorias ya cargadas se pasan a
-- la tabla de union para que no queden con un proceso invisible.
--
-- Tambien se normalizan los tipos retirados: 'proveedor' pasa a
-- 'terceros', que es como lo llama Calidad. 'seguimiento' se deja: no es
-- lo mismo que ninguno de los cuatro nuevos y, si hay alguna cargada,
-- cambiarla seria inventar.
-- ---------------------------------------------------------------------

update public.auditorias set tipo = 'terceros' where tipo = 'proveedor';

create table if not exists public.auditoria_procesos (
  auditoria_id uuid not null references public.auditorias (id) on delete cascade,
  proceso_id uuid not null references public.procesos (id) on delete cascade,
  creado_en timestamptz not null default now(),
  primary key (auditoria_id, proceso_id)
);

comment on table public.auditoria_procesos is
  'Procesos que abarca cada auditoria. Reemplaza a auditorias.proceso_id, que admitia uno solo.';

create index if not exists auditoria_procesos_proceso_idx
  on public.auditoria_procesos (proceso_id);

-- Lo ya cargado, a la tabla nueva.
insert into public.auditoria_procesos (auditoria_id, proceso_id)
select a.id, a.proceso_id
  from public.auditorias a
 where a.proceso_id is not null
on conflict do nothing;

-- ---------------------------------------------------------------------
-- RLS. Una tabla nueva sin politicas es un error, no un pendiente.
-- ---------------------------------------------------------------------
alter table public.auditoria_procesos enable row level security;

-- Y su grant: sin esto PostgreSQL corta antes de evaluar las politicas y
-- la pantalla queda vacia sin decir por que. La tabla no entra en el
-- bucle de ..._politicas_rls.sql, asi que lo necesita explicito.
grant select, insert, update, delete on public.auditoria_procesos to authenticated;

-- Se lee lo que se puede leer de su auditoria, y se escribe lo que se
-- puede escribir de ella: la condicion se delega en la propia fila de
-- `auditorias`, que ya tiene sus politicas.
-- Se sueltan antes de crearlas: `create policy` no admite
-- `if not exists` y la migracion tiene que poder volver a correrse.
drop policy if exists auditoria_procesos_lectura on public.auditoria_procesos;
drop policy if exists auditoria_procesos_gestion on public.auditoria_procesos;

create policy auditoria_procesos_lectura on public.auditoria_procesos
  for select to authenticated
  using (
    exists (select 1 from public.auditorias a where a.id = auditoria_procesos.auditoria_id)
  );

create policy auditoria_procesos_gestion on public.auditoria_procesos
  for all to authenticated
  using (
    exists (
      select 1
        from public.auditorias a
       where a.id = auditoria_procesos.auditoria_id
         and misma_empresa(a.empresa_id)
         and (es_admin_sgc() or es_auditor() or a.auditor_lider_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1
        from public.auditorias a
       where a.id = auditoria_procesos.auditoria_id
         and misma_empresa(a.empresa_id)
         and (es_admin_sgc() or es_auditor() or a.auditor_lider_id = auth.uid())
    )
  );

-- Trazabilidad: la tabla tiene valor de auditoria, asi que lleva su
-- disparador de bitacora como el resto.
drop trigger if exists bitacora_auditoria_procesos on public.auditoria_procesos;
create trigger bitacora_auditoria_procesos
  after insert or update or delete on public.auditoria_procesos
  for each row execute function public.registrar_bitacora();
