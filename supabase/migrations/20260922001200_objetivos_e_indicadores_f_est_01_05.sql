-- ---------------------------------------------------------------------
-- Objetivos e indicadores segun el F-EST-01-05
--
-- Calidad pidio que la pantalla replique la hoja «6.2 Objetivos e
-- Indicadores» del F-EST-01/07: una fila por objetivo, con su indicador
-- al lado, los doce meses, el resultado consolidado, el porcentaje de
-- cumplimiento y el semaforo.
--
-- El modelo ya estaba cerca. `indicador_mediciones` con una fila por
-- periodo es exactamente las doce columnas de meses, y no se toca: doce
-- columnas en la tabla serian doce columnas que hay que migrar cada vez
-- que cambie la frecuencia. Lo que faltaba son las columnas de la hoja
-- que no existian y, sobre todo, el vinculo entre el objetivo y su
-- indicador: en la hoja van en la misma fila y en la base vivian sueltos.
--
-- La relacion se pone en `indicadores.objetivo_id` y no al reves porque
-- un objetivo puede medirse con mas de un indicador —la hoja usaria dos
-- filas— pero un indicador responde a un solo objetivo.
-- ---------------------------------------------------------------------

-- Como se resume el ano a partir de los periodos cargados.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'consolidacion_indicador') then
    create type public.consolidacion_indicador as enum ('suma', 'promedio', 'ultimo');
  end if;
end
$$;

comment on type public.consolidacion_indicador is
  'Suma para cantidades, promedio para porcentajes, ultimo para lo que se mide acumulado.';

alter table public.indicadores
  add column if not exists objetivo_id uuid references public.objetivos (id) on delete set null,
  add column if not exists linea_base numeric(14, 2),
  add column if not exists fuente_dato text,
  add column if not exists consolidacion public.consolidacion_indicador
    not null default 'promedio';

comment on column public.indicadores.objetivo_id is
  'Objetivo de la calidad que este indicador mide. En el F-EST-01-05 van en la misma fila.';
comment on column public.indicadores.linea_base is
  'Valor de partida contra el que se compara la meta.';
comment on column public.indicadores.fuente_dato is
  'De donde sale el numero: que planilla, que sistema, que registro.';

create index if not exists indicadores_objetivo_idx on public.indicadores (objetivo_id);

-- ---------------------------------------------------------------------
-- El objetivo: nivel y observaciones
-- ---------------------------------------------------------------------
alter table public.objetivos
  add column if not exists nivel text,
  add column if not exists observaciones text;

-- `not valid` y despues `validate`: asi la restriccion no falla si hay
-- alguna fila vieja fuera de la lista, y la migracion se puede volver a
-- correr sin romper.
alter table public.objetivos
  drop constraint if exists objetivos_nivel_valido;

alter table public.objetivos
  add constraint objetivos_nivel_valido
  check (nivel is null or nivel in ('estrategico', 'tactico', 'operativo'))
  not valid;

alter table public.objetivos validate constraint objetivos_nivel_valido;

comment on column public.objetivos.nivel is
  'Estrategico, tactico u operativo. Columna «Nivel» del F-EST-01-05.';
comment on column public.objetivos.observaciones is
  'Ultima columna de la hoja: lo que no entra en ningun campo.';
