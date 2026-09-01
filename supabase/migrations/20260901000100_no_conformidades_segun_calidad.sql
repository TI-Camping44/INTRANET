-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- No conformidades: el modulo segun lo que pidio Calidad
-- =====================================================================
--
-- Primera revision del modulo con Calidad sobre el sistema andando. Lo
-- que cambia y por que:
--
--   1. La severidad "critica" no existe en Camping 44. La escala real
--      es Menor / Mayor / Observacion-Recomendacion, la del formulario
--      de auditoria. Se renombra el valor del enumerado en lugar de
--      agregar uno nuevo: asi no quedan dos valores para lo mismo y no
--      hace falta partir la actualizacion en dos transacciones.
--
--   2. La no conformidad ahora dice a que EMPRESA corresponde. Camping
--      44 y Vitalica comparten el espacio de trabajo y Calidad lleva
--      las dos. Es una columna aparte de empresa_id a proposito:
--      empresa_id es la tenencia y la usa RLS; si se cambiara, la
--      persona dejaria de ver su propio registro.
--
--   3. La no conformidad ahora dice a que AREA corresponde. Es lo que
--      mas se pide y lo que Sofidya no permite: saber cuales son las NC
--      de cada departamento. Va como texto con CHECK y no como
--      enumerado porque las areas de la empresa cambian mas seguido que
--      los conceptos del SGC, y corregir un CHECK es una migracion
--      simple mientras que sacar un valor de un enumerado no se puede.
--
--   4. La fecha limite de cierre deja de escribirse a mano: son diez
--      dias corridos desde la deteccion, siempre. Lo fija un disparador
--      y no la aplicacion, para que valga por cualquier via de
--      escritura, igual que la bitacora.
--
--   5. Cerrar una no conformidad queda reservado a Calidad, y solo
--      despues de verificar la eficacia. Tambien por disparador: es un
--      control de auditoria, no un boton escondido en la interfaz.
--
--   6. El diagrama de Ishikawa se retira. Calidad trabaja con los cinco
--      porques y la conclusion; la segunda herramienta agregaba una
--      pantalla que nadie iba a completar.
--
--   7. Se normalizan los valores de origen y de estado que salen de
--      circulacion, para que los filtros no ofrezcan opciones vacias.
--
-- Idempotente: se puede correr de nuevo sin romper nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · Severidad: "critica" pasa a ser "observacion"
-- ---------------------------------------------------------------------
do $$
begin
  if exists (
    select 1
      from pg_enum e
      join pg_type t on t.oid = e.enumtypid
     where t.typname = 'severidad_no_conformidad'
       and e.enumlabel = 'critica'
  ) then
    alter type public.severidad_no_conformidad rename value 'critica' to 'observacion';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 2 · Empresa a la que corresponde la desviacion
-- ---------------------------------------------------------------------
alter table public.no_conformidades
  add column if not exists empresa_afectada_id uuid references public.empresas (id)
    on delete set null;

comment on column public.no_conformidades.empresa_afectada_id is
  'Empresa del grupo a la que corresponde la desviacion. No es la tenencia: '
  'esa es empresa_id, la que evalua RLS.';

-- Lo ya cargado corresponde a la empresa que lo registro.
update public.no_conformidades
   set empresa_afectada_id = empresa_id
 where empresa_afectada_id is null;

-- ---------------------------------------------------------------------
-- 3 · Area de la organizacion
-- ---------------------------------------------------------------------
alter table public.no_conformidades
  add column if not exists area text;

comment on column public.no_conformidades.area is
  'Departamento al que corresponde la desviacion. La lista vive tambien en '
  'src/lib/constantes.ts (AREAS_ORGANIZACIONALES): si cambia, cambia en los dos lados.';

alter table public.no_conformidades
  drop constraint if exists no_conformidades_area_valida;

alter table public.no_conformidades
  add constraint no_conformidades_area_valida check (
    area is null or area in (
      'administracion',
      'tesoreria_caja',
      'creditos_cobranzas',
      'contabilidad',
      'recepcion',
      'consumidor_final',
      'mayorista',
      'marketing',
      'logistica_operaciones',
      'informatica',
      'capital_humano',
      'gestion_calidad',
      'directorio'
    )
  ) not valid;

alter table public.no_conformidades validate constraint no_conformidades_area_valida;

create index if not exists no_conformidades_area_idx
  on public.no_conformidades (empresa_id, area);

-- ---------------------------------------------------------------------
-- 4 · Origenes y estados que salen de circulacion
-- ---------------------------------------------------------------------
-- La escala de origen pasa a ser la del formulario de Calidad. Los dos
-- valores que quedan sin uso se llevan al mas cercano para que ningun
-- registro quede con una etiqueta que la interfaz ya no muestra.
update public.no_conformidades
   set origen = 'proceso_interno'
 where origen in ('inspeccion', 'otro');

-- El ciclo queda en tres pasos: abierta, en tratamiento, cerrada.
update public.no_conformidades set estado = 'abierta'        where estado = 'en_analisis';
update public.no_conformidades set estado = 'en_tratamiento' where estado = 'en_verificacion';

-- ---------------------------------------------------------------------
-- 5 · La fecha limite de cierre la calcula la base
-- ---------------------------------------------------------------------
-- Diez dias corridos desde la deteccion, sin excepcion. Se resuelve por
-- disparador y no en la accion de servidor para que valga tambien para
-- las no conformidades que genera el sistema solo: las que nacen de un
-- hallazgo de auditoria y las que nacen de un reclamo de cliente.
create or replace function public.fijar_limite_cierre_nc()
returns trigger
language plpgsql
as $$
begin
  new.fecha_limite_cierre := new.fecha_deteccion + 10;
  return new;
end;
$$;

comment on function public.fijar_limite_cierre_nc is
  'Plazo de cierre de una no conformidad: diez dias corridos desde la deteccion. '
  'El mismo numero esta en DIAS_LIMITE_CIERRE_NC (src/lib/constantes.ts).';

drop trigger if exists no_conformidades_limite_cierre on public.no_conformidades;
create trigger no_conformidades_limite_cierre
  before insert or update of fecha_deteccion, fecha_limite_cierre
  on public.no_conformidades
  for each row execute function public.fijar_limite_cierre_nc();

-- Lo ya cargado se recalcula con la misma regla.
update public.no_conformidades
   set fecha_limite_cierre = fecha_deteccion + 10
 where fecha_limite_cierre is distinct from fecha_deteccion + 10;

-- ---------------------------------------------------------------------
-- 6 · Cerrar una no conformidad es atribucion de Calidad
-- ---------------------------------------------------------------------
-- El cierre certifica que la accion correctiva fue eficaz. Lo firma
-- Calidad y nadie mas, y no antes de haber registrado esa verificacion.
create or replace function public.controlar_cierre_nc()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado = 'cerrada' and old.estado is distinct from 'cerrada' then
    if not public.es_admin_sgc() then
      raise exception
        'Solo Calidad puede cerrar una no conformidad, despues de verificar la eficacia de la accion correctiva.'
        using errcode = '42501';
    end if;

    if new.eficacia = 'pendiente' then
      raise exception
        'Registre primero la verificacion de eficacia: una no conformidad no se cierra sin ella.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists no_conformidades_control_cierre on public.no_conformidades;
create trigger no_conformidades_control_cierre
  before update on public.no_conformidades
  for each row execute function public.controlar_cierre_nc();

-- ---------------------------------------------------------------------
-- 7 · Se retira el diagrama de Ishikawa
-- ---------------------------------------------------------------------
drop table if exists public.nc_ishikawa;
drop type if exists public.categoria_ishikawa;
