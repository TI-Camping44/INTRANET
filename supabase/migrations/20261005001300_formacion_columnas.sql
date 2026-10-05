-- ---------------------------------------------------------------------
-- Formacion y Competencia: lo que la accion formativa necesita
--
-- El segundo submodulo de Personas. Es donde Capital Humano planifica
-- las acciones formativas del año y les sigue el rastro.
--
-- SE REUSA `capacitaciones` Y NO SE CREA UNA TABLA NUEVA. Estaba vacia,
-- ya tenia el nombre, el tipo, las fechas y el estado, y
-- `capacitacion_participantes` ya guarda la eficacia por persona, que es
-- la regla que importa: la eficacia de una capacitacion se verifica por
-- persona y no por curso. Una tabla paralela habria duplicado ese
-- vinculo y la regla con el.
--
-- Lo que se agrega:
--
--   · MODALIDAD. Presencial, e-learning, mixto u otros. Es como se
--     dicta; `tipo` es quien la dicta, interna o externa. Son dos
--     preguntas distintas y la planilla de Capital Humano las tiene en
--     dos columnas.
--
--   · EL FORMADOR, EN DOS CAMPOS. Si la accion es interna el formador es
--     una persona de la casa y se elige de la lista: va en
--     `formador_id`. Si es externa no tiene perfil en la intranet y el
--     nombre se escribe: va en `instructor`, que ya existia. Guardar las
--     dos cosas en un solo campo de texto perderia el vinculo con la
--     persona justo en el caso en que lo hay.
--
--   · LA DURACION EN TRES DATOS: desde, hasta, cuantas sesiones y
--     cuantas horas dura cada una. De ahi salen las horas totales y, con
--     ellas, si la accion exige Evaluacion de Eficacia de la Formacion.
--
--   · EL CORTE DE LAS DOS HORAS, COMO COLUMNA GENERADA. Una formacion de
--     mas de dos horas exige evaluar su eficacia. Se calcula en la base
--     y no en la pantalla para que no se pueda contradecir: la pantalla
--     avisa, la columna manda.
--
--   · EL MOTIVO Y LA FECHA NUEVA. Cuando una accion no se ejecuta o se
--     pospone hay que decir por que y para cuando. Un plan anual con
--     acciones caidas y sin motivo no se puede revisar, que es
--     justamente lo que la Revision por la Direccion mira.
--
-- El plan o programa y las evidencias de ejecucion —registro de
-- participacion, certificados— no necesitan columna: van en `adjuntos`,
-- que es generica, con entidad 'capacitaciones'.
-- ---------------------------------------------------------------------

alter table public.capacitaciones
  add column if not exists modalidad text,
  add column if not exists objetivo text,
  add column if not exists formador_id uuid references public.usuarios (id),
  add column if not exists cantidad_sesiones smallint,
  add column if not exists horas_por_sesion numeric(4, 2),
  add column if not exists comentario_estado text,
  add column if not exists fecha_nueva date,
  add column if not exists creado_por uuid references public.usuarios (id);

comment on column public.capacitaciones.modalidad is
  'Presencial, e-learning, mixto u otros. Es como se dicta; `tipo` es quien la '
  'dicta (interna o externa).';
comment on column public.capacitaciones.formador_id is
  'El formador cuando la accion es interna: una persona de la casa. Si es externa '
  'el nombre va en `instructor`, en texto, porque el formador no tiene perfil en '
  'la intranet.';
comment on column public.capacitaciones.comentario_estado is
  'Por que no se ejecuto o por que se pospuso. Obligatorio en esos dos estados: un '
  'plan anual con acciones caidas y sin motivo no se puede revisar.';

alter table public.capacitaciones
  drop constraint if exists capacitaciones_modalidad_valida;
alter table public.capacitaciones
  add constraint capacitaciones_modalidad_valida
  check (modalidad is null or modalidad in ('presencial', 'e_learning', 'mixto', 'otros'));

alter table public.capacitaciones
  drop constraint if exists capacitaciones_sesiones_positivas;
alter table public.capacitaciones
  add constraint capacitaciones_sesiones_positivas
  check (cantidad_sesiones is null or cantidad_sesiones > 0);

alter table public.capacitaciones
  drop constraint if exists capacitaciones_horas_positivas;
alter table public.capacitaciones
  add constraint capacitaciones_horas_positivas
  check (horas_por_sesion is null or (horas_por_sesion > 0 and horas_por_sesion <= 24));

-- El periodo tiene que cerrar: sin esto se puede guardar una formacion
-- que termina antes de empezar y el calendario deja de significar algo.
alter table public.capacitaciones
  drop constraint if exists capacitaciones_periodo_coherente;
alter table public.capacitaciones
  add constraint capacitaciones_periodo_coherente
  check (fecha_inicio is null or fecha_fin is null or fecha_inicio <= fecha_fin);

alter table public.capacitaciones
  add column if not exists horas_totales numeric(6, 2)
  generated always as (coalesce(cantidad_sesiones, 0) * coalesce(horas_por_sesion, 0)) stored;

alter table public.capacitaciones
  add column if not exists requiere_eficacia boolean
  generated always as (coalesce(cantidad_sesiones, 0) * coalesce(horas_por_sesion, 0) > 2) stored;

comment on column public.capacitaciones.requiere_eficacia is
  'Generada: una formacion de mas de 2 horas exige Evaluacion de Eficacia de la '
  'Formacion. La eficacia se verifica por persona y no por curso: vive en '
  '`capacitacion_participantes.eficacia`.';

-- La accion formativa no lleva codigo. Capital Humano la identifica por
-- su nombre, y el formulario que pidio Direccion no lo pide. La columna
-- queda, vacia, por si Calidad decide codificarlas mas adelante.
alter table public.capacitaciones alter column codigo drop not null;

comment on column public.capacitaciones.codigo is
  'Opcional. El formulario de acciones formativas no lo pide: Capital Humano '
  'identifica la accion por su nombre. La columna queda por si Calidad decide '
  'codificarlas.';
