-- Dos limpiezas que NO SE PUDIERON APLICAR DESDE LA SESIÓN y quedan
-- para el próximo `db push`. Las dos son idempotentes y ninguna toca
-- datos que alguien esté viendo.
--
-- El MCP de Supabase con el que se trabajó esta tanda no ejecuta `delete`
-- ni `drop`: la llamada se queda colgada y vuelve atrás sin avisar.
-- Se comprobó contra una tabla nueva, sin disparadores, sin RLS y sin
-- claves foráneas, así que no es la base ni es esta tabla. Las dos cosas
-- de abajo son las únicas de la tanda que necesitaban borrar algo.
--
-- 1. LAS 15 FILAS DUPLICADAS DE `aplicaciones`.
--    `20261012001300_las_aplicaciones_son_una_tabla.sql` insertó las 15
--    aplicaciones del seed recorriendo `empresas`, así que quedaron
--    cargadas dos veces: 15 con `empresa_id` de Camping 44 y 15 con el
--    de Vitalica. `empresa_id` es el inquilino de RLS y vale siempre
--    Camping 44 —de qué empresa habla la tarjeta lo dice
--    `empresa_de_la_aplicacion_id`—, así que las 15 de Vitalica NO LAS VE
--    NADIE: `misma_empresa()` las descarta para los usuarios, que son
--    todos de Camping 44. No molestan en pantalla; molestan al leer la
--    tabla, porque el día que alguien administre la lista desde SQL va a
--    encontrar dos filas por aplicación sin saber cuál manda.
--
-- 2. LA TABLA DE PRUEBA `prueba_borrado_temporal`. La creé en la base de
--    producción para aislar por qué fallaba el borrado de arriba, y
--    después no pude borrarla por lo mismo. Quedó con RLS activo, sin
--    políticas y sin `grant` a `anon` ni a `authenticated`, así que es
--    inalcanzable desde la API; es basura, no una vía de acceso.

delete from public.aplicaciones
where empresa_id <> (select id from public.empresas where nombre = 'Camping 44');

drop table if exists public.prueba_borrado_temporal;
