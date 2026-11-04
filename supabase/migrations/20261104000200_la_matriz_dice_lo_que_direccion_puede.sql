-- La matriz deja de prometerle a Direccion lo que no puede hacer.
--
-- A `direccion` le figuraba `editar = true` en 16 de los 21 modulos. Al
-- revisar politica por politica que significaba eso de verdad, el cuadro
-- es este:
--
--  · En 9 modulos la politica lleva un segundo predicado que acota la
--    escritura a lo que la persona tiene asignado —`responsable_id =
--    auth.uid()`, `gestor_id`, `elaborador_id`, `superior_id`—. Ahi
--    `editar = true` NO es un agujero: es lo que hace que «si te lo
--    asignaron, lo podes trabajar» valga tambien para Direccion. Se
--    conservan: no_conformidades, acciones, cambios, documentos,
--    riesgos, reclamos, objetivos, activos y personas.
--
--    `cambios_edicion` ademas nombra `es_direccion()` de forma
--    explicita, asi que apagarlo romperia una concesion deliberada.
--
--  · En 6 modulos la politica exige `puede_gestionar()`, `es_admin_sgc()`
--    o `es_auditor()`, y Direccion no es ninguno de los tres, asi que
--    `editar = true` no le concede NADA. Son auditorias, directorio,
--    inicio, proveedores, satisfaccion y usuarios. La fila igual se
--    apaga: la matriz se lee en pantalla para saber quien puede que
--    cosa, y decir que Direccion edita Auditorias cuando no puede es
--    desinformacion en la pantalla que gobierna los permisos.
--
--  · En 1 modulo SI era un permiso real y concedido sin querer:
--    APLICACIONES. `aplicaciones_administracion` es
--    `misma_empresa(empresa_id) and puede_editar('aplicaciones')`, sin
--    ningun otro predicado, y la pantalla `/aplicaciones/administrar`
--    cuelga de `requerirModuloEditable('aplicaciones')`, que lee esta
--    misma matriz y NO mira `esSoloLectura`. Con lo cual Direccion podia
--    entrar y agregar, editar y borrar las tarjetas de aplicaciones de
--    toda la empresa. Es lo unico que este archivo cambia de verdad.
--
-- NO SE TOCA `usuarios` MAS QUE PARA LIMPIAR LA FILA: sus politicas no
-- consultan `puede_editar()` en ningun momento —escribir exige
-- `es_admin_sgc()`— asi que Direccion no pudo nunca cambiarle el rol a
-- nadie, con la matriz diciendo lo que dijera.

update public.permisos
   set editar = false
 where rol = 'direccion'
   and modulo in (
     'aplicaciones',   -- el unico permiso real que se quita
     'auditorias',     -- de aca abajo, filas que no concedian nada
     'directorio',
     'inicio',
     'proveedores',
     'satisfaccion',
     'usuarios'
   );

comment on table public.permisos is
  'Matriz rol x modulo. Direccion conserva «editar» solo donde la politica '
  'acota la escritura a lo que la persona tiene asignado; en los modulos de '
  'gestion queda en false, y aplicaciones se le quito el 4 de noviembre '
  'porque su politica no lleva ese segundo predicado.';
