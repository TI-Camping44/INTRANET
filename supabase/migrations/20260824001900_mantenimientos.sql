-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 019 · Ciclo de mantenimiento de activos
-- =====================================================================
-- Al ejecutar un mantenimiento preventivo hay que actualizar el activo y
-- agendar el siguiente. Se resuelve con un disparador y no en la
-- aplicacion para que la agenda quede consistente aunque el mantenimiento
-- se cierre desde un script o desde el panel de Supabase.

create or replace function public.sincronizar_activo_al_mantener()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activo public.activos%rowtype;
begin
  -- Solo interesa el paso a ejecutado.
  if new.estado <> 'ejecutado' or (tg_op = 'UPDATE' and old.estado = 'ejecutado') then
    return new;
  end if;

  select * into v_activo from public.activos where id = new.activo_id;
  if not found then
    return new;
  end if;

  update public.activos
     set fecha_ultimo_mantenimiento = coalesce(new.fecha_ejecucion, current_date),
         fecha_proximo_mantenimiento =
           case
             when v_activo.requiere_mantenimiento
              and v_activo.frecuencia_mantenimiento_dias is not null
             then coalesce(new.fecha_ejecucion, current_date)
                  + v_activo.frecuencia_mantenimiento_dias
             else null
           end,
         -- Un activo que estaba en mantenimiento vuelve a estar operativo.
         estado = case when v_activo.estado = 'en_mantenimiento'
                       then 'operativo'::estado_activo
                       else v_activo.estado end
   where id = new.activo_id;

  return new;
end;
$$;

create trigger mantenimientos_sincronizar_activo
  after insert or update of estado on public.mantenimientos
  for each row execute function public.sincronizar_activo_al_mantener();

-- ---------------------------------------------------------------------
-- Los mantenimientos programados cuya fecha ya paso quedan vencidos.
-- Lo llama el trabajo programado de alertas, antes de avisar.
-- ---------------------------------------------------------------------
create or replace function public.marcar_mantenimientos_vencidos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_afectados integer;
begin
  update public.mantenimientos
     set estado = 'vencido'
   where estado = 'programado'
     and fecha_programada < current_date;

  get diagnostics v_afectados = row_count;
  return v_afectados;
end;
$$;

grant execute on function public.marcar_mantenimientos_vencidos() to authenticated;

-- ---------------------------------------------------------------------
-- Agenda del proximo mantenimiento al dar de alta un activo que lo
-- requiere y todavia no tiene fecha.
-- ---------------------------------------------------------------------
create or replace function public.agendar_primer_mantenimiento()
returns trigger
language plpgsql
as $$
begin
  if new.requiere_mantenimiento
     and new.frecuencia_mantenimiento_dias is not null
     and new.fecha_proximo_mantenimiento is null then
    new.fecha_proximo_mantenimiento :=
      coalesce(new.fecha_ultimo_mantenimiento, current_date)
      + new.frecuencia_mantenimiento_dias;
  end if;

  -- Si deja de requerir mantenimiento, la agenda se limpia.
  if not new.requiere_mantenimiento then
    new.fecha_proximo_mantenimiento := null;
  end if;

  return new;
end;
$$;

create trigger activos_agendar_mantenimiento
  before insert or update of requiere_mantenimiento, frecuencia_mantenimiento_dias
  on public.activos
  for each row execute function public.agendar_primer_mantenimiento();
