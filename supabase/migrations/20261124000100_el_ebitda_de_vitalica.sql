-- El EBITDA de Vitalica en Aplicaciones.
--
-- Lo pasó Ariel Kemper el 23 de noviembre: «Este es el dashboard de
-- EBITDA de Vitalica». Es el cuarto caso de la misma aplicación en las
-- dos empresas, después del Informe de Ventas, el Reporte de Stock y
-- Rotación y los Objetivos Mensuales.
--
-- SE CARGA SOLO LA DE VITALICA, Y LA QUE YA ESTABA NO SE TOCA. Es la
-- diferencia con los Objetivos Mensuales de ayer, donde la de Camping 44
-- se renombró para que el par se leyera junto. Acá no se puede hacer lo
-- mismo sin inventar un dato: la tarjeta existente se llama «EBITDA», su
-- descripción dice «El EBITDA DEL GRUPO» y `empresa_de_la_aplicacion_id`
-- está nulo, que en esta tabla significa exactamente eso. Si el número
-- que muestra es el consolidado de las dos empresas, el nombre y el nulo
-- son correctos y renombrarla a «· Camping 44» sería mentir sobre su
-- contenido. Si en cambio es solo el de Camping 44, corresponde el par
-- completo como en los otros tres.
--
-- No se puede resolver mirando: es una aplicación de Apps Script y exige
-- cuenta del dominio, así que desde el entorno de desarrollo no se abre.
-- La pregunta quedó hecha a quien la pasó; mientras tanto la de Vitalica
-- entra igual, porque es correcta bajo cualquiera de las dos lecturas.
--
-- EL PÚBLICO SE COPIA DE SUS HERMANAS DE DIRECCIÓN, no se decide acá:
-- rol `direccion` más Eduardo Kemper nombrado en `usuarios_visibles`.
-- Eduardo es el Presidente y su perfil tiene rol `colaborador`, así que
-- «lo ve Dirección» lo dejaría afuera justamente del reporte del
-- Directorio. Es la misma excepción que ya llevan el EBITDA, los dos
-- Márgenes de Venta, la Planilla Financiera y el Reporte de Cobranzas.
-- Lo que correspondería revisar es el rol, no seguir sumando nombres.

insert into public.aplicaciones
  (empresa_id, nombre, descripcion, url, publico, tipo, orden,
   roles_visibles, usuarios_visibles, departamento_que_resuelve,
   empresa_de_la_aplicacion_id)
values (
  (select id from public.empresas where nombre = 'Camping 44'),
  'EBITDA · Vitalica',
  'El EBITDA de la operación. Lo pasó Ariel Kemper para el Directorio.',
  'https://script.google.com/a/macros/camping44.com.py/s/AKfycby_pyY9oznwA05pg6fA1mcLe8m403mRCc5VaU3cZGqyb2N56lJqyOgoswQx3rN8x2-5/exec',
  'direccion',
  'tablero',
  6,
  array['direccion']::public.rol_usuario[],
  array['45a3f82e-7897-43ca-bdf7-653973526973']::uuid[],
  null,
  (select id from public.empresas where nombre = 'Vitalica')
)
on conflict (empresa_id, nombre) do nothing;
