-- ---------------------------------------------------------------------
-- La eficacia de la accion formativa se deduce de la de sus participantes
--
-- Regla de Calidad, 6 de octubre. La eficacia se sigue verificando POR
-- PERSONA —eso no cambia—, pero ahora la accion tiene su propio
-- resultado, y no se escribe a mano: sale de contar el de su gente.
--
--   1 participante   el de la persona, tal cual
--   2 a 4            eficaz si todos; parcialmente con uno no eficaz;
--                    no eficaz con dos o mas
--   5 o mas          por porcentaje: 80% o mas eficaz, 60 a 79
--                    parcialmente, menos de 60 no eficaz
--
-- POR QUE NO SE GUARDA EN UNA COLUMNA. Un resultado guardado se calcula
-- una vez y despues miente: basta corregir la evaluacion de una persona
-- para que la accion quede diciendo lo de antes. Se calcula al leer, con
-- esta funcion, que es la misma regla que `lib/formacion.ts` aplica en
-- la pantalla.
--
-- EL CASO DE UNA SOLA PERSONA. Con un participante no se puede
-- distinguir si fallo la formacion o fallo el participante, asi que un
-- «no eficaz» no alcanza para concluir que la capacitacion fallo. Se
-- registra la causa y, si corresponde, un refuerzo con fecha de
-- reevaluacion. Se admite UNA reevaluacion: si despues del refuerzo la
-- persona resulta eficaz, la accion cierra como «eficaz tras refuerzo».
--
-- El primer resultado NO se pisa: queda en `eficacia_inicial`. Esconder
-- que la primera vez no funciono seria perder justamente el dato que
-- sirve para decidir sobre esa capacitacion el año que viene.
-- ---------------------------------------------------------------------

alter table public.capacitacion_participantes
  add column if not exists eficacia_inicial public.resultado_eficacia,
  add column if not exists causa_no_eficacia text,
  add column if not exists plan_refuerzo text,
  add column if not exists fecha_reevaluacion date;

comment on column public.capacitacion_participantes.eficacia_inicial is
  'El primer resultado, cuando hubo reevaluacion. Se completa solo al reevaluar: '
  'si esta nulo, `eficacia` es el unico resultado que hubo.';
comment on column public.capacitacion_participantes.causa_no_eficacia is
  'Por que no fue eficaz: `formacion` (contenido, instructor, modalidad) o '
  '`participante` (falta de practica, no tuvo oportunidad de aplicarlo). Decide si '
  'la accion correctiva va sobre la capacitacion o sobre la persona.';
comment on column public.capacitacion_participantes.plan_refuerzo is
  'Que se hace antes de reevaluar: refuerzo, acompañamiento en el puesto.';
comment on column public.capacitacion_participantes.fecha_reevaluacion is
  'Cuando se reevalua despues del refuerzo. El plazo tiene que estar definido: '
  'un refuerzo sin fecha no se revisa nunca.';

alter table public.capacitacion_participantes
  drop constraint if exists capacitacion_participantes_causa_valida;

alter table public.capacitacion_participantes
  add constraint capacitacion_participantes_causa_valida check (
    causa_no_eficacia is null or causa_no_eficacia in ('formacion', 'participante')
  );

-- ---------------------------------------------------------------------

create or replace function public.eficacia_de_la_accion(p_capacitacion_id uuid)
returns text
language sql
stable
-- `security invoker` a proposito: RLS se aplica. Esta funcion no resuelve
-- ninguna recursion de politicas, asi que no hay motivo para que ignore
-- los permisos de quien pregunta.
set search_path = public
as $fn$
  with evaluados as (
    select eficacia, eficacia_inicial
      from public.capacitacion_participantes
     where capacitacion_id = p_capacitacion_id
       and eficacia <> 'pendiente'
  ),
  conteo as (
    select count(*) as total,
           count(*) filter (where eficacia = 'eficaz') as eficaces,
           count(*) filter (where eficacia <> 'eficaz') as fallidos,
           count(*) filter (
             where eficacia = 'eficaz' and eficacia_inicial = 'no_eficaz'
           ) as tras_refuerzo
      from evaluados
  )
  select case
    -- Sin nadie evaluado todavia no hay resultado que dar.
    when total = 0 then 'pendiente'

    when total = 1 then
      case
        when eficaces = 1 and tras_refuerzo = 1 then 'eficaz_tras_refuerzo'
        when eficaces = 1 then 'eficaz'
        else 'no_eficaz'
      end

    when total <= 4 then
      case
        when fallidos = 0 then 'eficaz'
        when fallidos = 1 then 'parcialmente_eficaz'
        else 'no_eficaz'
      end

    -- Cinco o mas: por porcentaje. Se compara con enteros para no
    -- arrastrar el redondeo de una division.
    else
      case
        when eficaces * 100 >= total * 80 then 'eficaz'
        when eficaces * 100 >= total * 60 then 'parcialmente_eficaz'
        else 'no_eficaz'
      end
  end
  from conteo;
$fn$;

comment on function public.eficacia_de_la_accion(uuid) is
  'Eficacia de una accion formativa deducida de la de sus participantes, segun la '
  'regla de Calidad del 6 de octubre de 2026. La misma regla vive en '
  '`lib/formacion.ts`: si cambia, cambia en los dos lados.';

revoke all on function public.eficacia_de_la_accion(uuid) from public;
grant execute on function public.eficacia_de_la_accion(uuid) to authenticated;
