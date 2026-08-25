-- =====================================================================
-- Intranet SGC - Camping 44 S.A.
-- DATOS REALES · Documentos de la unidad compartida del SGC
-- =====================================================================
-- El resto del juego documental vigente: contexto organizacional,
-- politicas, estructura, formularios y el protocolo de orden y limpieza.
-- Los manuales de proceso ya se cargaron en 10-mapa-de-procesos.sql.
--
-- Codigo, version y vigencia salen del encabezado de cada archivo, no
-- del nombre del archivo ni de la fecha de modificacion en Drive: se
-- abrieron para leerlos. Casi todo el juego se lanzo el 25/05/2026 en
-- version 00; el protocolo de orden y limpieza es posterior
-- (11/08/2026) y el contrato de compraventa ya va por la version 01.
--
-- Ocho documentos NO tienen codigo. No es un olvido de esta carga: el
-- documento mismo no lo lleva, se identifica por titulo, version y
-- vigencia. Se dejan sin codigo antes que inventarles uno. Cuando
-- Calidad los codifique, se completa la columna.
--
-- La Matriz de Comunicaciones si lo tiene, aunque el nombre del archivo
-- no lo diga: el manual MP-SOP-01 la cita como F-SOP-01-01.
--
-- Como con los manuales, se enlaza el archivo vigente en lugar de
-- copiar su contenido.
--
-- Se aplica DESPUES de 10-mapa-de-procesos.sql. Es idempotente.

do $$
declare
  v_empresa uuid;
  v_responsable uuid;
  v_norma uuid;
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

  select id into v_norma from public.normas limit 1;

  for r in
    select * from (values
      -- codigo,      titulo,                                              tipo,           proceso,  version, vigencia,     id de Drive

      -- 01 Contexto Organizacional (sin codigo)
      (null,          'Matriz FODA',                                       'registro',     'EST-02', 0, '2026-05-25', '1QRkwdEIgUaPiTBqnsld6-OBfUIVw9iWL'),
      (null,          'Matriz de Partes Interesadas',                      'registro',     'EST-02', 0, '2026-05-25', '11PyqNND_ToYrO3kpe49sWz1WHnOK5CaG'),
      (null,          'Alcance del Sistema de Gestión de Calidad',         'manual',       'EST-02', 0, '2026-05-25', '1OVed4zXHF1WmgtKugcFr-T2FyYns6DTu'),
      (null,          'Mapa de Procesos',                                  'manual',       'EST-02', 0, '2026-05-25', '1ANscWXVEBdPAYj1YC3d2pfptGN07Hc4D'),

      -- 02 Politicas y Otros (sin codigo)
      (null,          'Política de Calidad',                               'politica',     'EST-02', 0, '2026-05-25', '1Syb_5BDVc1ASGfazIU6Txj6nnXKrxfSZ'),
      (null,          'Propósito, Misión y Visión',                        'politica',     'EST-02', 0, '2026-05-25', '1tJlSPwB9whDwbQTNQHxStAj7Dib2_5ZM'),
      (null,          'Valores Institucionales',                           'politica',     'EST-02', 0, '2026-05-25', '1djuLhyp0FBGN8GoGxK36ovbDIWQUg8qQ'),
      (null,          'Política de Garantía',                              'politica',     'MIS-05', 0, '2026-05-25', '1NUSS9-qPk27RgAs7NANdE2Tjd62Qck8N'),

      -- 03 Estructura Organizacional (sin codigo)
      (null,          'Estructura Organizacional',                         'registro',     'SOP-01', 0, '2026-05-25', '1_u6Cti8qRdMZkgVfvWcZ89-jXqbkTPrz'),

      -- 05 Formularios y Otros
      ('F-EST-02-01', 'Minuta de Reunión',                                 'formulario',   'EST-02', 0, '2026-05-25', '1lqtRdof6j7MWDw-Fx_oV1ZUHK8ZeTXvX'),
      ('F-MIS-04-01', 'Carta de Responsabilidad',                          'formulario',   'MIS-04', 0, '2026-05-25', '1UD0zKZX8ct4B1NJk92w2oPWAsLDwkQZR'),
      ('F-MIS-05-01', 'Orden de Trabajo',                                  'formulario',   'MIS-05', 0, '2026-05-25', '1Ghxkkoh1GsUxQadsLWygiLj0eKuwJtK5'),
      ('F-MIS-06-01', 'Autorización y Deslinde de Responsabilidad',        'formulario',   'MIS-06', 0, '2026-05-25', '14iMxwKNOF66xVa8RuTNtVF8V-gz7Rorq'),
      ('F-MIS-06-02', 'Reglamento del Stand de Tiro',                      'formulario',   'MIS-06', 0, '2026-05-25', '1Dd7HefGI72o5wNY82HgY2Wn2YrZr5dWs'),
      ('F-MIS-07-01', 'Guía de Corrección',                                'formulario',   'MIS-07', 0, '2026-05-25', '1kKRf-Lsaaj0JnE9_f-AdjjQ9mlnaEqg-'),
      ('F-SOP-01-01', 'Matriz de Comunicaciones',                          'registro',     'SOP-01', 0, '2026-05-25', '1Qj1g7hABvumJa6dnjIcX1mjJuZs9dz6r'),
      ('F-SOP-02-01', 'Verificación de Activos Edilicios',                 'formulario',   'SOP-02', 0, '2026-05-25', '1hhJiRuYkY0wmJGOEM2WYYm36p1K6hK-i'),
      ('F-SOP-02-02', 'Verificación de Activos Tecnológicos',              'formulario',   'SOP-02', 0, '2026-05-25', '1I3HyCAje0Ke_houGXiYVW4xbmGFENV5m'),
      ('F-SOP-03-01', 'Solicitud de Cliente · B2C',                        'formulario',   'SOP-03', 0, '2026-05-25', '1F7ICUHsHPcKwRAoeOV214XgF5HSgXDCw'),
      ('F-SOP-05-01', 'Informe de Inventario',                             'formulario',   'SOP-05', 0, '2026-05-25', '1glJwXow6Sv6z-YGT7pj7e0RFXltEZmfJ'),
      ('F-SOP-06-01', 'Contrato de Compromiso de Compraventa de Material Controlado, Declaración Jurada y Anexos',
                                                                           'formulario',   'SOP-06', 1, '2026-07-17', '1dfIR8mFzOamADtNvSlkyHR5xXuCS1S4R'),
      ('F-SOP-07-01', 'Alta y Baja de Credenciales de Acceso',             'formulario',   'SOP-07', 0, '2026-05-25', '1ccgI3HP0mffF8uAByIPBT9hXWLUpidiU'),
      ('F-SOP-07-02', 'Compromiso de Uso Responsable',                     'formulario',   'SOP-07', 0, '2026-05-25', '1jm9WrzIY09F_tecBxiQVxDhlxFjwNGOw'),
      ('F-SOP-07-03', 'Retiro de Equipos Informáticos',                    'formulario',   'SOP-07', 0, '2026-05-25', '1KcVcvGCPCu_7u7tkHLeUDXaCDOt-Brin'),
      ('F-SOP-08-01', 'Evaluación de Asociados de Negocio y Proveedores',  'formulario',   'SOP-08', 0, '2026-05-25', '1bnJv5w1CxBZv9gY1O42uu-Y1FAPIppcf'),
      (null,          'Registro de Participación',                         'formulario',   'SOP-01', 0, '2026-05-25', '1vs3tk9oc1zVXKhXs3SpjGKchtlVUVa4S'),
      (null,          'Solicitud de Cliente · B2B',                        'formulario',   'SOP-03', 0, '2026-05-25', '1Q4R9TWbdwrfJl3SiQLhWAlvGuz4l8mM5'),

      -- 07 Protocolo Orden y Limpieza
      ('P-SOP-01-01', 'Orden y Limpieza en Espacios de Trabajo',           'instructivo',  'SOP-01', 0, '2026-08-11', '18u2iMjfQPFEtTpl6QMZDf7toKfNqoaPK'),
      (null,          'Preguntas Frecuentes · Protocolo de Orden y Limpieza',
                                                                           'instructivo',  'SOP-01', 0, '2026-08-11', '1FQeLyX20UI26c_HeDk124zThaL90vHHF')
    ) as t(codigo, titulo, tipo, proceso, version, vigencia, drive_id)
  loop
    select id into v_proceso from public.procesos
     where empresa_id = v_empresa and lower(codigo) = lower(r.proceso);
    if v_proceso is null then
      raise exception 'Falta el proceso % del mapa real. Aplique antes 10-mapa-de-procesos.sql.', r.proceso;
    end if;

    if r.codigo is null then
      -- Sin codigo no hay clave por la cual reconocerlo: se identifica
      -- por titulo dentro de la empresa.
      update public.documentos set
        tipo = r.tipo::public.tipo_documento,
        estado = 'vigente',
        proceso_id = v_proceso,
        norma_id = v_norma,
        responsable_id = v_responsable,
        elaborador_id = v_responsable,
        version_actual = r.version,
        fecha_aprobacion = r.vigencia::date,
        fecha_vigencia = r.vigencia::date,
        fecha_proxima_revision = r.vigencia::date + interval '12 months',
        periodicidad_revision_meses = 12,
        es_demostracion = false,
        url_documento = 'https://drive.google.com/file/d/' || r.drive_id || '/view'
       where empresa_id = v_empresa and codigo is null and titulo = r.titulo;

      if not found then
        insert into public.documentos (
          empresa_id, codigo, titulo, tipo, estado, proceso_id, norma_id,
          responsable_id, elaborador_id, version_actual,
          fecha_aprobacion, fecha_vigencia, fecha_proxima_revision,
          periodicidad_revision_meses, es_demostracion, url_documento
        ) values (
          v_empresa, null, r.titulo, r.tipo::public.tipo_documento, 'vigente',
          v_proceso, v_norma, v_responsable, v_responsable, r.version,
          r.vigencia::date, r.vigencia::date, r.vigencia::date + interval '12 months',
          12, false, 'https://drive.google.com/file/d/' || r.drive_id || '/view'
        );
      end if;
    else
      insert into public.documentos (
        empresa_id, codigo, titulo, tipo, estado, proceso_id, norma_id,
        responsable_id, elaborador_id, version_actual,
        fecha_aprobacion, fecha_vigencia, fecha_proxima_revision,
        periodicidad_revision_meses, es_demostracion, url_documento
      ) values (
        v_empresa, r.codigo, r.titulo, r.tipo::public.tipo_documento, 'vigente',
        v_proceso, v_norma, v_responsable, v_responsable, r.version,
        r.vigencia::date, r.vigencia::date, r.vigencia::date + interval '12 months',
        12, false, 'https://drive.google.com/file/d/' || r.drive_id || '/view'
      )
      on conflict (empresa_id, upper(codigo)) do update set
        titulo = excluded.titulo,
        tipo = excluded.tipo,
        estado = excluded.estado,
        proceso_id = excluded.proceso_id,
        version_actual = excluded.version_actual,
        fecha_aprobacion = excluded.fecha_aprobacion,
        fecha_vigencia = excluded.fecha_vigencia,
        fecha_proxima_revision = excluded.fecha_proxima_revision,
        es_demostracion = false,
        url_documento = excluded.url_documento;
    end if;
  end loop;
end;
$$;
