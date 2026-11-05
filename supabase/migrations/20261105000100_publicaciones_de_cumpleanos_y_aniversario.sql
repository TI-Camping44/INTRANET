-- Dos tipos de publicacion para lo que el muro anuncia solo.
--
-- El muro de inicio pasa a publicar el dia que alguien cumple anos o
-- cumple anos en la empresa, ademas de la tarjeta de la derecha, que
-- queda. Lo pidio Facundo el 5 de noviembre.
--
-- SON DOS TIPOS Y NO UNO: la tarjeta ya los distingue —torta y matasuegras—
-- y en el muro cada tarjeta dice su etiqueta, asi que un solo valor
-- obligaria a rotular «Cumpleanos y aniversarios» una publicacion que es
-- una de las dos cosas.
--
-- Y NO SE REUSA `reconocimiento`, que en un SGC significa algo concreto
-- —reconocer un merito— y mezclarlo con un cumpleanos ensuciaria una
-- categoria que se usa de verdad.
--
-- Quedan FUERA del desplegable del alta manual, por `TIPOS_PUBLICACION_VIGENTES`,
-- igual que `ESTADOS_PLAN_VIGENTES` y `ORIGENES_NC_VIGENTES`: los escribe
-- el trabajo programado, no una persona.

alter type public.tipo_publicacion add value if not exists 'cumpleanos';
alter type public.tipo_publicacion add value if not exists 'aniversario';
