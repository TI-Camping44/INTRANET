-- ---------------------------------------------------------------------
-- El plazo de cierre de una no conformidad baja de 10 a 5 dias
--
-- Lo definio Calidad. El plazo no se escribe a mano en ningun lado: lo
-- fija este disparador para que valga por cualquier via de escritura
-- —interfaz, script o el panel de Supabase— y esta tambien en
-- DIAS_LIMITE_CIERRE_NC (src/lib/constantes.ts), que se actualiza en el
-- mismo cambio.
--
-- Las no conformidades ya cargadas se recalculan con la regla nueva, como
-- se hizo al fijar los 10 dias: el plazo es una regla del sistema, no un
-- dato historico de cada registro.
--
-- Queda un pendiente para Calidad: el escalamiento al lider inmediato
-- sigue en 10 dias (DIAS_ESCALAMIENTO_NC), asi que con el cierre en 5 la
-- accion se escala cuando la no conformidad ya esta fuera de plazo. Si el
-- escalamiento tambien tiene que bajar, se cambia ahi.
-- ---------------------------------------------------------------------

create or replace function public.completar_no_conformidad()
returns trigger
language plpgsql
as $$
begin
  new.fecha_limite_cierre := new.fecha_deteccion + 5;

  if new.empresa_afectada_id is null then
    new.empresa_afectada_id := new.empresa_id;
  end if;

  return new;
end;
$$;

comment on function public.completar_no_conformidad is
  'Plazo de cierre: cinco dias corridos desde la deteccion, y empresa afectada por '
  'defecto la que registra. El plazo esta tambien en DIAS_LIMITE_CIERRE_NC '
  '(src/lib/constantes.ts): si cambia, cambia en los dos lados.';

update public.no_conformidades
   set fecha_limite_cierre = fecha_deteccion + 5
 where fecha_limite_cierre is distinct from fecha_deteccion + 5;
