-- ---------------------------------------------------------------------
-- Las cuatro planillas de Calidad, columna por columna
--
-- Replica en la base las hojas del libro F-EST-01/07 que Calidad pidio
-- el 5 de octubre: 6.1.2 Riesgos (F-EST-01-03), 6.1.3 Oportunidades
-- (F-EST-01-04), 6.2 Objetivos e Indicadores (F-EST-01-05), 6.2.2 Plan
-- de Objetivos (F-EST-01-06) y 6.3 Gestion del Cambio (F-EST-01-07).
-- Las hojas 4.1 y 4.2 quedan afuera, como se indico.
--
-- La mayoria de las columnas ya existia. Lo que se agrega es esto:
--
-- 1 · EL PROCESO TAL COMO LO NOMBRA LA PLANILLA, en texto.
--
--     La planilla usa un mapa de procesos distinto del que tiene la
--     intranet: veintitres procesos contra diecinueve, y los mismos
--     codigos significan cosas diferentes —MP-EST-01 es «Informacion
--     Documentada» en la intranet y «Planificacion y Control del SGC»
--     en la planilla; MP-SOP-01 es al revés—. Varias filas, ademas,
--     nombran dos procesos a la vez («MP-MIS-01 / MP-MIS-03»), que una
--     clave ajena no puede representar.
--
--     Entonces: `proceso_id` sigue apuntando a `procesos` y no se toca,
--     y al lado va `proceso_declarado`, con el texto de la planilla tal
--     cual. Los datos entran completos y fieles hoy, el desplegable y el
--     filtro siguen funcionando contra el mapa de la intranet, y cuando
--     Calidad confirme el mapa definitivo se vinculan sin haber perdido
--     nada. Lo decidio Direccion asi, y es la opcion que no destruye ni
--     la Lista Maestra ni los veintiun documentos ya cargados.
--
-- 2 · EL NIVEL Y LAS OBSERVACIONES DEL INDICADOR. Columnas C y AD de la
--     hoja 6.2. El nivel —Estrategico, Tactico, Operativo— ya existia en
--     `objetivos` pero no en `indicadores`, y ahi hace falta: la hoja lo
--     declara por indicador.
--
-- 3 · LO QUE LE FALTABA A GESTION DEL CAMBIO. Cinco columnas de la hoja
--     6.3 que la tabla no tenia: quien lo solicito y cuando, los
--     documentos del SGC afectados, el resultado de la revision del
--     cambio y las acciones adicionales que quedaron.
--
-- 4 · EL PLAN DE ACCION PARA EL LOGRO DE LOS OBJETIVOS, que no tenia
--     tabla. Es la hoja 6.2.2 y son los cinco incisos del apartado
--     6.2.2 de la norma: que, con que recursos, quien, cuando y como se
--     evaluan los resultados.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 1 · El proceso declarado en la planilla
-- ---------------------------------------------------------------------

alter table public.riesgos
  add column if not exists proceso_declarado text,
  add column if not exists proceso_accion_declarado text,
  add column if not exists responsable_declarado text,
  add column if not exists plazo_accion_permanente boolean not null default false;

comment on column public.riesgos.responsable_declarado is
  'El responsable tal como lo nombra la matriz de Calidad: un cargo, no una '
  'persona («Asistente de Gestion Regulatoria»). De los diecinueve cargos que '
  'nombra la matriz hoy existen dos usuarios en la intranet, porque el perfil '
  'se crea en el primer ingreso: `responsable_id` queda vacio hasta entonces y '
  'el dato no se pierde.';
comment on column public.riesgos.plazo_accion_permanente is
  'La matriz usa la palabra «Permanente» en la columna de plazo para los '
  'controles que no terminan. Con esto en true, `plazo_accion` queda vacio y la '
  'accion no vence.';

comment on column public.riesgos.proceso_declarado is
  'El proceso tal como lo nombra la matriz de Calidad, en texto. Existe porque '
  'la planilla usa otro mapa de procesos que la intranet y porque varias filas '
  'nombran dos procesos a la vez. `proceso_id` sigue siendo el vinculo con '
  '`procesos`; esto es el dato de origen, sin interpretar.';
comment on column public.riesgos.proceso_accion_declarado is
  'Idem para el proceso del SGC donde se integra la accion (columna R de la '
  'hoja 6.1.2, Q de la 6.1.3).';

alter table public.indicadores
  add column if not exists proceso_declarado text,
  add column if not exists responsable_declarado text,
  add column if not exists nivel text,
  add column if not exists observaciones text;

comment on column public.indicadores.proceso_declarado is
  'Columna «Funcion / Nivel / Proceso» de la hoja 6.2, en texto.';
comment on column public.indicadores.nivel is
  'Estrategico, Tactico u Operativo. La hoja 6.2 lo declara por indicador.';

alter table public.indicadores
  drop constraint if exists indicadores_nivel_valido;
alter table public.indicadores
  add constraint indicadores_nivel_valido
  check (nivel is null or nivel in ('estrategico', 'tactico', 'operativo'));

-- ---------------------------------------------------------------------
-- 2 · Lo que le faltaba a gestion del cambio
-- ---------------------------------------------------------------------

alter table public.cambios
  add column if not exists proceso_declarado text,
  add column if not exists fecha_solicitud date,
  add column if not exists solicitante_id uuid references public.usuarios (id),
  add column if not exists documentos_afectados text,
  add column if not exists resultado_revision text,
  add column if not exists acciones_adicionales text;

comment on column public.cambios.fecha_solicitud is
  'Columna B de la hoja 6.3. No es `creado_en`: el cambio puede registrarse '
  'en la intranet dias despues de haberse solicitado.';
comment on column public.cambios.resultado_revision is
  'Columna S: el resultado de la revision del cambio, distinto del resultado '
  'del seguimiento de eficacia (columna R, `seguimiento_observacion`).';

-- ---------------------------------------------------------------------
-- 3 · El plan de accion para el logro de los objetivos (hoja 6.2.2)
-- ---------------------------------------------------------------------

create table if not exists public.objetivo_planes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id),
  objetivo_id uuid references public.objetivos (id) on delete set null,
  -- El objetivo tal como lo nombra la planilla: «O1», «O8», «Todos». La
  -- ultima fila del plan aplica a todos los objetivos a la vez, y eso
  -- una clave ajena no lo puede decir.
  objetivo_declarado text,
  -- Los cinco incisos del apartado 6.2.2 de la norma, con su letra.
  que_se_va_a_hacer text not null,
  recursos_necesarios text,
  responsable_id uuid references public.usuarios (id),
  responsable_declarado text,
  fecha_finalizacion date,
  como_se_evaluan_resultados text,
  -- El seguimiento.
  fecha_real_finalizacion date,
  resultado_evaluacion text,
  avance_porcentaje numeric(5, 2) not null default 0,
  estado text not null default 'pendiente',
  observaciones text,
  es_demostracion boolean not null default false,
  creado_por uuid references public.usuarios (id),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),

  constraint objetivo_planes_avance_valido check (avance_porcentaje between 0 and 100),
  constraint objetivo_planes_estado_valido
    check (estado in ('pendiente', 'en_curso', 'cumplido', 'no_cumplido', 'cancelado')),
  -- Una fila que dice que termino sin decir cuando no sirve para
  -- auditar: el plan es justamente la evidencia de que se hizo.
  constraint objetivo_planes_cierre_con_fecha
    check (estado <> 'cumplido' or fecha_real_finalizacion is not null)
);

comment on table public.objetivo_planes is
  'Hoja 6.2.2 del F-EST-01/07, «Plan de accion para el logro de los objetivos». '
  'Los cinco incisos del apartado 6.2.2 de la ISO 9001.';

create index if not exists objetivo_planes_objetivo_idx
  on public.objetivo_planes (objetivo_id);
create index if not exists objetivo_planes_abiertos_idx
  on public.objetivo_planes (fecha_finalizacion)
  where estado in ('pendiente', 'en_curso');

-- `actualizado_en` lo mantiene el disparador, como en el resto.
drop trigger if exists objetivo_planes_actualizacion on public.objetivo_planes;
create trigger objetivo_planes_actualizacion
  before update on public.objetivo_planes
  for each row execute function public.marcar_actualizacion();

-- Trazabilidad por disparador, no desde la aplicacion: asi ningun
-- camino de escritura la puede evadir. Requisito de auditoria.
drop trigger if exists bitacora_objetivo_planes on public.objetivo_planes;
create trigger bitacora_objetivo_planes
  after insert or update or delete on public.objetivo_planes
  for each row execute function public.registrar_bitacora();

-- ---------------------------------------------------------------------
-- 4 · RLS del plan de objetivos
-- ---------------------------------------------------------------------
-- Una tabla nueva sin politicas es un error, no un pendiente. Y sin el
-- `grant` PostgreSQL corta antes de evaluarlas y la pantalla queda vacia
-- sin decir por que: esta tabla esta fuera del bucle de
-- `..._politicas_rls.sql`, asi que lo recibe explicito.

alter table public.objetivo_planes enable row level security;

grant select, insert, update, delete on public.objetivo_planes to authenticated;

drop policy if exists objetivo_planes_lectura on public.objetivo_planes;
create policy objetivo_planes_lectura on public.objetivo_planes
  for select using (public.misma_empresa(empresa_id));

drop policy if exists objetivo_planes_gestion on public.objetivo_planes;
create policy objetivo_planes_gestion on public.objetivo_planes
  for all
  using (public.misma_empresa(empresa_id) and (public.puede_gestionar() or responsable_id = auth.uid()))
  with check (public.misma_empresa(empresa_id) and (public.puede_gestionar() or responsable_id = auth.uid()));
