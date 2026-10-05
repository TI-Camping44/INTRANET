-- ---------------------------------------------------------------------
-- Las acciones del riesgo: plazo con dos fechas, eficacia por accion y
-- evidencia adjunta
--
-- Lo pidio Calidad el 5 de octubre: desde el listado de riesgos se entra
-- a cada riesgo y se cargan ahi las acciones que el nivel exige, «similar
-- al modulo AC pero dentro del modulo riesgo».
--
-- `riesgo_acciones` ya existia, con descripcion, tratamiento,
-- responsable, fecha limite, estado y evidencia en texto. Le faltaba:
--
--   · EL PLAZO CON DOS FECHAS. Antes habia una sola, la de vencimiento.
--     Calidad pide «desde / hasta»: una accion de tratamiento no es un
--     punto en el calendario, es un periodo, y sin la fecha de inicio no
--     se puede decir si empezo tarde.
--
--   · LA EFICACIA POR ACCION. Ejecutar no es servir: una accion puede
--     cumplirse en fecha y no bajar el riesgo. Se evalua cada una por
--     separado, igual que la eficacia de una capacitacion se verifica por
--     persona y no por curso. Se reusa el enumerado `resultado_eficacia`,
--     que ya existia para la eficacia del tratamiento del riesgo entero.
--
--   · SI SE EJECUTO EN PLAZO. Mismo criterio que `nc_acciones`: se guarda
--     al ejecutar y no se recalcula despues, porque la fecha limite puede
--     cambiar y el dato tiene que quedar como fue.
--
--   · EL PLAZO «PERMANENTE». La matriz de Calidad usa la palabra
--     «Permanente» en la columna de plazo de varias acciones: controles
--     que no terminan, como el arqueo diario de caja o el control de
--     permisos antes de cada despacho. Eso no es una fecha, y meterlo en
--     una columna `date` obligaria a inventarle un vencimiento. Va como
--     bandera aparte, y con ella la accion no vence.
--
-- LA EVIDENCIA ADJUNTA no necesita columna: va en `adjuntos`, que es
-- generica (`entidad` + `entidad_id`), con entidad 'riesgo_acciones'.
-- Es el mismo camino que la evidencia de las tareas de una accion
-- correctiva.
--
-- RLS Y BITACORA YA ESTABAN en esta tabla —`riesgo_acciones_lectura`,
-- `riesgo_acciones_gestion` y el disparador `bitacora_riesgo_acciones`—,
-- asi que agregar columnas no deja ningun agujero: las politicas se
-- aplican sobre la fila entera.
-- ---------------------------------------------------------------------

alter table public.riesgo_acciones
  add column if not exists fecha_inicio date,
  add column if not exists plazo_permanente boolean not null default false,
  add column if not exists ejecucion_en_plazo boolean,
  add column if not exists eficacia public.resultado_eficacia,
  add column if not exists fecha_evaluacion_eficacia date,
  add column if not exists evaluado_por uuid references public.usuarios (id),
  add column if not exists comentario_eficacia text;

comment on column public.riesgo_acciones.fecha_inicio is
  'Plazo «desde». Una accion de tratamiento es un periodo, no una fecha.';
comment on column public.riesgo_acciones.plazo_permanente is
  'Control que no termina (arqueo diario, verificacion antes de cada despacho). '
  'Con esto en true la accion no vence y la fecha limite queda vacia.';
comment on column public.riesgo_acciones.ejecucion_en_plazo is
  'Si se ejecuto dentro del plazo. Se guarda al ejecutar y no se recalcula: '
  'la fecha limite puede cambiar despues y el dato tiene que quedar como fue.';
comment on column public.riesgo_acciones.eficacia is
  'Si la accion sirvio, evaluada por separado de su ejecucion: cumplirla en '
  'fecha no garantiza que el riesgo baje.';

-- El periodo tiene que cerrar. Sin esto se puede guardar una accion que
-- termina antes de empezar, y el plazo deja de significar algo.
alter table public.riesgo_acciones
  drop constraint if exists riesgo_acciones_periodo_coherente;
alter table public.riesgo_acciones
  add constraint riesgo_acciones_periodo_coherente
  check (fecha_inicio is null or fecha_limite is null or fecha_inicio <= fecha_limite);

-- Una accion permanente no lleva fecha de vencimiento, y una que no es
-- permanente la necesita: si no, no hay con que decir que esta vencida.
alter table public.riesgo_acciones
  drop constraint if exists riesgo_acciones_plazo_definido;
alter table public.riesgo_acciones
  add constraint riesgo_acciones_plazo_definido
  check (
    (plazo_permanente and fecha_limite is null)
    or (not plazo_permanente)
  );

-- La eficacia se evalua una vez ejecutada. Marcarla eficaz sin haberla
-- ejecutado es afirmar sobre algo que no paso.
alter table public.riesgo_acciones
  drop constraint if exists riesgo_acciones_eficacia_tras_ejecucion;
alter table public.riesgo_acciones
  add constraint riesgo_acciones_eficacia_tras_ejecucion
  check (
    eficacia is null
    or eficacia = 'pendiente'
    or fecha_ejecucion is not null
  );

create index if not exists riesgo_acciones_responsable_idx
  on public.riesgo_acciones (responsable_id)
  where estado in ('pendiente', 'en_curso');

-- La fecha en que se va a medir el riesgo. La columna ya existia en
-- `riesgos` como `fecha_evaluacion_eficacia` —es la columna V de la
-- matriz de Calidad, «Fecha de evaluacion de eficacia»—. Se le precisa
-- el comentario, porque de ella depende cuando se habilita la
-- evaluacion del riesgo residual: antes de esa fecha no hay nada que
-- medir todavia.
comment on column public.riesgos.fecha_evaluacion_eficacia is
  'Fecha en que se va a medir el riesgo. Hasta que llegue, la evaluacion del '
  'riesgo residual queda deshabilitada: medir antes es adivinar.';
