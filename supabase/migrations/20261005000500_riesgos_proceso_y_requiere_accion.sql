-- ---------------------------------------------------------------------
-- Riesgos: el proceso sale de la informacion documentada, y
-- «¿Requiere acciones?» sigue al semaforo
--
-- Dos cosas, las dos pedidas por Calidad el 5 de octubre al rehacer la
-- pantalla de carga de riesgos.
--
-- 1 · EL PROCESO SE ELIGE DE LOS DOCUMENTOS CARGADOS. La lista de
--     procesos del formulario tiene que salir de la informacion
--     documentada y no de una tabla aparte. En Camping 44 son la misma
--     cosa: los diecinueve procesos del mapa tienen su manual cargado
--     —MP-EST-01 a MP-SOP-08—, con el mismo nombre y el mismo codigo
--     salvo el prefijo «MP-».
--
--     Pero el vinculo no estaba hecho: `documentos.proceso_id` estaba en
--     null en las veintiuna filas, asi que el modulo de documentos
--     mostraba «Proceso: —» en todas y su filtro por proceso no
--     devolvia nada. Se completa acá, por codigo, solo donde esta vacio.
--     Es el dato que faltaba, no una invencion: los diecinueve calzan
--     uno a uno y ademas coinciden en el nombre, lo que se verifico
--     antes de escribir esto.
--
-- 2 · «¿REQUIERE ACCIONES?» ARRANCA EN MEDIO, NO EN 4. La columna es
--     generada y cortaba en nivel 4. El semaforo del proyecto dice que
--     1-4 es bajo, y Calidad fue explicito: medio, alto y critico
--     requieren acciones; los bajos no. Con el corte en 4, un riesgo de
--     nivel 4 —bajo— salia pidiendo plan.
--
--     OJO: esto contradice lo que el instructivo decia antes, que exigia
--     plan «de nivel 4 para arriba». Queda la regla nueva, que es la que
--     Calidad confirmo al rehacer el formulario.
-- ---------------------------------------------------------------------

-- 1 · El manual de cada proceso, vinculado a su proceso.
update public.documentos d
set proceso_id = p.id
from public.procesos p
where d.proceso_id is null
  and d.tipo = 'manual'
  and d.codigo like 'MP-%'
  and p.activo
  and p.empresa_id = d.empresa_id
  and p.codigo = substring(d.codigo from 4);

-- 2 · El corte del semaforo: medio (5) para arriba.
-- Se cambia la expresion en el lugar, con `set expression` —PostgreSQL
-- 17—, y no soltando y volviendo a crear la columna: asi no se pierden
-- los permisos ni el comentario, y la tabla se reescribe una sola vez.
-- Se escribe sobre probabilidad y severidad y no sobre `nivel`: una
-- columna generada no puede apoyarse en otra generada.
alter table public.riesgos
  alter column requiere_accion
  set expression as (
    probabilidad is not null and severidad is not null and probabilidad * severidad >= 5
  );

comment on column public.riesgos.requiere_accion is
  'Generada: medio, alto o critico (nivel 5 o mas) exige acciones. El nivel bajo (1-4) '
  'se asume y se vigila. Lo fijo Calidad el 5 de octubre de 2026.';
