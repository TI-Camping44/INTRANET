-- Los Objetivos Mensuales de Vitalica en Aplicaciones.
--
-- Lo pidió Facundo el 23 de noviembre: la carga de objetivos de ventas
-- de Vitalica, que hasta ahora no estaba en ninguna parte de la
-- intranet. Es la herramienta con la que se cargan las metas del mes
-- que después mide el Informe de Ventas de esa operación.
--
-- Y SE CARGA COMO PAR, no como tarjeta suelta. Es la tercera vez que
-- aparece la misma aplicación en las dos empresas, y las dos anteriores
-- ya quedaron resueltas así el 15 de octubre, cuando Diego marcó que
-- «hoy los mismos informes tenés con nombres diferentes»:
--
--   Informe de Ventas · Camping 44        Informe de Ventas · Vitalica
--   Reporte de Stock y Rotación · C44     Reporte de Stock y Rot. · Vit.
--
-- Por eso la de Camping 44 se renombra. Se llamaba «Objetivos Mensuales
-- · Comercial», con el ÁREA de sufijo y no la empresa: puesta al lado de
-- una «· Vitalica» el par se leería como «Comercial contra Vitalica»,
-- que compara un área con una empresa y es justamente la confusión que
-- la regla evita. Pasa a «· Camping 44» y las dos quedan juntas, porque
-- la lista ordena alfabéticamente dentro de cada grupo y tipo.
--
-- Y CON EL NOMBRE VA LA EMPRESA. `empresa_de_la_aplicacion_id` estaba
-- nulo en la de Camping 44 —nulo significa «es del grupo»— y eso dejaba
-- de ser cierto en el momento en que existe la de Vitalica. Con la
-- columna cargada, la de Vitalica sale con su franja naranja y el par
-- se distingue sin abrir el enlace, que es para lo que se marcó.
--
-- La descripción se iguala en las dos, como manda la misma regla. La
-- que tenía la de Camping 44 nombraba «el tablero comercial», que es un
-- nombre que ya no existe: ese tablero se llama «Informe de Ventas»
-- desde el 15 de octubre.
--
-- NO SE PUDO ABRIR EL ENLACE PARA VERIFICARLO. Es una aplicación de
-- Apps Script y exige cuenta del dominio, así que desde el entorno de
-- desarrollo no se puede comprobar qué muestra. El nombre y la
-- descripción salen de quien la pasó, como con sus hermanas.
--
-- `orden` se carga pero ya no decide nada: desde el 9 de noviembre la
-- pantalla ordena por tipo y después por nombre dentro de cada grupo.

-- ---------------------------------------------------------------------
-- 1. La de Camping 44 pasa a decir de qué empresa es
-- ---------------------------------------------------------------------

update public.aplicaciones
set nombre = 'Objetivos Mensuales · Camping 44',
    descripcion = 'Para cargar las metas del mes que después mide el Informe de Ventas.',
    empresa_de_la_aplicacion_id =
      (select id from public.empresas where nombre = 'Camping 44')
where nombre = 'Objetivos Mensuales · Comercial';

-- ---------------------------------------------------------------------
-- 2. La de Vitalica
-- ---------------------------------------------------------------------
--
-- `empresa_id` es el inquilino y vale siempre Camping 44, también para
-- las aplicaciones de Vitalica: de qué empresa HABLA la tarjeta lo dice
-- `empresa_de_la_aplicacion_id`.

insert into public.aplicaciones
  (empresa_id, nombre, descripcion, url, publico, tipo, orden,
   roles_visibles, usuarios_visibles, departamento_que_resuelve,
   empresa_de_la_aplicacion_id)
values (
  (select id from public.empresas where nombre = 'Camping 44'),
  'Objetivos Mensuales · Vitalica',
  'Para cargar las metas del mes que después mide el Informe de Ventas.',
  'https://script.google.com/a/macros/camping44.com.py/s/AKfycbxb7Q3TDaCGBetC5UQnpnwwUxPu3aJBua8oDuaVKB1hbu4hew9IVQ2YqjqUZ61yg6Rp/exec',
  'comercial',
  'herramienta',
  15,
  array['direccion', 'responsable_proceso', 'auditor', 'vendedor', 'colaborador']::public.rol_usuario[],
  '{}'::uuid[],
  null,
  (select id from public.empresas where nombre = 'Vitalica')
)
on conflict (empresa_id, nombre) do nothing;
