-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- DATOS REALES · Mapa de procesos y manuales de proceso
-- =====================================================================
-- Los diecinueve procesos del mapa de Camping 44, con su manual. Salen
-- de la unidad compartida del SGC, carpeta "04 Manuales de Proceso", que
-- ya esta dividida por tipo: estrategicos, misionales y de soporte.
--
-- Esa division coincide con el enum "tipo_proceso" del sistema:
--   MP-EST → estrategico     MP-MIS → operativo     MP-SOP → apoyo
-- ("misional" y "operativo" son el mismo concepto con distinto nombre;
-- se respeta el del enum para no tocar el esquema por una palabra.)
--
-- Cada proceso queda con su manual cargado en "documentos", enlazado al
-- PDF vigente. No se copia el contenido: la intranet indexa y enlaza.
--
-- Los procesos y documentos de demostracion que compartan codigo quedan
-- reemplazados por el real: el codigo es la identidad, y el documento
-- verdadero es el que debe quedarse con el suyo.
--
-- Se aplica DESPUES del seed. Es idempotente.

do $$
declare
  v_empresa uuid;
  v_responsable uuid;
  v_norma uuid;
  -- Los manuales llevan "Vigencia: 25/05/2026" en su propio encabezado.
  v_vigencia constant date := date '2026-05-25';
  r record;
  v_proceso uuid;
begin
  select id into v_empresa from public.empresas order by creado_en limit 1;
  if v_empresa is null then
    raise exception 'No hay ninguna empresa cargada. Aplique el seed primero.';
  end if;

  select id into v_responsable from public.usuarios
   where empresa_id = v_empresa and rol = 'administrador_sgc' and activo
   order by creado_en limit 1;
  if v_responsable is null then
    select id into v_responsable from public.usuarios
     where empresa_id = v_empresa and activo order by creado_en limit 1;
  end if;
  if v_responsable is null then
    raise exception 'No hay usuarios cargados: no se puede asignar responsable.';
  end if;

  select id into v_norma from public.normas limit 1;

  for r in
    select * from (values
      -- codigo,       tipo,           nombre,                                       id de Drive
      ('MP-EST-01', 'estrategico', 'Información Documentada',                      '1_cG6iIUl61FLdFCon3GEgb3maDCZD7aD'),
      ('MP-EST-02', 'estrategico', 'Planificación Estratégica del SGC',            '1wtuLruEKy8qfUQjKjUfNYkArUvFhUGLT'),
      ('MP-EST-03', 'estrategico', 'Auditoría Interna del SGC',                    '1pX4FwLS9_Kx_baBc1v_JNPLTmSh5qHSJ'),
      ('MP-EST-04', 'estrategico', 'No Conformidades y Acciones Correctivas',      '1JrWpsTWYUTyLUpX_pvyB4skr2kVZLrX8'),
      ('MP-MIS-01', 'operativo',   'Importación',                                  '1uK6ogBarCoj6mFdXSenyzqSI_ze1l3VK'),
      ('MP-MIS-02', 'operativo',   'Almacenamiento',                               '1w9Q9OCwbj9vTrbWa2uMpwkx2sGA_aiHU'),
      ('MP-MIS-03', 'operativo',   'Ventas',                                       '1o_N5HGeBtm0TGz658cVSt-E5QGYp8vEQ'),
      ('MP-MIS-04', 'operativo',   'Despacho de Mercadería',                       '1NmOdaeAPNHp_BDuzO01x3PQ9sREj3PUd'),
      ('MP-MIS-05', 'operativo',   'Servicio Técnico',                             '1MBKJ0cZmOtVxdzy9HcRDXzP8igCiaCca'),
      ('MP-MIS-06', 'operativo',   'Operación del Stand de Tiro',                  '1Zq1dLhcwf0RJZ-pwNkgw3WlgpL4bFUJb'),
      ('MP-MIS-07', 'operativo',   'Gestión del Centro de Instrucción',            '1a2YRd85GynWbAIVt9GcvAl1VyShKwqgT'),
      ('MP-SOP-01', 'apoyo',       'Gestión del Capital Humano',                   '1bsNBt42lKECeizR2Lfa-ILdrU99P-V0O'),
      ('MP-SOP-02', 'apoyo',       'Infraestructura y Tecnología',                 '1T4Yh401khasW6X4iMvx4Vg8r9u4HKZ8j'),
      ('MP-SOP-03', 'apoyo',       'Gestión de Créditos',                          '1hvLfW03V2R7DBztNezqIBXrLyIsS1p57'),
      ('MP-SOP-04', 'apoyo',       'Gestión de Cobranzas',                         '1g-sv1TZxViVkOVHfSPtoNqQ6D8FbDSpc'),
      ('MP-SOP-05', 'apoyo',       'Inventario de Existencias',                    '1Cp3fmOd_czf9SBhedN-WZyffJ5CkT6sh'),
      ('MP-SOP-06', 'apoyo',       'Facturación y Notas de Crédito',               '17pLevHQJZM8ihtQGaHmOuZbPJelpZ5Y-'),
      ('MP-SOP-07', 'apoyo',       'Seguridad Informática',                        '1S4nXqhUevm6y2AuReHmzpci1Pcc1m7h_'),
      ('MP-SOP-08', 'apoyo',       'Compras locales y Evaluación a Proveedores',   '15lT-5jfwblLJh9HwJ-SejK5ytmo9nFIG')
    ) as t(codigo, tipo, nombre, drive_id)
  loop
    -- El proceso lleva el codigo del manual sin el prefijo "MP-": el
    -- manual documenta al proceso, no es el proceso.
    insert into public.procesos (empresa_id, codigo, nombre, tipo, descripcion)
    values (
      v_empresa,
      replace(r.codigo, 'MP-', ''),
      r.nombre,
      r.tipo::public.tipo_proceso,
      'Documentado en el manual ' || r.codigo || '.'
    )
    on conflict (empresa_id, lower(codigo)) do update set
      nombre = excluded.nombre, tipo = excluded.tipo,
      descripcion = excluded.descripcion
    returning id into v_proceso;

    insert into public.documentos (
      empresa_id, codigo, titulo, tipo, estado, proceso_id, norma_id,
      responsable_id, elaborador_id, version_actual,
      fecha_aprobacion, fecha_vigencia, fecha_proxima_revision,
      periodicidad_revision_meses, es_demostracion, url_documento
    ) values (
      v_empresa, r.codigo, r.nombre, 'manual', 'vigente', v_proceso, v_norma,
      v_responsable, v_responsable, 0,
      v_vigencia, v_vigencia, v_vigencia + interval '12 months', 12, false,
      'https://drive.google.com/file/d/' || r.drive_id || '/view'
    )
    on conflict (empresa_id, upper(codigo)) do update set
      titulo = excluded.titulo,
      tipo = excluded.tipo,
      estado = excluded.estado,
      proceso_id = excluded.proceso_id,
      version_actual = excluded.version_actual,
      fecha_vigencia = excluded.fecha_vigencia,
      fecha_proxima_revision = excluded.fecha_proxima_revision,
      es_demostracion = false,
      url_documento = excluded.url_documento;
  end loop;
end;
$$;
