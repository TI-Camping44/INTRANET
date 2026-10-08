-- ---------------------------------------------------------------------
-- El seguimiento de la accion del plan, al modelo de la accion
-- correctiva.
--
-- QUE PIDIO DIRECCION el 8 de octubre: que la accion del plan de
-- objetivos se siga como se sigue una accion correctiva. Es decir que se
-- pueda adjuntar evidencia, mover el estado y, al final, declarar si fue
-- eficaz o no.
--
-- LA EVIDENCIA NO NECESITA ESQUEMA. `adjuntos` es generica —`entidad` +
-- `entidad_id`— y su RLS no mira el valor de `entidad`, asi que alcanza
-- con usar 'objetivo_planes'. Es lo mismo que hace la accion correctiva
-- con 'nc_acciones'.
--
-- EL ESTADO YA ESTABA: `objetivo_planes.estado`, con los cinco valores
-- del CHECK. Lo que faltaba era la eficacia.
--
-- LA EFICACIA SOLO CON LA ACCION CUMPLIDA. Declararla sobre una accion
-- que todavia no se ejecuto seria opinar sobre algo que no paso; es la
-- misma regla que la accion correctiva, donde la eficacia se verifica
-- recien con las tareas ejecutadas.
-- ---------------------------------------------------------------------

alter table public.objetivo_planes
  add column if not exists eficacia text,
  add column if not exists fecha_evaluacion_eficacia date,
  add column if not exists observacion_eficacia text;

alter table public.objetivo_planes
  drop constraint if exists objetivo_planes_eficacia_valida;

alter table public.objetivo_planes
  add constraint objetivo_planes_eficacia_valida
    check (eficacia is null or eficacia in ('eficaz', 'no_eficaz'));

alter table public.objetivo_planes
  drop constraint if exists objetivo_planes_eficacia_tras_cumplir;

alter table public.objetivo_planes
  add constraint objetivo_planes_eficacia_tras_cumplir
    check (eficacia is null or estado = 'cumplido');

comment on column public.objetivo_planes.eficacia is
  'Si la accion sirvio para lo que se hizo. Se declara recien con la '
  'accion cumplida, igual que en la accion correctiva.';
