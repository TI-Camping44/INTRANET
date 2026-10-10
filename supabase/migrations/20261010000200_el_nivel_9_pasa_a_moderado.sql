-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- El nivel 9 pasa de Alto a Moderado
-- =====================================================================
-- Con la tabla que paso Calidad el 10 de octubre el semaforo queda:
--
--   Bajo      1 a 3
--   Moderado  4 a 9
--   Alto      10 a 14
--   Critico   15 a 25
--
-- Lo unico que se mueve es el 9, que estaba en Alto.
--
-- NO ES UN RETOQUE DE ETIQUETAS. `riesgos.requiere_accion` exige
-- tratamiento desde 10, y el semaforo llamaba «alto» al 9: un riesgo de
-- nivel 9 se mostraba alto y al lado decia que no requeria acciones.
-- Ahora el corte del semaforo y el de la exigencia son el mismo numero,
-- que es lo unico que se puede explicar en una auditoria.
--
-- `requiere_accion` NO se toca: ya estaba en >= 10, que es donde la
-- tabla pone el arranque de Alto.
--
-- La funcion no alimenta ninguna columna generada —`requiere_accion`
-- lleva el `>= 10` escrito— asi que no hay nada que recalcular.
--
-- El valor del enumerado sigue siendo `medio`; la etiqueta que se lee
-- es «Moderado».
-- =====================================================================

create or replace function public.etiqueta_nivel_riesgo(p_nivel integer)
returns text
language sql
immutable
as $function$
  select case
    when p_nivel is null then null
    when p_nivel <= 3  then 'bajo'
    when p_nivel <= 9  then 'medio'
    when p_nivel <= 14 then 'alto'
    else 'critico'
  end;
$function$;
