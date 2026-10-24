-- El CRM Neural en Aplicaciones.
--
-- Lo pidió Facundo el 24 de octubre. Va al grupo «Comercial y
-- marketing», que es donde cae un CRM, y lo ven Dirección y los
-- Responsables de proceso.
--
-- SIN MARCAR EMPRESA, Y ES EL CASO CORRECTO DE `null`: el CRM lo usan
-- Camping 44 y Vitalica, así que es del grupo. Marcarlo con una de las
-- dos diría algo falso, y es la misma razón por la que los tickets, los
-- catálogos y el panel de NPS tampoco llevan etiqueta.
--
-- EL NOMBRE NO SE PUDO VERIFICAR ABRIENDOLO. La regla del proyecto es
-- que el nombre sale del producto y se comprueba en su propio título,
-- pero el proxy de salida del contenedor bloquea `neuralgenius.tech`
-- (403 en el CONNECT), igual que `*.vercel.app`. Lo que sí se vio es la
-- pantalla del producto en una captura: por dentro se llama
-- **NeuralOS**. La tarjeta dice «CRM Neural» porque es el nombre con el
-- que lo pidió y lo busca la empresa, y es una decisión tomada sabiendo
-- la diferencia, no un dato sin confirmar.

insert into public.aplicaciones
  (empresa_id, nombre, descripcion, url, publico, orden, roles_visibles, usuarios_visibles)
values (
  (select id from public.empresas where nombre = 'Camping 44'),
  'CRM Neural',
  'El CRM del grupo: conversaciones con clientes, calendario, reportes de ventas y agentes de IA. Lo usan Camping 44 y Vitalica.',
  'https://crm.neuralgenius.tech/inicio',
  'comercial',
  13,
  array['direccion', 'responsable_proceso']::public.rol_usuario[],
  '{}'::uuid[]
)
on conflict (empresa_id, nombre) do nothing;
