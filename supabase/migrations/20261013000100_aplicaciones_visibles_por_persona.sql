-- ---------------------------------------------------------------------
-- La aplicacion puede declarar personas, no solo roles
--
-- EL PEDIDO QUE NO ENTRABA: «agreguen mi tablero de licitaciones, que lo
-- vea solo yo». Los permisos del sistema son por ROL, y el rol de quien
-- lo pidio lo comparte otra persona de Direccion, asi que lo mas cerrado
-- que se podia era «lo ve Direccion»: dos personas en vez de una.
--
-- Subir a la persona TODA la matriz de permisos seria otra cosa y no
-- corresponde: ahi lo que se configura es que modulo ve cada rol, y la
-- regla de que los permisos son del rol y no de la persona esta puesta a
-- proposito —si alguien necesita ver un modulo distinto del resto de su
-- rol, lo que corresponde es cambiarle el rol—. Un enlace a un tablero
-- es otra cosa: no es un modulo del sistema, es una tarjeta con una
-- direccion, y «este tablero es mio» es un pedido legitimo y frecuente.
--
-- Entonces la aplicacion declara las dos cosas y se suman: la ve quien
-- tenga uno de los roles marcados O quien este nombrado. Con los roles
-- vacios y una sola persona nombrada, «solo yo» es literal.
--
-- OJO: quien administra la lista las sigue viendo todas, y no es un
-- agujero sino el precio de poder volver a habilitar lo que se oculto.
-- La pantalla lo dice.
-- ---------------------------------------------------------------------

alter table public.aplicaciones
  add column if not exists usuarios_visibles uuid[] not null default '{}';

-- No lleva clave foranea porque PostgreSQL no las admite sobre un
-- arreglo. A cambio, la accion de servidor comprueba que cada id exista
-- en `usuarios` antes de escribir, y un id que apunte a una persona
-- borrada simplemente no coincide con nadie: deja de mostrar la tarjeta,
-- no rompe la consulta.
comment on column public.aplicaciones.usuarios_visibles is
  'Personas que ven la tarjeta ademas de los roles de roles_visibles. '
  'Se suman: la ve quien tenga uno de esos roles o quien este nombrado.';

-- La lectura suma la persona al rol. Es el unico cambio: todo lo demas
-- de la politica queda como estaba.
drop policy if exists aplicaciones_lectura on public.aplicaciones;
create policy aplicaciones_lectura on public.aplicaciones
  for select to authenticated
  using (
    public.misma_empresa(empresa_id)
    and (
      public.puede_editar('aplicaciones')
      or public.rol_actual() = any (roles_visibles)
      or auth.uid() = any (usuarios_visibles)
    )
  );
