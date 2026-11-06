-- Dos correcciones a la tarjeta «Canal de denuncias» (TI-0100).
--
-- 1. LA FILA DE VITALICA NO LA VE NADIE. La migración anterior insertó la
--    tarjeta recorriendo `empresas`, que es el mismo error que ya había que
--    limpiar en 20261023000200_limpiar_filas_muertas_de_aplicaciones.sql:
--    `empresa_id` es el inquilino de RLS y vale siempre Camping 44, también
--    para la gente de Vitalica. Una fila con `empresa_id` de Vitalica queda
--    fuera de `misma_empresa()` para todos, así que no suma alcance: solo
--    deja un duplicado que el día que alguien edite la tarjeta va a quedar
--    con la descripción vieja. La tarjeta de Camping 44 ya llega a las dos
--    empresas, porque `empresa_de_la_aplicacion_id` es nulo («es del grupo»).
--
-- 2. LA DESCRIPCIÓN TUTEABA. «No guarda tu correo ni tu usuario» va contra el
--    registro neutro del proyecto: se escribe «su».

delete from public.aplicaciones a
using public.empresas e
where a.empresa_id = e.id
  and e.nombre = 'Vitalica'
  and a.nombre = 'Canal de denuncias';

update public.aplicaciones
set descripcion = 'Para reportar de forma anónima fraudes, acoso, incumplimientos o conductas no éticas. No guarda su correo ni su usuario.'
where nombre = 'Canal de denuncias';
