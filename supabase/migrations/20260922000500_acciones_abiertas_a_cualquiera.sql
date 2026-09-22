-- ---------------------------------------------------------------------
-- Cualquiera puede proponer una accion correctiva
--
-- Hasta ahora `nc_acciones_gestion` dejaba escribir solo a Calidad, al
-- responsable de la no conformidad y al responsable del proceso. Calidad
-- pidio abrir el alta: si alguien ve como resolver una desviacion que no
-- le toco, tiene que poder proponerla. En Sofidya era asi y funcionaba.
--
-- Se abre SOLO el alta:
--   * insert  -> cualquiera de la empresa que pueda escribir.
--   * update  -> sigue acotado (Calidad, responsable de la NC, del
--                proceso, o el responsable de la propia accion).
--   * delete  -> sigue acotado igual.
--
-- Direccion queda afuera, como en el resto del sistema: su perfil es de
-- solo lectura. Y sigue valiendo `misma_empresa`: nadie carga una accion
-- en una no conformidad de otra empresa del grupo.
--
-- El disparador de bitacora registra quien la cargo, asi que abrir el
-- alta no abre un agujero de trazabilidad.
-- ---------------------------------------------------------------------

drop policy if exists nc_acciones_gestion on public.nc_acciones;

create policy nc_acciones_alta on public.nc_acciones
  for insert to authenticated
  with check (
    not es_direccion()
    and exists (
      select 1
        from public.no_conformidades n
       where n.id = nc_acciones.no_conformidad_id
         and misma_empresa(n.empresa_id)
    )
  );

create policy nc_acciones_edicion on public.nc_acciones
  for update to authenticated
  using (
    responsable_id = auth.uid()
    or exists (
      select 1
        from public.no_conformidades n
       where n.id = nc_acciones.no_conformidad_id
         and (
           es_admin_sgc()
           or n.responsable_id = auth.uid()
           or es_responsable_de_proceso(n.proceso_id)
         )
    )
  )
  with check (
    responsable_id = auth.uid()
    or exists (
      select 1
        from public.no_conformidades n
       where n.id = nc_acciones.no_conformidad_id
         and (
           es_admin_sgc()
           or n.responsable_id = auth.uid()
           or es_responsable_de_proceso(n.proceso_id)
         )
    )
  );

-- La politica vieja `nc_acciones_responsable` daba el update al
-- responsable de la accion; ahora eso esta dentro de nc_acciones_edicion.
drop policy if exists nc_acciones_responsable on public.nc_acciones;

create policy nc_acciones_baja on public.nc_acciones
  for delete to authenticated
  using (
    exists (
      select 1
        from public.no_conformidades n
       where n.id = nc_acciones.no_conformidad_id
         and (es_admin_sgc() or n.responsable_id = auth.uid())
    )
  );
