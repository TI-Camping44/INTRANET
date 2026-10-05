-- =====================================================================
-- Intranet - Camping 44 S.A.
-- El cierre de la no conformidad se deriva de sus acciones
-- =====================================================================
-- Hasta ahora una persona elegia «Cerrar en plazo» o «Cerrar fuera de
-- plazo» con dos botones. Calidad lo cambio el 5 de octubre: el cierre no
-- es una opinion, es una consecuencia.
--
-- LA REGLA: cuando TODAS las acciones correctivas de la desviacion estan
-- ejecutadas, la no conformidad se cierra sola. Y se cierra EN PLAZO si
-- todas se ejecutaron dentro de su fecha; si una sola se paso, se cierra
-- FUERA DE PLAZO. Nadie lo elige.
--
-- Va en el disparador que ya sincronizaba abierta/en tratamiento, porque
-- es el mismo hecho mirado entero: el estado de la desviacion lo dicen
-- sus acciones. Y va en la base y no en la aplicacion para que valga
-- igual si la accion se cierra desde la pantalla, desde un script o desde
-- el panel de Supabase.
--
-- Reabrir una accion deshace el cierre: la desviacion vuelve a «en
-- tratamiento» y `controlar_cierre_nc()` limpia sola la fecha de cierre y
-- el indicador de plazo.
--
-- EL DISPARADOR QUE YA EXISTIA SOLO ESCUCHABA ALTAS Y BAJAS, asi que
-- ejecutar una accion no lo despertaba nunca. Se agrega otro para los
-- cambios, apuntando a la misma funcion, en vez de rehacer el primero:
-- son el mismo comportamiento y asi la migracion no toca lo que ya
-- funciona.
-- ---------------------------------------------------------------------

create or replace function public.sincronizar_estado_nc_por_accion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nc uuid;
  v_cuantas integer;
  v_abiertas integer;
  v_fuera_de_plazo integer;
begin
  v_nc := coalesce(new.no_conformidad_id, old.no_conformidad_id);

  select count(*),
         count(*) filter (where estado not in ('ejecutada', 'verificada')),
         count(*) filter (where estado in ('ejecutada', 'verificada')
                            and ejecucion_en_plazo is not true)
    into v_cuantas, v_abiertas, v_fuera_de_plazo
    from public.nc_acciones
   where no_conformidad_id = v_nc;

  -- Sin ninguna accion la desviacion vuelve a estar abierta: todavia no
  -- se la respondio.
  if v_cuantas = 0 then
    update public.no_conformidades
       set estado = 'abierta'
     where id = v_nc and estado <> 'abierta';
    return coalesce(new, old);
  end if;

  if v_abiertas > 0 then
    -- Queda al menos una accion sin ejecutar: en tratamiento. Si venia de
    -- cerrada (se reabrio una accion), el cierre se deshace.
    update public.no_conformidades
       set estado = 'en_tratamiento'
     where id = v_nc and estado <> 'en_tratamiento';
    return coalesce(new, old);
  end if;

  -- Todas ejecutadas: la desviacion se cierra sola, y el plazo sale de
  -- como se ejecutaron.
  update public.no_conformidades
     set estado = 'cerrada',
         cierre_en_plazo = (v_fuera_de_plazo = 0),
         fecha_cierre = coalesce(fecha_cierre, current_date)
   where id = v_nc
     and (estado <> 'cerrada' or cierre_en_plazo is distinct from (v_fuera_de_plazo = 0));

  return coalesce(new, old);
end;
$$;

comment on function public.sincronizar_estado_nc_por_accion is
  'Mantiene el estado de la no conformidad a partir de sus acciones: sin '
  'acciones abierta, con alguna pendiente en tratamiento, y con todas '
  'ejecutadas cerrada, en plazo o fuera de plazo segun se hayan ejecutado.';

-- El disparador que faltaba: sin este, una accion que pasa a «ejecutada»
-- no mueve el estado de su desviacion.
create trigger nc_acciones_sincronizar_al_actualizar
after update on public.nc_acciones
for each row execute function public.sincronizar_estado_nc_por_accion();
