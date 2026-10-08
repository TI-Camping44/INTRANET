-- ---------------------------------------------------------------------
-- «Procesos declarados en el Plan» como opcion del proceso auditado.
--
-- El desplegable ofrecia un proceso suelto o «Sin proceso definido», y
-- ninguna de las dos describe lo que pasa en la practica: el alcance de
-- la auditoria son los procesos que el propio Plan enumera en su campo
-- «Alcance». «Sin proceso definido» se leia como un dato que falta, y no
-- falta nada.
--
-- Va como columna propia y no como un valor especial de `proceso_id`,
-- que es una clave foranea a `procesos` y no admite centinelas. Es
-- excluyente con `proceso_id`: si esta marcada, el proceso suelto se
-- limpia.
--
-- Lo mismo para el programa anual, que tiene el mismo campo.
--
-- Los adjuntos del plan y del programa no necesitan esquema: la tabla
-- `adjuntos` ya es generica —`entidad` + `entidad_id`— y ya tiene su RLS
-- y su tope de 20 MB.
-- ---------------------------------------------------------------------

alter table public.auditorias
  add column if not exists procesos_segun_plan boolean not null default false;

alter table public.programas_auditoria
  add column if not exists procesos_segun_plan boolean not null default false;

comment on column public.auditorias.procesos_segun_plan is
  'El alcance no es un proceso suelto: son los que declara el Plan. Excluyente con proceso_id.';
