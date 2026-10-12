-- ---------------------------------------------------------------------
-- «Otro» entre los origenes del reclamo
--
-- La lista de «Como nos enteramos» tenia nueve opciones y ninguna salida
-- para lo que no entra en ninguna. `tipo_falla_reclamo` ya tenia su
-- `otro` desde el principio; este enumerado no.
--
-- Sin esa salida, quien registra elige la que menos se parece y el dato
-- queda peor que vacio: un reclamo contado como «queja verbal» que no lo
-- fue ensucia el conteo por origen, que es de lo que Calidad saca sus
-- conclusiones.
--
-- Va ULTIMO en la lista que ve la persona —en `ORIGENES_RECLAMO`— y no
-- en orden alfabetico: el cajon de sastre se elige cuando ninguna de las
-- anteriores sirve, y ofrecerlo antes es invitar a no leer el resto.
-- ---------------------------------------------------------------------

alter type public.origen_reclamo add value if not exists 'otro';
