-- Cada solicitud dice que area la resuelve.
--
-- En «Solicitudes y pedidos» hay ocho tarjetas y la mayoria lleva el
-- area en el nombre —«para Logistica», «para Calidad»—, pero NO TODAS:
-- «Nota de Retiro de Equipos» es de Informatica y no hay forma de
-- saberlo sin abrirla. Lo marco Facundo el 4 de noviembre.
--
-- Se resuelve con el dato, no con un caso especial para Informatica: la
-- tarjeta dice a que area va el pedido y las dos de TI quedan marcadas
-- igual que las demas. El dia que entre una novena solicitud, se carga
-- su area y se ve sola.
--
-- USA LA LISTA DE DEPARTAMENTOS QUE YA EXISTE, la misma del `CHECK` de
-- `no_conformidades.area`, para no abrir una segunda taxonomia de areas
-- que despues haya que mantener en dos lados.
--
-- NULO ES UN VALOR y quiere decir «no corresponde o no se sabe»: lo
-- llevan las aplicaciones que no son solicitudes —los catalogos, los
-- tableros— y dos solicitudes que no se pueden mapear sin inventar:
-- «Comercial» no es ninguno de los catorce departamentos —Consumidor
-- Final y Mayorista son sus dos canales— y de «Compra Interna» no esta
-- confirmado quien la resuelve.

alter table public.aplicaciones
  add column if not exists departamento_que_resuelve text;

alter table public.aplicaciones
  drop constraint if exists aplicaciones_departamento_que_resuelve_check;

alter table public.aplicaciones
  add constraint aplicaciones_departamento_que_resuelve_check
  check (
    departamento_que_resuelve is null
    or departamento_que_resuelve = any (array[
      'administracion', 'tesoreria_caja', 'creditos_cobranzas', 'contabilidad',
      'recepcion', 'consumidor_final', 'mayorista', 'marketing',
      'operaciones_logistica', 'informatica', 'capital_humano',
      'gestion_calidad', 'gestion_regulatoria', 'directorio'
    ])
  );

comment on column public.aplicaciones.departamento_que_resuelve is
  'Que area resuelve el pedido. Solo para las solicitudes; nulo en los catalogos y tableros.';

update public.aplicaciones set departamento_que_resuelve = 'informatica'
 where nombre in ('Tickets de Solicitud para TI', 'Nota de Retiro de Equipos');

update public.aplicaciones set departamento_que_resuelve = 'operaciones_logistica'
 where nombre = 'Tickets de Solicitud para Logística';

update public.aplicaciones set departamento_que_resuelve = 'marketing'
 where nombre = 'Tickets de Solicitud para Marketing';

update public.aplicaciones set departamento_que_resuelve = 'administracion'
 where nombre = 'Tickets de Solicitud para Administración';

update public.aplicaciones set departamento_que_resuelve = 'gestion_calidad'
 where nombre = 'Tickets de Solicitud para Calidad';

-- El orden tenia repetidos —Logistica y Nota de Retiro valian los dos 1—
-- asi que el desempate lo decidia PostgreSQL. Las dos de Informatica
-- quedan juntas, que es lo que hace evidente que son un par.
update public.aplicaciones set orden = 0 where nombre = 'Tickets de Solicitud para TI';
update public.aplicaciones set orden = 1 where nombre = 'Nota de Retiro de Equipos';
update public.aplicaciones set orden = 2 where nombre = 'Tickets de Solicitud para Logística';
update public.aplicaciones set orden = 3 where nombre = 'Tickets de Solicitud para Marketing';
update public.aplicaciones set orden = 4 where nombre = 'Tickets de Solicitud para Administración';
update public.aplicaciones set orden = 5 where nombre = 'Tickets de Solicitud para Calidad';
update public.aplicaciones set orden = 6 where nombre = 'Tickets de Solicitud para Comercial';
update public.aplicaciones set orden = 7 where nombre = 'Tickets de Solicitud de Compra Interna';
