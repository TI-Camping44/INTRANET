-- =====================================================================
-- Intranet - Camping 44 S.A.
-- Baja del puesto ATC Posventa
-- =====================================================================
-- Decision de la Gerencia General del 25/09/2026, escrita en el
-- MP-EST-04: se elimina el cargo de ATC Posventa del organigrama y de
-- todos los procesos. Su funcion en Experiencia y Fidelizacion de
-- Clientes la asume el Supervisor del Canal Consumidor Final.
--
-- SE DA DE BAJA, NO SE BORRA. El puesto puede estar referenciado en
-- perfiles, competencias y evaluaciones historicas, y borrarlo dejaria
-- esos registros apuntando a un cargo que ya no existe. Nadie lo ocupa y
-- nadie le reporta: se comprobo contra la base antes de aplicar.
update public.puestos
   set activo = false
 where codigo = 'SOF-P-75665'
   and nombre = 'ATC Posventa';
