-- Las dos tarjetas del canal de denuncias dicen qué tipo de cosa son.
--
-- POR QUÉ HACE FALTA UNA MIGRACIÓN APARTE: las dos filas se insertaron
-- en `20261106000100_el_canal_de_denuncias_en_aplicaciones.sql`, pero
-- esa migración se aplicó contra la base en paralelo con
-- `20261109000100_cada_aplicacion_dice_que_tipo_de_cosa_es.sql`, desde
-- otra sesión. Si la inserción llegó después del `ALTER`, las dos filas
-- tomaron el valor por omisión de la columna —`tablero`— y el `update`
-- que clasifica por nombre ya había corrido sobre una tabla donde
-- todavía no existían. En un replay desde cero el orden alfabético lo
-- resuelve solo; en la base de producción puede haber quedado mal.
--
-- Se vuelve a afirmar la clasificación de las dos, que es idempotente:
-- si ya estaban bien, no cambia nada.
--
--  · «Canal de denuncias» es una HERRAMIENTA y no un tablero: es un
--    formulario que se completa, no algo que se mira. Es el mismo caso
--    que «Objetivos Mensuales · Comercial», y la razón por la que la
--    clasificación sale de la descripción y no del nombre.
--
--  · «Informe de denuncias» sí es un TABLERO: el Comité lo consulta.
--    Queda explícito igual, para no depender del valor por omisión.

update public.aplicaciones set tipo = 'herramienta'
 where nombre = 'Canal de denuncias'
   and tipo <> 'herramienta';

update public.aplicaciones set tipo = 'tablero'
 where nombre = 'Informe de denuncias'
   and tipo <> 'tablero';
