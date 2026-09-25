-- =====================================================================
-- Intranet - Camping 44 S.A.
-- Consecuencias de la NC y analisis horizontal de la accion correctiva
-- =====================================================================
-- Dos pedidos de Calidad sobre el formulario de no conformidades.
--
-- 1. CONSECUENCIAS / IMPACTO. Debajo de la descripcion, que dice QUE
--    paso, ahora se pide QUE PROVOCA. Son cosas distintas y hasta ahora
--    se mezclaban en el mismo parrafo: «faltaron 12 unidades en el
--    conteo» no es lo mismo que «se entrego de menos a dos clientes y
--    hubo que reponer». Lo segundo es lo que decide la severidad y la
--    urgencia.
--
-- 2. ANALISIS HORIZONTAL. Al responder la no conformidad, despues de las
--    acciones, se pregunta si existen no conformidades similares o que
--    puedan ocurrir. Si la respuesta es que si, hay que detallar como el
--    mismo hecho pudo ocurrir en otro proceso o departamento. Es lo que
--    evita arreglar el sintoma en un solo lugar y que reaparezca al lado.
--
-- LAS COLUMNAS NACEN ACEPTANDO NULO aunque los campos sean obligatorios
-- en el formulario. Hay no conformidades ya cargadas y no se les puede
-- inventar el dato: se pide de ahora en adelante, y lo exige la accion de
-- servidor. Poner NOT NULL obligaria a rellenar lo viejo con un texto
-- falso, que es peor que un vacio honesto.

alter table public.no_conformidades
  add column if not exists consecuencias text;

comment on column public.no_conformidades.consecuencias is
  'Consecuencias e impacto de los eventos que ocasiona la no conformidad. '
  'Obligatorio al cargar; nulo en las anteriores a este campo.';

alter table public.no_conformidades
  add column if not exists hay_nc_similares boolean;

comment on column public.no_conformidades.hay_nc_similares is
  'Si existen no conformidades similares o que potencialmente puedan '
  'ocurrir. Se responde al cargar la accion correctiva.';

alter table public.no_conformidades
  add column if not exists analisis_horizontal text;

comment on column public.no_conformidades.analisis_horizontal is
  'Como el hecho que disparo la no conformidad ocurrio o puede ocurrir en '
  'otro proceso o departamento. Obligatorio cuando hay_nc_similares.';

-- Decir que si y no detallar nada deja la pregunta sin responder de
-- verdad. La accion de servidor lo valida con un mensaje en castellano;
-- esto es la red por debajo, para que no entre por ningun otro camino.
alter table public.no_conformidades
  drop constraint if exists no_conformidades_analisis_horizontal_necesario;

alter table public.no_conformidades
  add constraint no_conformidades_analisis_horizontal_necesario
  check (
    hay_nc_similares is not true
    or (analisis_horizontal is not null and length(btrim(analisis_horizontal)) > 0)
  );

-- ---------------------------------------------------------------------
-- La columna `area` ahora se llama «Departamento» en la interfaz
-- ---------------------------------------------------------------------
-- Calidad pidio que en todos lados diga Departamento y no Area. Es un
-- cambio de como se lee, no de que se guarda: la columna conserva su
-- nombre para no arrastrar el CHECK, el indice y el importador detras de
-- una palabra. Queda anotado para que nadie lo lea como dos cosas.
comment on column public.no_conformidades.area is
  'Departamento de los trece que gestiona la no conformidad. La columna '
  'conserva el nombre «area» por historia; en la interfaz se lee '
  '«Departamento».';
