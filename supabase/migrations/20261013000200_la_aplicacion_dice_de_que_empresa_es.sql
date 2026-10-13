-- ---------------------------------------------------------------------
-- La aplicacion dice de que empresa del grupo es
--
-- Llego el tablero de rotacion ABC de Vitalica y, al lado del de
-- Camping 44, las dos tarjetas se leen igual: hay que abrir el enlace
-- para saber cual es cual. El grupo son dos empresas y la convencion del
-- sistema ya esta resuelta —«Vitalica se distingue por color, no por una
-- pantalla aparte»—: franja naranja arriba y la palabra «Vitalica», como
-- en el organigrama.
--
-- COLUMNA PROPIA Y NO `empresa_id`. `empresa_id` es el inquilino, el
-- predicado de `misma_empresa()`, y siempre vale Camping 44: si se
-- pusiera Vitalica ahi, la fila dejaria de verse para todo el mundo.
-- Es el mismo motivo por el que existen `auditorias.empresa_auditada_id`
-- y `puestos.empresa_del_puesto_id`.
--
-- NULO ES UN VALOR: quiere decir que la aplicacion es del grupo y no de
-- una empresa en particular, que es el caso de casi todas —los tickets,
-- los catalogos, el panel de NPS—. Marcar todas como Camping 44 llenaria
-- la pantalla de etiquetas que no distinguen nada.
-- ---------------------------------------------------------------------

alter table public.aplicaciones
  add column if not exists empresa_de_la_aplicacion_id uuid references public.empresas (id);

comment on column public.aplicaciones.empresa_de_la_aplicacion_id is
  'De que empresa del grupo es la aplicacion. Nulo: es del grupo. No '
  'confundir con empresa_id, que es el inquilino y siempre vale '
  'Camping 44.';

-- Las dos que ya estaban y son de Vitalica. Van por nombre porque el id
-- lo genera la base y no hay forma de nombrarlas de otra manera desde
-- una migracion.
update public.aplicaciones
set empresa_de_la_aplicacion_id = '22222222-2222-4222-8222-222222222222'
where nombre in ('Informe de ventas · Vitalica', 'Rotación ABC · Vitalica');
