-- =====================================================================
-- Intranet - Camping 44 S.A.
-- Que ventas puede ver cada persona, ademas de las suyas
-- =====================================================================
-- Facundo pidio poder decidir quien ve las ventas de quien: hay jefes de
-- Consumidor Final, de Mayoristas, y esta el Directorio, que ve todo.
--
-- POR CANAL Y NO POR JERARQUIA. `usuarios.superior_id` ya existe, pero
-- solo dos de cuarenta y nueve personas entraron al sistema: casi nadie
-- tiene su lider cargado y un permiso que dependiera de eso no le
-- serviria hoy a nadie. El canal es ademas lo que define la propia
-- planilla comercial, asi que alcanza con configurar a los jefes.
--
-- SE GUARDAN LOS CANALES SUELTOS, no los grupos. Los grupos
-- —«Consumidor Final»— son un atajo de la pantalla de configuracion. El
-- dia que alguien tenga que ver Salon sin Online, se marca y listo, sin
-- volver a tocar la base.
--
-- DIRECCION NO SE CONFIGURA: el rol `direccion` ve todo por si mismo. El
-- Administrador SGC no entra en esa excepcion —administrar el sistema no
-- es motivo para ver cuanto vende cada uno— aunque puede asignarselo a
-- mano, que asi queda a la vista de cualquiera que mire la configuracion.
--
-- Vacio, que es el valor por defecto, significa «solo lo suyo».

alter table public.usuarios
  add column if not exists ventas_canales text[] not null default '{}';

-- Los canales admitidos son los de la planilla. Sin esto, un valor mal
-- escrito no daria error: simplemente no mostraria nada, y averiguar por
-- que llevaria mucho mas tiempo que escribir esta restriccion.
alter table public.usuarios
  drop constraint if exists usuarios_ventas_canales_validos;

alter table public.usuarios
  add constraint usuarios_ventas_canales_validos
  check (
    ventas_canales <@ array[
      'Salon', 'Online', 'Venta Externa', 'E-commerce', 'Mayoristas', 'Directorio'
    ]::text[]
  );

comment on column public.usuarios.ventas_canales is
  'Canales de la planilla comercial cuyo detalle por vendedor puede ver '
  'esta persona, ademas de sus propias ventas. Vacio = solo lo suyo. El '
  'rol direccion ve todo sin necesidad de cargarlo aca.';

-- Se corrige de paso el comentario de la columna vecina, que quedo
-- describiendo algo que ya no es cierto: la union con la planilla no se
-- hace por la columna «Cod» sino por el nombre del vendedor, porque el
-- informe resulto no tener tal columna.
comment on column public.usuarios.vendedor_planilla is
  'Nombre del vendedor tal como figura en la planilla comercial. Tolera '
  'que este mas corto que en Odoo. Vacio = la persona no es comercial.';
