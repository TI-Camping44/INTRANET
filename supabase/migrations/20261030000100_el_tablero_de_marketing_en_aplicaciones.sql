-- El Tablero de Marketing en Aplicaciones.
--
-- Diego lo pidió el 15 de octubre y Martín Benítez pasó el enlace el 16.
-- Quedó sin cargar: Facundo lo notó el 30.
--
-- SE LLAMA «Tablero de Marketing», NO «Tablero Estratégico de
-- Marketing». Diego lo nombró «estratégico» en el chat, pero el producto
-- se llama así en su propio `<title>` y en su `<h1>`, y la regla del
-- proyecto es que el nombre sale del producto. Es GitHub Pages, así que
-- se pudo comprobar de verdad: clonando el repositorio y leyendo el
-- HTML, que es lo que no se puede hacer con los de Apps Script.
--
-- VA SIN MARCAR EMPRESA, Y SE VERIFICO. No es el `null` por omisión:
-- adentro tiene pestañas por marca y los dos logotipos, con nueve
-- recursos de Camping 44 —presupuesto, campañas, informes, pautas, leads
-- del CRM, Analytics, redes, plan de posteos y NPS— y ocho de Vitalica
-- —control presupuestario, informes, redes, web, pautas, calendario de
-- eventos, nutricionistas y embajadores—.
--
-- LO VEN DIRECCION Y LOS RESPONSABLES DE PROCESO, no toda la empresa:
-- el índice lleva adentro el Presupuesto de Marketing y el Control
-- Presupuestario de Vitalica.
--
-- LA DIRECCION VA TAL COMO LA PASO MARTIN, con la mayúscula incluida.
-- No se pudo abrir desde acá —el proxy de salida bloquea `github.io`— y
-- en GitHub Pages el camino distingue mayúsculas, así que copiar lo que
-- mandó el dueño es más seguro que normalizarlo.
--
-- OJO CON LO QUE ESTO NO HACE: la página es pública en Internet, así que
-- quien tenga el enlace ve la lista de los 17 recursos y sus
-- direcciones. Lo que protege el contenido de cada planilla es el
-- permiso de Google de esa planilla, no esta tarjeta.

insert into public.aplicaciones
  (empresa_id, nombre, descripcion, url, publico, orden, roles_visibles, usuarios_visibles)
values (
  (select id from public.empresas where nombre = 'Camping 44'),
  'Tablero de Marketing',
  'El índice del área de Marketing: presupuesto, campañas, pautas, redes, Analytics e informes, con pestañas separadas para Camping 44 y Vitalica.',
  'https://martinbenitez-web.github.io/Proyectos-Martin/',
  'comercial',
  14,
  array['direccion', 'responsable_proceso']::public.rol_usuario[],
  '{}'::uuid[]
)
on conflict (empresa_id, nombre) do nothing;
