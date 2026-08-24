-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 016 · Supabase Storage: adjuntos con control de acceso
-- =====================================================================
-- Los archivos son privados. El acceso se otorga siempre mediante
-- enlaces firmados de duracion corta generados desde el servidor.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'adjuntos-sgc',
  'adjuntos-sgc',
  false,
  20971520,                        -- 20 MB por archivo
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain',
    'text/csv'
  ]
)
on conflict (id) do nothing;

-- Lectura: cualquier persona autenticada y activa del sistema. El detalle
-- fino de que documento puede ver cada quien lo resuelve la tabla
-- public.adjuntos, que es la que la aplicacion consulta primero.
create policy "adjuntos_sgc_lectura" on storage.objects
  for select to authenticated
  using (bucket_id = 'adjuntos-sgc' and public.empresa_actual() is not null);

-- Carga: todos menos Direccion, que es un perfil de solo lectura.
create policy "adjuntos_sgc_carga" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'adjuntos-sgc'
    and public.empresa_actual() is not null
    and not public.es_direccion()
    and owner = auth.uid()
  );

create policy "adjuntos_sgc_actualizacion" on storage.objects
  for update to authenticated
  using (bucket_id = 'adjuntos-sgc' and (owner = auth.uid() or public.es_admin_sgc()))
  with check (bucket_id = 'adjuntos-sgc');

create policy "adjuntos_sgc_baja" on storage.objects
  for delete to authenticated
  using (bucket_id = 'adjuntos-sgc' and (owner = auth.uid() or public.es_admin_sgc()));
