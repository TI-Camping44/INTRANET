-- ---------------------------------------------------------------------
-- Retirar la funcion temporal de carga de indicadores
--
-- `cargar_indicadores_de_planilla(jsonb)` se creo el 5 de octubre solo
-- para la carga inicial de la hoja 6.2 del F-EST-01/07: el conector de
-- la base corta a los 60 segundos y la lista de columnas repetida no
-- entraba en una sola llamada, asi que se la puso del otro lado.
--
-- Hecha la carga, no tiene razon de existir. Una funcion que inserta
-- indicadores a partir de un JSON suelto es un camino de escritura que
-- no pasa por la accion de servidor ni por su validacion, y eso no se
-- deja abierto.
--
-- Ya se le quitaron los permisos de ejecucion a `authenticated` y a
-- `anon` el mismo dia, asi que desde la aplicacion esta inerte. Esto la
-- borra.
-- ---------------------------------------------------------------------

drop function if exists public.cargar_indicadores_de_planilla(jsonb);
