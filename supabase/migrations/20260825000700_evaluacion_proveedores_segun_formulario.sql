-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- Evaluacion de proveedores segun el formulario F-SOP-08-01
-- =====================================================================
-- La evaluacion se habia construido con cinco criterios inventados
-- (calidad, plazo de entrega, precio, servicio de posventa y
-- documentacion) porque todavia no se conocia el formulario real.
--
-- El formulario vigente, F-SOP-08-01 "Evaluacion de Asociados de Negocio
-- y Proveedores" Ver. 00 del 25/05/2026, usa cuatro:
--
--   Calidad · Logistica · Legal · Servicio
--
-- Se alinea el sistema al formulario. Con cuatro criterios de 1 a 5 el
-- maximo es 20, asi que el factor de escala a la nota de 0 a 100 pasa de
-- 4 a 5. Los cortes 80 / 60 no cambian.
--
-- Los criterios viejos se traducen a los nuevos para no perder las
-- evaluaciones ya cargadas:
--
--   calidad          → calidad     (se queda como esta)
--   plazo_entrega    → logistica   (el plazo es la parte medible de la logistica)
--   documentacion    → legal       (documentacion y cumplimiento formal)
--   servicio_posventa→ servicio    (posventa es servicio)
--   precio           → se pierde   (el formulario no lo evalua)
--
-- El formulario ademas pregunta "¿De que manera afecta a la calidad de
-- los articulos/servicios de la empresa?" por cada proveedor. Es una
-- columna propia y no una observacion suelta: es el fundamento de por
-- que ese proveedor se evalua.

-- ---------------------------------------------------------------------
-- 1 · Columnas nuevas, con el valor traducido del criterio viejo
-- ---------------------------------------------------------------------
alter table public.proveedor_evaluaciones
  add column if not exists logistica smallint,
  add column if not exists legal smallint,
  add column if not exists servicio smallint;

update public.proveedor_evaluaciones set
  logistica = coalesce(logistica, plazo_entrega),
  legal     = coalesce(legal, documentacion),
  servicio  = coalesce(servicio, servicio_posventa);

alter table public.proveedor_evaluaciones
  alter column logistica set not null,
  alter column legal set not null,
  alter column servicio set not null;

-- ---------------------------------------------------------------------
-- 2 · El puntaje se recalcula sobre los cuatro criterios
-- ---------------------------------------------------------------------
-- Una columna generada no se puede redefinir: se quita y se vuelve a
-- crear. El disparador que copia el puntaje al proveedor no cambia.
alter table public.proveedor_evaluaciones drop column puntaje;

alter table public.proveedor_evaluaciones
  add column puntaje numeric(5, 2) generated always as (
    (calidad + logistica + legal + servicio) * 5.0
  ) stored;

-- ---------------------------------------------------------------------
-- 3 · Fuera los criterios que el formulario no usa
-- ---------------------------------------------------------------------
alter table public.proveedor_evaluaciones
  drop constraint if exists proveedor_evaluaciones_plazo,
  drop constraint if exists proveedor_evaluaciones_precio,
  drop constraint if exists proveedor_evaluaciones_servicio,
  drop constraint if exists proveedor_evaluaciones_documentacion;

alter table public.proveedor_evaluaciones
  drop column if exists plazo_entrega,
  drop column if exists precio,
  drop column if exists servicio_posventa,
  drop column if exists documentacion;

alter table public.proveedor_evaluaciones
  add constraint proveedor_evaluaciones_logistica check (logistica between 1 and 5),
  add constraint proveedor_evaluaciones_legal     check (legal between 1 and 5),
  add constraint proveedor_evaluaciones_servicio  check (servicio between 1 and 5);

-- ---------------------------------------------------------------------
-- 4 · El impacto del proveedor sobre la calidad
-- ---------------------------------------------------------------------
alter table public.proveedores
  add column if not exists impacto_en_calidad text;

comment on column public.proveedores.impacto_en_calidad is
  'Respuesta a "¿De que manera afecta a la calidad de los articulos/servicios '
  'de la empresa?" del formulario F-SOP-08-01.';

-- ---------------------------------------------------------------------
-- 5 · Reconciliar lo que dependia del puntaje viejo
-- ---------------------------------------------------------------------
-- El resultado y la calificacion del proveedor son valores guardados,
-- no calculados: quedaron con la nota de cinco criterios. Se recalculan
-- con la escala del formulario, la misma que aplica `resultadoSugerido`
-- en `lib/proveedores.ts`.

update public.proveedor_evaluaciones set
  resultado = case
    when puntaje >= 80 then 'aprobado'::public.estado_proveedor
    when puntaje >= 60 then 'condicional'::public.estado_proveedor
    else 'rechazado'::public.estado_proveedor
  end;

update public.proveedores p set
  calificacion_actual = e.puntaje,
  estado = e.resultado
 from (
   select distinct on (proveedor_id) proveedor_id, puntaje, resultado
     from public.proveedor_evaluaciones
    order by proveedor_id, fecha desc, creado_en desc
 ) e
 where e.proveedor_id = p.id;
