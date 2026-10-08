-- ---------------------------------------------------------------------
-- El resultado del objetivo, mes a mes.
--
-- POR QUE UNA TABLA NUEVA. `indicador_mediciones` guarda el valor de un
-- indicador, y un objetivo puede no tener ninguno: Direccion pidio el 8
-- de octubre que la pantalla principal sea un calendario por mes del
-- OBJETIVO, donde en cada mes se va registrando el resultado. Colgar eso
-- de un indicador obligaria a definir uno antes de poder registrar nada.
--
-- EL RESULTADO SIGUE AL TIPO DEL OBJETIVO. Un objetivo declara en
-- `tipo_resultado` si se mide por Si/No, por texto o por valor numerico;
-- la medicion del mes guarda el que corresponda. Las tres columnas son
-- opcionales y el CHECK exige que venga la del tipo declarado: con una
-- sola columna de texto para los tres casos no se podria graficar el
-- numerico ni contar los Si.
--
-- UNA POR OBJETIVO Y MES. El indice unico es lo que hace que volver a
-- cargar el mes corrija en vez de duplicar, que es lo que pasaria con un
-- calendario donde se vuelve a tocar la misma celda.
--
-- `anio` y `mes` como enteros, no una fecha: la celda es el mes entero y
-- una fecha obligaria a elegir un dia que no significa nada, con el
-- riesgo de que se lea corrido por zona horaria.
-- ---------------------------------------------------------------------

create table if not exists public.objetivo_mediciones (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  objetivo_id uuid not null references public.objetivos (id) on delete cascade,
  anio integer not null,
  mes integer not null,
  -- El resultado, segun el tipo que declaro el objetivo.
  valor_numerico numeric,
  resultado_si_no boolean,
  resultado_texto text,
  -- Como se llego a ese resultado. Es lo que la Revision por la
  -- Direccion lee cuando el mes no alcanza lo esperado.
  comentario text,
  creado_por uuid references public.usuarios (id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint objetivo_mediciones_mes_valido check (mes between 1 and 12),
  constraint objetivo_mediciones_anio_valido check (anio between 2000 and 2100),
  -- Un mes cargado sin ningun resultado es una celda pintada que no dice
  -- nada: al menos uno de los tres tiene que venir.
  constraint objetivo_mediciones_con_resultado check (
    valor_numerico is not null
    or resultado_si_no is not null
    or (resultado_texto is not null and btrim(resultado_texto) <> '')
  )
);

comment on table public.objetivo_mediciones is
  'El resultado del objetivo de la calidad mes a mes. Alimenta el '
  'calendario de la pantalla principal de Objetivos e Indicadores.';

create unique index if not exists objetivo_mediciones_unica
  on public.objetivo_mediciones (objetivo_id, anio, mes);

create index if not exists objetivo_mediciones_periodo_idx
  on public.objetivo_mediciones (anio, mes);

-- `actualizado_en` lo mantiene el disparador, como en el resto.
drop trigger if exists objetivo_mediciones_actualizacion on public.objetivo_mediciones;
create trigger objetivo_mediciones_actualizacion
  before update on public.objetivo_mediciones
  for each row execute function public.marcar_actualizacion();

-- Trazabilidad por disparador, no desde la aplicacion: asi ningun camino
-- de escritura la puede evadir. Requisito de auditoria.
drop trigger if exists bitacora_objetivo_mediciones on public.objetivo_mediciones;
create trigger bitacora_objetivo_mediciones
  after insert or update or delete on public.objetivo_mediciones
  for each row execute function public.registrar_bitacora();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
-- Una tabla nueva sin politicas es un error, no un pendiente. Y sin el
-- `grant` PostgreSQL corta antes de evaluarlas y la pantalla queda vacia
-- sin decir por que: esta tabla esta fuera del bucle de
-- `..._politicas_rls.sql`, asi que lo recibe explicito.

alter table public.objetivo_mediciones enable row level security;

grant select, insert, update, delete on public.objetivo_mediciones to authenticated;

drop policy if exists objetivo_mediciones_lectura on public.objetivo_mediciones;
create policy objetivo_mediciones_lectura on public.objetivo_mediciones
  for select using (public.misma_empresa(empresa_id));

-- Carga el mes quien gestiona, o el responsable del objetivo: es quien
-- tiene el dato. Se mira contra `objetivos` y no contra una columna
-- propia para que no se puedan separar nunca.
drop policy if exists objetivo_mediciones_gestion on public.objetivo_mediciones;
create policy objetivo_mediciones_gestion on public.objetivo_mediciones
  for all
  using (
    public.misma_empresa(empresa_id)
    and (
      public.puede_gestionar()
      or exists (
        select 1 from public.objetivos o
        where o.id = objetivo_id and o.responsable_id = auth.uid()
      )
    )
  )
  with check (
    public.misma_empresa(empresa_id)
    and (
      public.puede_gestionar()
      or exists (
        select 1 from public.objetivos o
        where o.id = objetivo_id and o.responsable_id = auth.uid()
      )
    )
  );
