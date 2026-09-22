-- ---------------------------------------------------------------------
-- Riesgos y oportunidades segun el F-EST-01-03, el F-EST-01-04 y el
-- instructivo de valoracion de Calidad
--
-- Tres cambios de fondo:
--
-- 1 · EL SEMAFORO CAMBIA. El instructivo fija 1-3 bajo, 4-8 medio, 9-14
--     alto y 15-25 critico. La intranet usaba 1-4 / 5-9 / 10-14 / 15-25,
--     que era una banda que puse yo a falta de dato. Los riesgos ya
--     cargados se reclasifican solos: `nivel` es una columna generada y
--     la etiqueta se calcula, no se guarda.
--
--     El corte importa: con la banda nueva, nivel 4 deja de ser bajo y
--     pasa a medio, y «medio» en el instructivo significa que REQUIERE
--     accion planificada con responsable y plazo. Lo que antes se asumia
--     en silencio ahora pide plan.
--
-- 2 · «IMPACTO» PASA A LLAMARSE «SEVERIDAD». Es el termino del
--     instructivo, que ademas la define en seis dimensiones y manda tomar
--     la peor, no el promedio. La columna se renombra; PostgreSQL ajusta
--     solo la expresion de `nivel`, que la usa.
--
-- 3 · LAS OPORTUNIDADES NO SE VALORAN CON PROBABILIDAD Y SEVERIDAD.
--     Se valoran por Beneficio (1-5) x Factibilidad (1-5), con su propio
--     indice y su propia tabla de prioridad. Es lo que dice el apartado 6
--     del instructivo y es lo que la intranet tenia mal: las metia en la
--     misma matriz 5x5 que los riesgos.
--
--     Siguen en la misma tabla, distinguidas por `tipo`. Una tabla aparte
--     obligaria a duplicar codigo, RLS, bitacora y busqueda para ganar
--     poco: lo que las separa de verdad es la valoracion, y eso queda
--     resuelto con las restricciones de abajo. Lo que SI se separa son
--     las pantallas: ninguna de las dos se lee bien mezclada con la otra.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1 · Las bandas del semaforo
-- ---------------------------------------------------------------------
create or replace function public.etiqueta_nivel_riesgo(p_nivel integer)
returns text
language sql
immutable
as $$
  select case
    when p_nivel is null then null
    when p_nivel <= 3  then 'bajo'
    when p_nivel <= 8  then 'medio'
    when p_nivel <= 14 then 'alto'
    else 'critico'
  end;
$$;

comment on function public.etiqueta_nivel_riesgo(integer) is
  'Semaforo del instructivo de valoracion: 1-3 bajo, 4-8 medio, 9-14 alto, 15-25 critico. '
  'La misma regla esta en lib/riesgos.ts: si cambia, cambia en los dos lados.';

-- La periodicidad se escribe sobre la etiqueta y no sobre el numero, asi
-- no se puede volver a desincronizar con las bandas.
create or replace function public.dias_reevaluacion_riesgo(p_nivel integer)
returns integer
language sql
immutable
as $$
  select case public.etiqueta_nivel_riesgo(p_nivel)
    when 'critico' then 30
    when 'alto'    then 90
    when 'medio'   then 180
    else 365
  end;
$$;

-- Prioridad de una oportunidad, segun el apartado 6.3 del instructivo.
create or replace function public.etiqueta_prioridad_oportunidad(p_indice integer)
returns text
language sql
immutable
as $$
  select case
    when p_indice is null then null
    when p_indice >= 15 then 'alta'
    when p_indice >= 7  then 'media'
    else 'baja'
  end;
$$;

comment on function public.etiqueta_prioridad_oportunidad(integer) is
  'Indice = Beneficio x Factibilidad. 15-25 alta, 7-14 media, 1-6 baja. La alineacion '
  'estrategica no suma puntaje: actua como condicion, y una oportunidad de indice alto '
  'con alineacion baja no se aborda.';

-- ---------------------------------------------------------------------
-- 2 · Impacto pasa a ser severidad
-- ---------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'riesgos' and column_name = 'impacto'
  ) then
    alter table public.riesgos rename column impacto to severidad;
  end if;

  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'riesgos'
       and column_name = 'impacto_residual'
  ) then
    alter table public.riesgos rename column impacto_residual to severidad_residual;
  end if;
end
$$;

-- El disparador de reevaluacion nombraba la columna vieja en su cuerpo:
-- renombrar una columna no reescribe el cuerpo de una funcion plpgsql, y
-- el error recien aparece al escribir una fila. Se rehace con el nombre
-- nuevo. Tambien pasa a calcular el nivel con la etiqueta, no con el
-- numero, por la misma razon que `dias_reevaluacion_riesgo`.
create or replace function public.calcular_proxima_revision_riesgo()
returns trigger
language plpgsql
as $$
declare
  v_nivel integer := coalesce(new.probabilidad_residual * new.severidad_residual,
                              new.probabilidad * new.severidad);
begin
  -- Una oportunidad no se reevalua por nivel: no tiene probabilidad ni
  -- severidad. Su revision la marca el plazo de su accion.
  if new.tipo <> 'riesgo' then
    return new;
  end if;

  if tg_op = 'INSERT'
     or new.probabilidad is distinct from old.probabilidad
     or new.severidad is distinct from old.severidad
     or new.probabilidad_residual is distinct from old.probabilidad_residual
     or new.severidad_residual is distinct from old.severidad_residual
     or new.fecha_proxima_revision is null then
    new.fecha_ultima_evaluacion := current_date;
    new.fecha_proxima_revision :=
      current_date + public.dias_reevaluacion_riesgo(v_nivel);
  end if;

  return new;
end;
$$;

comment on column public.riesgos.severidad is
  'Severidad 1 a 5. Se evalua en seis dimensiones y se toma la MAS AFECTADA, no el '
  'promedio, y sobre el peor caso razonable y no el peor caso teorico.';

-- El historial de evaluaciones guarda la misma pareja de valores y tiene
-- que llamarse igual: si una tabla dice «impacto» y la otra «severidad»,
-- en seis meses nadie sabe si son lo mismo.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'riesgo_evaluaciones'
       and column_name = 'impacto'
  ) then
    alter table public.riesgo_evaluaciones rename column impacto to severidad;
  end if;
end
$$;

-- ---------------------------------------------------------------------
-- 3 · La valoracion deja de ser obligatoria al insertar
-- ---------------------------------------------------------------------
-- Una oportunidad no tiene probabilidad ni severidad, y una fila recien
-- identificada todavia no esta valorada. El default de 1 hacia que todo
-- naciera valorado en el nivel mas bajo, que es peor que sin valorar.
alter table public.riesgos alter column probabilidad drop not null;
alter table public.riesgos alter column probabilidad drop default;
alter table public.riesgos alter column severidad drop not null;
alter table public.riesgos alter column severidad drop default;
alter table public.riesgos alter column tratamiento drop not null;
alter table public.riesgos alter column tratamiento drop default;

alter table public.riesgos drop constraint if exists riesgos_probabilidad_valida;
alter table public.riesgos drop constraint if exists riesgos_impacto_valido;
alter table public.riesgos drop constraint if exists riesgos_severidad_valida;

alter table public.riesgos
  add constraint riesgos_probabilidad_valida
  check (probabilidad is null or probabilidad between 1 and 5);

alter table public.riesgos
  add constraint riesgos_severidad_valida
  check (severidad is null or severidad between 1 and 5);

-- ---------------------------------------------------------------------
-- 4 · Columnas del F-EST-01-03 (riesgos)
-- ---------------------------------------------------------------------
alter table public.riesgos
  add column if not exists origen text,
  add column if not exists asociado_disrupcion boolean,
  add column if not exists accion_planificada text,
  add column if not exists plazo_accion date,
  add column if not exists proceso_accion_id uuid references public.procesos (id) on delete set null,
  add column if not exists fecha_evaluacion_eficacia date,
  add column if not exists eficacia_accion public.resultado_eficacia,
  add column if not exists fundamento_decision text;

comment on column public.riesgos.origen is
  'De donde salio el riesgo: queja de cliente, auditoria, analisis de proceso, incidente.';
comment on column public.riesgos.asociado_disrupcion is
  'Si el riesgo puede interrumpir la operacion. Columna propia del F-EST-01-03.';
comment on column public.riesgos.proceso_accion_id is
  'Proceso del SGC donde se integra la accion, que no siempre es el proceso afectado.';
comment on column public.riesgos.fundamento_decision is
  'Para el tratamiento «asumir»: quien lo decidio y con que fundamento. El instructivo lo '
  'exige porque un riesgo asumido sin constancia es un riesgo sin dueno.';

-- ¿Requiere accion? No se escribe a mano: sale del nivel. Bajo (1-3) se
-- asume y solo se vigila; de 4 para arriba hace falta plan con
-- responsable y plazo.
-- Se escribe sobre probabilidad y severidad y no sobre `nivel`: una
-- columna generada no puede apoyarse en otra generada.
alter table public.riesgos drop column if exists requiere_accion;
alter table public.riesgos
  add column requiere_accion boolean
  generated always as (
    probabilidad is not null and severidad is not null and probabilidad * severidad >= 4
  ) stored;

comment on column public.riesgos.requiere_accion is
  'Generada: nivel 4 o mas exige accion planificada. Nivel bajo se asume y se vigila.';

-- ---------------------------------------------------------------------
-- 5 · Columnas del F-EST-01-04 (oportunidades)
-- ---------------------------------------------------------------------
alter table public.riesgos
  add column if not exists efecto_deseado text,
  add column if not exists beneficio smallint,
  add column if not exists factibilidad smallint,
  add column if not exists alineacion_estrategica text,
  add column if not exists se_decide_abordar boolean,
  add column if not exists recursos_necesarios text,
  add column if not exists resultado_obtenido text;

alter table public.riesgos drop column if exists indice;
alter table public.riesgos
  add column indice integer generated always as (beneficio * factibilidad) stored;

comment on column public.riesgos.beneficio is
  'Beneficio potencial 1 a 5. Se toma la dimension MAS FAVORECIDA.';
comment on column public.riesgos.factibilidad is
  'Factibilidad 1 a 5. Se evaluan cuatro dimensiones y se toma la MAS RESTRICTIVA: el '
  'cuello de botella. Al reves que la severidad, aca se toma el valor mas bajo.';
comment on column public.riesgos.indice is
  'Generada: Beneficio x Factibilidad. De ahi sale la prioridad.';
comment on column public.riesgos.alineacion_estrategica is
  'Alta, media o baja. No suma puntaje: es condicion. Indice alto con alineacion baja no '
  'se aborda, y esa decision se registra.';

alter table public.riesgos drop constraint if exists riesgos_beneficio_valido;
alter table public.riesgos
  add constraint riesgos_beneficio_valido
  check (beneficio is null or beneficio between 1 and 5);

alter table public.riesgos drop constraint if exists riesgos_factibilidad_valida;
alter table public.riesgos
  add constraint riesgos_factibilidad_valida
  check (factibilidad is null or factibilidad between 1 and 5);

alter table public.riesgos drop constraint if exists riesgos_alineacion_valida;
alter table public.riesgos
  add constraint riesgos_alineacion_valida
  check (alineacion_estrategica is null
         or alineacion_estrategica in ('alta', 'media', 'baja'));

-- ---------------------------------------------------------------------
-- 6 · Cada tipo con su valoracion, y nunca con la del otro
-- ---------------------------------------------------------------------
-- Lo que mantiene honesta la tabla compartida. Un riesgo no lleva
-- beneficio ni factibilidad; una oportunidad no lleva probabilidad ni
-- severidad. Que la valoracion este incompleta se permite —una fila
-- recien identificada todavia no se valoro— pero cruzada, no.
--
-- Las oportunidades ya cargadas traen probabilidad y severidad en 1 por
-- el default viejo. No son una valoracion: son el relleno que ponia la
-- base. Se limpian antes de poner la restriccion.
update public.riesgos
   set probabilidad = null,
       severidad = null,
       probabilidad_residual = null,
       severidad_residual = null,
       tratamiento = null
 where tipo = 'oportunidad';

alter table public.riesgos drop constraint if exists riesgos_valoracion_segun_tipo;
alter table public.riesgos
  add constraint riesgos_valoracion_segun_tipo check (
    case tipo
      when 'riesgo' then beneficio is null and factibilidad is null
      when 'oportunidad' then probabilidad is null and severidad is null
      else true
    end
  );

-- ---------------------------------------------------------------------
-- 7 · El residual nunca puede ser mayor que el inherente
-- ---------------------------------------------------------------------
-- Apartado 5.3 del instructivo. Si al valorar resulta mayor, el riesgo
-- cambio de naturaleza y corresponde abrir una fila nueva, no pisar esta.
alter table public.riesgos drop constraint if exists riesgos_residual_no_supera_inherente;
alter table public.riesgos
  add constraint riesgos_residual_no_supera_inherente check (
    probabilidad_residual is null
    or severidad_residual is null
    or probabilidad is null
    or severidad is null
    or (probabilidad_residual * severidad_residual) <= (probabilidad * severidad)
  );

create index if not exists riesgos_tipo_idx on public.riesgos (empresa_id, tipo);
create index if not exists riesgos_indice_idx on public.riesgos (empresa_id, indice desc);
