-- ---------------------------------------------------------------------
-- El plazo para responder una no conformidad sube de 5 a 15 dias
--
-- Lo dispuso Direccion el 5 de noviembre, por correo a Calidad, al
-- registrarse las no conformidades de la auditoria interna de procesos
-- de octubre: el equipo esta con mucha carga y cinco dias no alcanzan.
-- Pidio ademas que quede como plazo maximo del proceso, no como
-- excepcion para esta tanda.
--
-- Son quince dias CORRIDOS desde la deteccion, como hasta ahora: las
-- no conformidades de la auditoria, detectadas el 3 de noviembre,
-- vencen el 18.
--
-- El plazo no se escribe a mano en ningun lado: lo fija este disparador
-- para que valga por cualquier via de escritura, y esta tambien en
-- DIAS_LIMITE_CIERRE_NC (src/lib/constantes.ts), que cambia en el mismo
-- commit.
--
-- Las no conformidades ya cargadas se recalculan con la regla nueva,
-- como se hizo al pasar de 10 a 5: el plazo es una regla del sistema,
-- no un dato historico de cada registro.
--
-- Queda un pendiente para Calidad, al reves del que dejo el cambio
-- anterior: el escalamiento al lider inmediato sigue en 10 dias
-- (DIAS_ESCALAMIENTO_NC), asi que ahora se escala a alguien que todavia
-- esta dentro de su plazo. Si el escalamiento tiene que acompanar, se
-- cambia ahi.
-- ---------------------------------------------------------------------

create or replace function public.completar_no_conformidad()
returns trigger
language plpgsql
as $$
begin
  new.fecha_limite_cierre := new.fecha_deteccion + 15;

  if new.empresa_afectada_id is null then
    new.empresa_afectada_id := new.empresa_id;
  end if;

  return new;
end;
$$;

comment on function public.completar_no_conformidad is
  'Plazo de respuesta: quince dias corridos desde la deteccion, y empresa '
  'afectada por defecto la que registra. El plazo esta tambien en '
  'DIAS_LIMITE_CIERRE_NC (src/lib/constantes.ts): si cambia, cambia en los '
  'dos lados.';

update public.no_conformidades
   set fecha_limite_cierre = fecha_deteccion + 15
 where fecha_limite_cierre is distinct from fecha_deteccion + 15;
