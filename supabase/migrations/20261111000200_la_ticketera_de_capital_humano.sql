-- La ticketera de Capital Humano en Aplicaciones.
--
-- Es la octava del grupo «Solicitudes y pedidos» y la séptima con un
-- área detrás. Se carga exactamente como sus hermanas, porque es lo
-- mismo: un formulario de Apps Script que vive en Workspace y que la
-- intranet enlaza, no absorbe.
--
-- EL ÁREA VA EN LA COLUMNA, no solo en el nombre. `capital_humano` es
-- uno de los catorce departamentos que ya usa el `CHECK` de
-- `no_conformidades.area`, así que no se abre una taxonomía nueva. Acá
-- el nombre ya lo dice, pero la columna es la que hace que la tarjeta
-- lleve su «Lo resuelve Capital Humano» abajo de la descripción y que
-- la lista se escanee entera por área.
--
-- ES DEL GRUPO Y POR ESO `empresa_de_la_aplicacion_id` QUEDA NULO.
-- Quien lo pasó aclaró que cualquier persona de Camping 44 o de
-- Vitalica pide desde el mismo enlace, y que cada una ve el formulario
-- y sus propios pedidos: no es una tarjeta por empresa.
--
-- `orden` se carga pero ya no decide nada: desde el 9 de noviembre la
-- pantalla ordena por nombre dentro de cada grupo.

insert into public.aplicaciones
  (empresa_id, nombre, descripcion, url, publico, tipo, orden,
   roles_visibles, usuarios_visibles, departamento_que_resuelve)
values (
  (select id from public.empresas where nombre = 'Camping 44'),
  'Tickets de Solicitud para Capital Humano',
  'Para los pedidos que resuelve Capital Humano.',
  'https://script.google.com/a/camping44.com.py/macros/s/AKfycbwYFzs3E0yZXwmq0MvfsEQy7f8rveq7U9IYmZBaINeQjhUr5uY478NJcNWthC-_Tr7j/exec',
  'solicitudes',
  'solicitud',
  8,
  array['direccion', 'responsable_proceso', 'auditor', 'vendedor', 'colaborador']::public.rol_usuario[],
  '{}'::uuid[],
  'capital_humano'
)
on conflict (empresa_id, nombre) do nothing;
