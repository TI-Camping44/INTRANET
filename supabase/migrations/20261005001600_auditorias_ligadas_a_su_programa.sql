-- ---------------------------------------------------------------------
-- Las auditorias entran al programa anual de su año
--
-- EL PROGRAMA ERA UNA CARPETA VACIA. `crearAuditoria` leia `programa_id`
-- del formulario, pero Calidad habia sacado ese campo del alta porque se
-- completaba siempre igual. Nadie lo mandaba, nadie lo notaba: la
-- auditoria se guardaba con `programa_id` nulo y el programa anual no
-- tenia una sola auditoria adentro aunque el año tuviera diez.
--
-- Del lado de la aplicacion ya quedo resuelto: el alta y la edicion
-- resuelven el programa por el año de la fecha planificada. Esta
-- migracion arregla lo que ya estaba cargado.
--
-- No se agrega un disparador que lo haga en la base. La fecha
-- planificada puede moverse a un año sin programa, y ahi la auditoria
-- tiene que quedar suelta y verse: un disparador que la acomodara sola
-- en el programa mas cercano escondería justamente el caso que Calidad
-- necesita ver.
-- ---------------------------------------------------------------------

update public.auditorias a
   set programa_id = p.id
  from public.programas_auditoria p
 where a.programa_id is null
   and a.fecha_planificada is not null
   and p.empresa_id = a.empresa_id
   and p.anio = extract(year from a.fecha_planificada)::int;
