-- El EBITDA que ya estaba es el de Camping 44.
--
-- La migración anterior cargó «EBITDA · Vitalica» y dejó la existente
-- sin tocar, porque su descripción decía «El EBITDA DEL GRUPO» con
-- `empresa_de_la_aplicacion_id` nulo —que en esta tabla significa
-- exactamente eso— y renombrarla sin saber habría sido inventar el
-- dato. El Responsable de TI lo confirmó el 24 de noviembre: «ese es de
-- Vitalica, el otro es de Camping 44».
--
-- Así que el par va completo, como el Informe de Ventas, el Reporte de
-- Stock y Rotación y los Objetivos Mensuales. Los dos quedan juntos
-- —la lista ordena por tipo y después alfabéticamente— y el de Vitalica
-- sale con su franja naranja.
--
-- Y LA DESCRIPCIÓN ESTABA MAL, no solo el nombre: decía que el número
-- era el del grupo cuando es el de una de las dos empresas. Eso no es
-- una etiqueta desprolija, es un tablero del Directorio diciendo que
-- muestra algo que no muestra. Queda con las mismas palabras que su
-- par, que es lo que manda la regla de los pares.
--
-- Va en una migración nueva y no corrigiendo la anterior: las migraciones
-- aplicadas en producción no se editan.

update public.aplicaciones
set nombre = 'EBITDA · Camping 44',
    descripcion = 'El EBITDA de la operación. Lo pasó Ariel Kemper para el Directorio.',
    empresa_de_la_aplicacion_id =
      (select id from public.empresas where nombre = 'Camping 44')
where nombre = 'EBITDA';
