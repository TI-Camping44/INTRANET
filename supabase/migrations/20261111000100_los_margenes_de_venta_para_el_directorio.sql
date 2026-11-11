-- Los dos tableros de Márgenes de Venta, para el Directorio.
--
-- Llegaron el 11 de noviembre: dos enlaces de Apps Script, uno por
-- empresa del grupo, pedidos para el Directorio.
--
-- EL MISMO INFORME SE LLAMA IGUAL EN LAS DOS EMPRESAS Y LO QUE CAMBIA ES
-- EL SUFIJO, que es la regla que dejó Diego el 15 de octubre: vinieron
-- escritos «Márgenes de Venta de Vitalica» y «Márgenes de Venta de
-- Camping44», y así, uno al lado del otro, se leen como dos informes
-- distintos en vez de como el mismo informe de dos operaciones. Van con
-- la misma descripción y seguidos, por lo mismo.
--
-- LAS MAYÚSCULAS SON LAS DE UN NOMBRE PROPIO —«Márgenes de Venta», no
-- «Márgenes de venta»—, como el resto de la lista: en minúscula quedan
-- solo los enlaces.
--
-- LAS DOS DECLARAN SU EMPRESA, no solo la de Vitalica. Es como están
-- cargados los otros dos pares —«Informe de Ventas» y «Reporte de Stock
-- y Rotación», los dos con su `empresa_de_la_aplicacion_id` puesto en
-- las dos filas—: cuando el par existe, nulo dejaría de querer decir
-- «es del grupo» para querer decir «es la que no es de Vitalica», que
-- es una lectura que la columna no tiene. `empresa_id` sigue valiendo
-- Camping 44 en las dos, porque es el inquilino de RLS y no «de qué
-- empresa habla el registro»: ponerle Vitalica a una la dejaría sin que
-- la vea nadie, que es justamente la fila muerta que se limpia en la
-- migración siguiente.
--
-- SON TABLEROS: se miran, no se completan ni se operan. Es lo que decide
-- `tipo` desde el 9 de noviembre, y lo que hace que queden en el tramo
-- «Tableros e informes» de su grupo.
--
-- VAN CON EDUARDO KEMPER NOMBRADO A MANO, por el mismo motivo que los
-- tres reportes que pasó Ariel el 23 de octubre: es el Presidente, del
-- área Directorio, y su perfil tiene rol `colaborador`, así que
-- `roles_visibles = {direccion}` —Diego Kemper y Ariel Kemper— lo
-- dejaría afuera justamente de un reporte del Directorio.
-- `usuarios_visibles` lo resuelve sin tocarle el rol, que es una
-- decisión aparte y de mucho más alcance.
--
-- NO SE PUDIERON ABRIR PARA VERIFICARLAS: son de Apps Script y exigen
-- cuenta del dominio, así que el nombre y el destino son los que declaró
-- quien las pasó, igual que con los otros tableros de Workspace.

insert into public.aplicaciones
  (empresa_id, nombre, descripcion, url, publico, tipo, orden,
   roles_visibles, usuarios_visibles, empresa_de_la_aplicacion_id)
select
  (select id from public.empresas where nombre = 'Camping 44'),
  entrada.nombre,
  entrada.descripcion,
  entrada.url,
  'direccion',
  'tablero',
  entrada.orden,
  array['direccion']::public.rol_usuario[],
  array(select id from public.usuarios where correo = 'eduardokemper@camping44.com.py'),
  entrada.empresa
from (values
  (
    'Márgenes de Venta · Camping 44',
    'Los márgenes de venta de la operación. Para el Directorio.',
    'https://script.google.com/a/macros/camping44.com.py/s/AKfycbzjTRCytK0LQNvFwNWq8tAnfRv-OUPiHl882olA5XIIpRKif1IkR7tETj-tNIzTKLA/exec',
    4,
    '11111111-1111-4111-8111-111111111111'::uuid
  ),
  (
    'Márgenes de Venta · Vitalica',
    'Los márgenes de venta de la operación. Para el Directorio.',
    'https://script.google.com/a/macros/camping44.com.py/s/AKfycbzka833bfjj3f6Mpu06-ev0Va3B6WQXZs2KdC65REvn24UGUgoKYOMTfjVB1L7HN6SK/exec',
    5,
    '22222222-2222-4222-8222-222222222222'::uuid
  )
) as entrada(nombre, descripcion, url, orden, empresa)
on conflict (empresa_id, nombre) do nothing;
