-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- 014 · Disparadores de bitacora y alta de notificaciones
-- =====================================================================

-- ---------------------------------------------------------------------
-- Registro de trazabilidad. Se aplica a nivel de base de datos para que
-- ningun camino de escritura pueda evadirlo, sea desde la aplicacion,
-- desde un script de migracion o desde el panel de Supabase.
-- ---------------------------------------------------------------------
create or replace function public.registrar_bitacora()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anteriores jsonb;
  v_nuevos jsonb;
  v_campos text[];
  v_registro_id uuid;
  v_empresa_id uuid;
  v_usuario_id uuid := auth.uid();
  v_correo text;
  v_accion accion_bitacora;
begin
  if tg_op = 'INSERT' then
    v_accion := 'creacion';
    v_nuevos := to_jsonb(new);
    v_anteriores := null;
  elsif tg_op = 'UPDATE' then
    v_accion := 'edicion';
    v_nuevos := to_jsonb(new);
    v_anteriores := to_jsonb(old);
  else
    v_accion := 'eliminacion';
    v_nuevos := null;
    v_anteriores := to_jsonb(old);
  end if;

  -- Campos efectivamente modificados, para que la lectura de la bitacora
  -- sea util y no una comparacion manual de dos objetos completos.
  if tg_op = 'UPDATE' then
    select array_agg(clave order by clave)
      into v_campos
      from (
        select key as clave
          from jsonb_each(v_nuevos)
         where key not in ('actualizado_en', 'busqueda')
           and v_anteriores -> key is distinct from v_nuevos -> key
      ) cambios;

    -- Si solo cambiaron marcas internas, no se registra ruido.
    if v_campos is null or array_length(v_campos, 1) is null then
      return coalesce(new, old);
    end if;

    -- Solo se conservan los campos que cambiaron.
    v_anteriores := (
      select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
        from jsonb_each(v_anteriores) where key = any (v_campos));
    v_nuevos := (
      select coalesce(jsonb_object_agg(key, value), '{}'::jsonb)
        from jsonb_each(v_nuevos) where key = any (v_campos));
  else
    -- El vector de busqueda es derivado, no aporta a la trazabilidad.
    v_nuevos := v_nuevos - 'busqueda';
    v_anteriores := v_anteriores - 'busqueda';
  end if;

  v_registro_id := nullif(coalesce(v_nuevos, v_anteriores) ->> 'id', '')::uuid;
  if v_registro_id is null then
    v_registro_id := nullif(to_jsonb(coalesce(new, old)) ->> 'id', '')::uuid;
  end if;

  v_empresa_id := nullif(to_jsonb(coalesce(new, old)) ->> 'empresa_id', '')::uuid;

  select correo into v_correo from public.usuarios where id = v_usuario_id;

  insert into public.bitacora (
    tabla, registro_id, accion, usuario_id, usuario_correo,
    campos_modificados, valores_anteriores, valores_nuevos, empresa_id
  ) values (
    tg_table_name, v_registro_id, v_accion, v_usuario_id, v_correo,
    v_campos, v_anteriores, v_nuevos, v_empresa_id
  );

  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------
-- Alta de los disparadores sobre las tablas con valor de auditoria.
-- ---------------------------------------------------------------------
do $$
declare
  v_tabla text;
  v_tablas text[] := array[
    'documentos', 'documento_versiones', 'documento_revisores',
    'no_conformidades', 'nc_acciones', 'nc_porques', 'nc_ishikawa',
    'riesgos', 'riesgo_acciones', 'riesgo_evaluaciones',
    'programas_auditoria', 'auditorias', 'auditoria_hallazgos',
    'indicadores', 'indicador_mediciones', 'objetivos',
    'encuestas',
    'competencias', 'puesto_competencias', 'evaluaciones_competencia',
    'capacitaciones', 'capacitacion_participantes',
    'proveedores', 'proveedor_evaluaciones',
    'activos', 'mantenimientos',
    'procesos', 'puestos', 'sedes', 'usuarios', 'clientes', 'adjuntos'
  ];
begin
  foreach v_tabla in array v_tablas loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.registrar_bitacora()',
      'bitacora_' || v_tabla, v_tabla);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Alta de notificaciones.
--
-- La tabla no admite INSERT directo por politica: se pasa por esta
-- funcion, que valida que emisor y destinatario pertenezcan a la misma
-- empresa y evita duplicar la misma alerta en corridas sucesivas del
-- trabajo programado mediante "clave_unicidad".
-- ---------------------------------------------------------------------
create or replace function public.crear_notificacion(
  p_usuario_id uuid,
  p_tipo tipo_notificacion,
  p_titulo text,
  p_mensaje text,
  p_enlace text default null,
  p_entidad text default null,
  p_entidad_id uuid default null,
  p_clave_unicidad text default null,
  p_requiere_correo boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_empresa_destino uuid;
begin
  select empresa_id into v_empresa_destino
    from public.usuarios where id = p_usuario_id and activo;

  if v_empresa_destino is null then
    return null;   -- destinatario inexistente o inactivo: no es un error
  end if;

  -- Cuando la llama una persona, ambas partes deben ser de la misma empresa.
  if auth.uid() is not null and v_empresa_destino is distinct from public.empresa_actual() then
    raise exception 'No se puede notificar a un usuario de otra empresa'
      using errcode = '42501';
  end if;

  insert into public.notificaciones (
    usuario_id, tipo, titulo, mensaje, enlace, entidad, entidad_id,
    clave_unicidad, requiere_correo
  ) values (
    p_usuario_id, p_tipo, p_titulo, p_mensaje, p_enlace, p_entidad, p_entidad_id,
    p_clave_unicidad, p_requiere_correo
  )
  on conflict (usuario_id, clave_unicidad) where clave_unicidad is not null
  do nothing
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.crear_notificacion(
  uuid, tipo_notificacion, text, text, text, text, uuid, text, boolean
) to authenticated;

-- ---------------------------------------------------------------------
-- Notificacion a la lista de difusion de un documento.
-- Resuelve tanto los destinatarios individuales como los procesos
-- completos alcanzados, sin repetir personas.
-- ---------------------------------------------------------------------
create or replace function public.notificar_difusion_documento(p_documento_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_documento public.documentos%rowtype;
  v_destinatario uuid;
  v_total integer := 0;
begin
  select * into v_documento from public.documentos where id = p_documento_id;
  if not found then
    return 0;
  end if;

  for v_destinatario in
    select distinct u.id
      from public.documento_difusion d
      join public.usuarios u
        on (d.usuario_id = u.id or u.proceso_id = d.proceso_id)
     where d.documento_id = p_documento_id
       and u.activo
       and u.id is not null
  loop
    perform public.crear_notificacion(
      v_destinatario,
      'documento_publicado',
      'Documento actualizado: ' || v_documento.codigo,
      'Se publico la version v' || lpad(v_documento.version_actual::text, 2, '0') ||
        ' de "' || v_documento.titulo || '". Corresponde revisar el contenido vigente.',
      '/documentos/' || p_documento_id,
      'documentos',
      p_documento_id,
      'documento:' || p_documento_id || ':v' || v_documento.version_actual
    );
    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$$;

grant execute on function public.notificar_difusion_documento(uuid) to authenticated;
