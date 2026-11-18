-- =====================================================================
-- Intranet - Camping 44 S.A.
-- Direccion puede registrar no conformidades
-- =====================================================================
-- El 18/11/2026 Ariel Kemper (Direccion) quiso levantar una NC: el menu
-- le ofrecia «+ Nueva No Conformidad» —la matriz le da `editar` en el
-- modulo— pero la pantalla lo mandaba a «Sin acceso» y la politica de
-- alta lo rechazaba con `not es_direccion()`. El Responsable de TI fijo
-- el criterio: Direccion tiene que poder registrar desviaciones.
--
-- SE ABRE SOLO EL ALTA, Y ACOTADA. Direccion inserta unicamente filas
-- donde ella misma figura como quien la detecto y quien la creo, y sube
-- evidencia unicamente a esas NC. Editar la cabecera, cerrarla o cargar
-- acciones sigue siendo de Calidad, del responsable y del jefe de area.
-- ---------------------------------------------------------------------

-- 1. Alta de la no conformidad.
drop policy if exists "no_conformidades_alta" on public.no_conformidades;
create policy "no_conformidades_alta" on public.no_conformidades
  for insert to authenticated
  with check (
    public.misma_empresa(empresa_id)
    and public.puede_editar('no_conformidades')
    and (
      not public.es_direccion()
      or (detectado_por = auth.uid() and creado_por = auth.uid())
    )
  );

-- 2. Registro del adjunto: para Direccion, solo evidencia de una NC que
--    ella detecto.
drop policy if exists "adjuntos_alta" on public.adjuntos;
create policy "adjuntos_alta" on public.adjuntos
  for insert to authenticated
  with check (
    public.misma_empresa(empresa_id)
    and subido_por = auth.uid()
    and (
      not public.es_direccion()
      or (
        entidad = 'no_conformidades'
        and exists (
          select 1 from public.no_conformidades nc
           where nc.id = adjuntos.entidad_id
             and nc.detectado_por = auth.uid()
        )
      )
    )
  );

-- 3. El archivo en el bucket: misma regla, por la ruta
--    no-conformidades/<id de la NC>/<archivo>.
drop policy if exists "adjuntos_sgc_carga" on storage.objects;
create policy "adjuntos_sgc_carga" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'adjuntos-sgc'
    and public.empresa_actual() is not null
    and owner = auth.uid()
    and (
      not public.es_direccion()
      or (
        (storage.foldername(name))[1] = 'no-conformidades'
        and exists (
          select 1 from public.no_conformidades nc
           where nc.id::text = (storage.foldername(name))[2]
             and nc.detectado_por = auth.uid()
        )
      )
    )
  );
