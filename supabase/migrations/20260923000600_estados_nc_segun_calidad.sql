-- ---------------------------------------------------------------------
-- La linea de estados de la no conformidad, segun Calidad (23/09)
--
-- Cuatro estados, en este orden:
--
--   1 · Abierto              rojo     automatico al registrarla
--   2 · En proceso           naranja  automatico al cargarle una AC
--   3 · Cerrado en plazo     verde    manual, AC dentro de los 5 dias
--   4 · Cerrado fuera de plazo gris   manual, AC despues de los 5 dias
--
-- No se agregan valores al enumerado. Los dos cierres son el mismo
-- estado 'cerrada' con una columna que dice si entro en plazo, y se hace
-- asi por una razon concreta: 'cerrada' esta consultado en el listado,
-- en el panel, en los reportes y en los indicadores. Partirlo en dos
-- valores obligaria a tocar todos esos lugares para que sigan contando
-- lo mismo, y cada uno es una oportunidad de olvidarse de uno.
--
-- ATENCION · Esto cambia una regla de ayer. El 22 de septiembre se habia
-- definido que responder la accion correctiva CERRABA la no conformidad
-- automaticamente. La especificacion de hoy dice que cargar una AC la
-- pasa a «En proceso» y que el cierre lo elige una persona. Las dos
-- cosas no pueden convivir: si cargar la AC cerrara, «En proceso» no
-- existiria nunca. Queda la regla nueva.
-- ---------------------------------------------------------------------

alter table public.no_conformidades
  add column if not exists cierre_en_plazo boolean;

comment on column public.no_conformidades.cierre_en_plazo is
  'Solo cuando estado = cerrada. true: la accion correctiva llego dentro de los 5 dias '
  'corridos desde la deteccion. false: llego despues. El sistema lo sugiere comparando '
  'fechas, pero lo elige la persona que cierra.';

-- Lo ya cerrado se clasifica con la misma regla, para que la linea de
-- estados no muestre un cierre a medias en lo que ya estaba.
update public.no_conformidades
   set cierre_en_plazo = (fecha_cierre - fecha_deteccion) <= 5
 where estado = 'cerrada'
   and fecha_cierre is not null
   and cierre_en_plazo is null;

-- ---------------------------------------------------------------------
-- 1 · «En proceso» es automatico: lo dispara la primera accion correctiva
-- ---------------------------------------------------------------------
-- Va en un disparador y no en la accion de servidor para que valga por
-- cualquier via de escritura, que es el criterio del proyecto. Y es
-- SECURITY DEFINER porque quien carga la AC puede no tener permiso de
-- edicion sobre la no conformidad: RLS dejaria el update en cero filas y
-- la desviacion se quedaria en «Abierto» sin que nadie se entere.
create or replace function public.sincronizar_estado_nc_por_accion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nc uuid;
  v_cuantas integer;
begin
  v_nc := coalesce(new.no_conformidad_id, old.no_conformidad_id);

  select count(*) into v_cuantas
    from public.nc_acciones
   where no_conformidad_id = v_nc;

  if v_cuantas > 0 then
    -- Solo desde «Abierto». Una desviacion ya cerrada no se reabre
    -- porque se le agregue otra accion.
    update public.no_conformidades
       set estado = 'en_tratamiento'
     where id = v_nc
       and estado = 'abierta';
  else
    -- Se borro la ultima: vuelve a «Abierto», que es lo que es.
    update public.no_conformidades
       set estado = 'abierta'
     where id = v_nc
       and estado = 'en_tratamiento';
  end if;

  return coalesce(new, old);
end;
$$;

comment on function public.sincronizar_estado_nc_por_accion is
  'Pasa la no conformidad a «En proceso» cuando se le carga la primera accion correctiva, '
  'y la devuelve a «Abierto» si se borra la ultima. Los dos estados son automaticos: la '
  'persona no los elige.';

drop trigger if exists nc_acciones_sincronizar_estado on public.nc_acciones;
create trigger nc_acciones_sincronizar_estado
  after insert or delete on public.nc_acciones
  for each row execute function public.sincronizar_estado_nc_por_accion();

-- Lo ya cargado se pone al dia con la regla nueva.
update public.no_conformidades n
   set estado = 'en_tratamiento'
 where n.estado = 'abierta'
   and exists (select 1 from public.nc_acciones a where a.no_conformidad_id = n.id);

-- ---------------------------------------------------------------------
-- 2 · El cierre: manual, y solo con una accion correctiva cargada
-- ---------------------------------------------------------------------
-- Reemplaza al control anterior, que exigia el descargo y los cinco
-- porques y reservaba el cierre a Calidad. La regla de Calidad ahora es
-- una sola: no se cierra una desviacion que no tiene accion correctiva.
-- Quien cierra es quien puede editarla, que RLS ya acota.
create or replace function public.controlar_cierre_nc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado = 'cerrada' and old.estado is distinct from 'cerrada' then
    if not exists (
      select 1 from public.nc_acciones a where a.no_conformidad_id = new.id
    ) then
      raise exception
        'No se puede cerrar una no conformidad sin ninguna accion correctiva cargada.'
        using errcode = '23514';
    end if;

    if new.cierre_en_plazo is null then
      raise exception
        'Indique si el cierre fue en plazo o fuera de plazo.'
        using errcode = '23514';
    end if;

    if new.fecha_cierre is null then
      new.fecha_cierre := current_date;
    end if;
  end if;

  -- Reabrir limpia la clasificacion del cierre: si vuelve a cerrarse,
  -- se decide de nuevo.
  if new.estado is distinct from 'cerrada' and old.estado = 'cerrada' then
    new.cierre_en_plazo := null;
    new.fecha_cierre := null;
  end if;

  return new;
end;
$$;

comment on function public.controlar_cierre_nc is
  'Para cerrar hace falta al menos una accion correctiva cargada y decir si el cierre fue '
  'en plazo o fuera de plazo. Reemplaza al control de eficacia verificada del 1 de '
  'septiembre, que Calidad retiro el 23.';
