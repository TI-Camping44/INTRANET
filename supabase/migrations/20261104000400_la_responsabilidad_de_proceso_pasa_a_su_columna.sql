-- La responsabilidad de proceso se muda a la columna que de verdad manda.
--
-- El campo «Proceso a cargo» de la ficha de usuario decia «Solo si es
-- responsable del proceso» y escribia `usuarios.proceso_id`, que NO es
-- lo que mira ninguna politica: `es_responsable_de_proceso()` lee
-- `procesos.responsable_id`. O sea que la etiqueta prometia una
-- responsabilidad que el dato no concedia.
--
-- Esto copia lo cargado a la columna correcta, para que nadie pierda lo
-- que ya tenia. Hoy es una sola persona: Jorge Pineda en Gestion del
-- Capital Humano, que es quien sube el Perfil de Resultados de Puesto.
--
-- `usuarios.proceso_id` NO SE BORRA: sigue diciendo a que proceso
-- PERTENECE la persona, que es otra pregunta y es de a uno. Lo que deja
-- de hacer es gobernar permisos.

update public.procesos p
   set responsable_id = u.id
  from public.usuarios u
 where u.proceso_id = p.id
   and p.responsable_id is null;
