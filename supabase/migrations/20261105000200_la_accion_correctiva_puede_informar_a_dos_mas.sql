-- La accion correctiva puede informar hasta a dos personas mas.
--
-- Lo pidio Carlos el 5 de noviembre: hasta ahora cada accion del plan
-- tenia un solo responsable y no habia donde anotar a quien mas hay que
-- mantener al tanto. Campos OPCIONALES, no obligatorios.
--
-- INFORMAR NO ES RESPONDER, y la diferencia es el punto. El responsable
-- ejecuta la accion y es contra quien corre el plazo y el escalamiento;
-- el informado se entera y nada mas. Por eso esta columna NO entra en
-- ninguna politica: `nc_acciones_responsable` sigue siendo
-- `responsable_id = auth.uid()`, asi que estar informado no habilita a
-- cerrar la tarea de otro.
--
-- ES UN ARREGLO Y NO DOS COLUMNAS, siguiendo lo que ya hace
-- `aplicaciones.usuarios_visibles`: con `informado_1_id` e
-- `informado_2_id` habria que decidir que pasa cuando se borra el
-- primero y queda el segundo, y el tope de dos quedaria escrito en el
-- nombre de las columnas en vez de en una restriccion que se puede
-- cambiar. El `CHECK` es el que fija el tope.
--
-- PostgreSQL no admite clave foranea sobre un arreglo, asi que la accion
-- de servidor comprueba cada id contra `usuarios` antes de escribir, tal
-- como se hace en `guardarAplicacion()`.

alter table public.nc_acciones
  add column if not exists informados_ids uuid[] not null default '{}'::uuid[];

alter table public.nc_acciones
  drop constraint if exists nc_acciones_informados_tope;

alter table public.nc_acciones
  add constraint nc_acciones_informados_tope
  check (cardinality(informados_ids) <= 2);

comment on column public.nc_acciones.informados_ids is
  'Hasta dos personas a las que se avisa de la accion. Opcional. No concede permisos: informar no es responder.';
